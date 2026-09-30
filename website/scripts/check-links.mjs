/**
 * HealThaali — static link integrity check
 * ----------------------------------------
 *   npm run check:links                  # internal links (what CI gates on)
 *   npm run check:links -- --external    # also call every external URL
 *
 * Runs against the *built* output (`dist/`), not the sources, so it verifies
 * what a visitor actually receives: every `href`, `src`, `srcset`, `poster`
 * and form `action` in every generated page, plus the sitemap and robots.txt.
 *
 * What is checked, and why:
 *
 *   1. Internal links  — `/about`, `../features`, `/og-image.jpg` … must map to
 *      a real file in dist/. Both `/about` and `/about/` resolve, because
 *      Astro is configured with `trailingSlash: "ignore"` and the hosts serve
 *      either form from `about/index.html`.
 *   2. Fragment links  — `#main-content`, `/features#nutrition` must point at an
 *      element that genuinely exists in the target document. A "Skip to main
 *      content" link that silently goes nowhere is invisible to Lighthouse and
 *      to a mouse, so it is checked here.
 *   3. External syntax — `http(s)://` URLs must be well formed. This is where a
 *      typo (`htps://`, `http:/x`, a bare `www.…`) is caught; a bare host also
 *      surfaces as a broken *internal* link, with a hint saying so.
 *   4. sitemap*.xml    — every <loc> must resolve to a page in dist/, so the
 *      sitemap can never advertise a URL the site does not serve.
 *   5. robots.txt      — every `Sitemap:` line must point at a file that exists.
 *   6. Metadata        — `og:image`, `og:url`, `twitter:image` and canonical
 *      links are checked like any other reference. A broken share card is a
 *      real bug that no other tool in this repo would notice.
 *
 * External availability is deliberately NOT part of the default run. A 429 from
 * Instagram must never turn a pull request red, so `--external` opts into live
 * HTTP checks and treats 401/403/405/429 as "reachable but restricted" rather
 * than as failures. Use it by hand, or on a schedule.
 *
 * Exit code 0 = clean, 1 = at least one broken reference.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIST = path.resolve(ROOT, option("--dist", "dist"));
const CHECK_EXTERNAL = hasFlag("--external");
const EXTERNAL_TIMEOUT_MS = Number(option("--timeout", "15000"));
const ORIGIN_OVERRIDE = option("--origin", "").replace(/\/+$/, "");

/* ── tiny helpers ─────────────────────────────────────────────────────────── */

/** Resolve HTML character references in an attribute value. */
const decodeEntities = (value) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&");

/** Safe URI decoding — a malformed `%` sequence must not crash the checker. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const posix = (relative) => relative.split(path.sep).join("/");

async function walk(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/* ── a deliberately small HTML scanner ────────────────────────────────────── *
 * No dependency: this only has to survive the HTML that Astro emits, and it
 * must not be fooled by `>` inside an attribute value or by the inline JSON-LD
 * and <style> blocks, whose contents are skipped entirely.
 */

const REF_ATTRIBUTES = {
  a: ["href"],
  area: ["href"],
  link: ["href"],
  script: ["src"],
  img: ["src", "srcset", "imagesrcset"],
  source: ["src", "srcset", "imagesrcset"],
  iframe: ["src"],
  embed: ["src"],
  video: ["src", "poster"],
  audio: ["src"],
  track: ["src"],
  object: ["data"],
  form: ["action"],
  use: ["href", "xlink:href"],
  image: ["href", "xlink:href"],
};

/** Attributes whose value is a comma-separated candidate list. */
const SRCSET_ATTRIBUTES = new Set(["srcset", "imagesrcset"]);

/** <meta> properties whose content is a reference we care about. */
const META_REFERENCES = /^(og:image|og:url|twitter:image|twitter:url)$/i;

/** Quote-aware search for the `>` that closes a tag. */
function findTagEnd(html, from) {
  let quote = null;
  for (let i = from; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return i;
    }
  }
  return -1;
}

const ATTRIBUTE_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

function parseAttributes(source) {
  const attributes = new Map();
  ATTRIBUTE_RE.lastIndex = 0;
  let match;
  while ((match = ATTRIBUTE_RE.exec(source)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (!attributes.has(name)) attributes.set(name, decodeEntities(value));
  }
  return attributes;
}

/**
 * Extract every element, its attributes and the element's offset in the file.
 * `<script>` and `<style>` bodies are skipped so that JSON-LD text and CSS can
 * never be mistaken for markup.
 */
function scanTags(html) {
  const tags = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = findTagEnd(html, lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const end = findTagEnd(html, lt);
    if (end === -1) break;

    const inner = html.slice(lt + 1, end);
    const head = /^([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*)$/.exec(inner);
    if (head) {
      const name = head[1].toLowerCase();
      tags.push({ name, attributes: parseAttributes(head[2]), offset: lt });
      if (name === "script" || name === "style") {
        const close = html.toLowerCase().indexOf(`</${name}`, end);
        i = close === -1 ? end + 1 : close;
        continue;
      }
    }
    i = end + 1;
  }
  return tags;
}

/** Line lookup for a byte offset, computed lazily per document. */
function makeLineLookup(html) {
  const starts = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === "\n") starts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

/* ── classify a reference ─────────────────────────────────────────────────── */

const SKIP_SCHEMES = /^(mailto|tel|sms|data|blob|javascript|about|android-app|ios-app):/i;
/** In-page or template-only schemes — reported, never fatal. */
const SOFT_SCHEMES = /^(javascript):/i;

function classify(raw) {
  const value = raw.trim();
  if (!value) return { kind: "empty", value };
  if (value === "#") return { kind: "skip", value };
  if (value.startsWith("#")) return { kind: "fragment", value, fragment: value.slice(1) };
  if (value.startsWith("//")) return { kind: "external", value, url: `https:${value}` };
  if (SKIP_SCHEMES.test(value)) {
    return { kind: SOFT_SCHEMES.test(value) ? "soft" : "skip", value };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return { kind: "absolute", value, url };
      }
      // Anything else (`htps:`, `htp:`, `htttps:` …) is a scheme no browser
      // will follow. Reporting it catches the classic missing-letter typo that
      // otherwise looks exactly like a working absolute URL.
      return { kind: "unsupported", value, scheme: url.protocol };
    } catch {
      return { kind: "malformed", value };
    }
  }
  // Looks like a bare host — `www.example.com` or `example.com/page`. Almost
  // always a missing scheme rather than a file in dist/, so say so instead of
  // the less helpful "nothing is served at /www.example.com/page". Requires
  // either a `www.` prefix or a path, so that a plain relative filename like
  // `about.html` is still treated as a relative path and reported as missing.
  if (
    /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/|$|\?|#)/.test(value) &&
    (/^www\./i.test(value) || value.includes("/"))
  ) {
    return { kind: "bare-host", value };
  }
  return { kind: "relative", value };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  try {
    await stat(DIST);
  } catch {
    fail(`No build output at ${DIST}. Run "npm run build" first (or pass --dist <dir>).`);
  }

  const files = await walk(DIST);
  if (files.length === 0) fail(`${DIST} exists but is empty — run "npm run build".`);

  /* URL → file map, including the bare and trailing-slash forms of every page. */
  const urlIndex = new Map();
  for (const file of files) {
    const relative = posix(path.relative(DIST, file));
    urlIndex.set(`/${relative}`, file);
    if (relative === "index.html" || relative.endsWith("/index.html")) {
      const directory = `/${relative.slice(0, -"index.html".length)}`;
      urlIndex.set(directory, file);
      if (directory !== "/") urlIndex.set(directory.replace(/\/$/, ""), file);
    }
  }

  const htmlFiles = files.filter((file) => file.toLowerCase().endsWith(".html"));

  /* Anchors, per document. */
  const anchorsByFile = new Map();
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const anchors = new Set();
    for (const tag of scanTags(html)) {
      const id = tag.attributes.get("id");
      if (id) anchors.add(id);
      if (tag.name === "a") {
        const name = tag.attributes.get("name");
        if (name) anchors.add(name);
      }
    }
    anchorsByFile.set(file, anchors);
  }

  /* Canonical origin: read it back out of the build so the checker agrees with
     whatever PUBLIC_SITE_URL the build used, instead of guessing. */
  let origin = ORIGIN_OVERRIDE;
  if (!origin) {
    const sitemapFile = files.find((file) => /sitemap.*\.xml$/i.test(file));
    if (sitemapFile) {
      const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(await readFile(sitemapFile, "utf8"));
      if (loc) {
        try {
          origin = new URL(loc[1]).origin;
        } catch {
          /* fall through to the documented default */
        }
      }
    }
  }
  origin = origin || "https://healthaali.in";

  const errors = [];
  const warnings = [];
  const externals = new Map(); // url → first place it was seen
  let references = 0;

  const report = (bucket, file, line, message) =>
    bucket.push({ file: posix(path.relative(ROOT, file)), line, message });

  /**
   * Resolve one reference. `documentUrl` is the URL path of the page that
   * contains it, so relative links and fragments resolve against the right base.
   */
  function checkReference(file, line, label, raw, { documentUrl, anchors }) {
    references++;
    const found = classify(raw);

    switch (found.kind) {
      case "skip":
        return;
      case "empty":
        report(warnings, file, line, `${label}="${raw}" is empty`);
        return;
      case "soft":
        report(warnings, file, line, `${label}="${raw}" — javascript: URLs break middle-click and copy-link`);
        return;
      case "malformed":
      case "bare-host":
        report(
          errors,
          file,
          line,
          `${label}="${raw}" is not a valid URL` +
            (found.kind === "bare-host" ? " — a missing scheme looks like this, e.g. https://" : "")
        );
        return;
      case "unsupported":
        report(
          errors,
          file,
          line,
          `${label}="${raw}" — no browser follows the "${found.scheme}" scheme` +
            (found.scheme.startsWith("ht") ? " (did you mean https:// ?)" : "")
        );
        return;
      case "fragment": {
        const target = safeDecode(found.fragment);
        if (!anchors.has(target)) {
          report(errors, file, line, `${label}="${raw}" — no element with id="${target}" in this page`);
        }
        return;
      }
      case "external":
      case "absolute": {
        if (found.kind === "external" || found.kind === "absolute") {
          const url = found.url ?? found.value;
          try {
            const parsed = new URL(url);
            if (parsed.origin !== origin) {
              if (!parsed.hostname) {
                report(errors, file, line, `${label}="${raw}" has no host`);
                return;
              }
              if (!externals.has(parsed.href)) externals.set(parsed.href, { file, line, label });
              return;
            }
            checkPath(parsed.pathname, parsed.hash, file, line, label, raw);
          } catch {
            report(errors, file, line, `${label}="${raw}" is not a valid absolute URL`);
          }
        }
        return;
      }
      default: {
        let pathname;
        try {
          pathname = new URL(found.value, `https://internal.invalid${documentUrl}`).pathname;
        } catch {
          report(errors, file, line, `${label}="${raw}" cannot be resolved`);
          return;
        }
        const hash = found.value.includes("#")
          ? found.value.slice(found.value.indexOf("#") + 1)
          : "";
        checkPath(pathname, hash ? `#${hash}` : "", file, line, label, raw);
      }
    }
  }

  function checkPath(pathname, hash, file, line, label, raw) {
    const clean = safeDecode(pathname);
    const target =
      urlIndex.get(clean) ??
      urlIndex.get(clean.replace(/\/$/, "")) ??
      (clean.endsWith("/") ? undefined : urlIndex.get(`${clean}/`));

    if (!target) {
      report(errors, file, line, `${label}="${raw}" — nothing is served at "${clean}"`);
      return;
    }
    if (hash && hash.length > 1) {
      const anchors = anchorsByFile.get(target);
      if (!anchors) {
        report(warnings, file, line, `${label}="${raw}" — fragment on a non-HTML file is ignored`);
        return;
      }
      const id = safeDecode(hash.slice(1));
      if (!anchors.has(id)) {
        report(
          errors,
          file,
          line,
          `${label}="${raw}" — "${clean}" has no element with id="${id}"`
        );
      }
    }
  }

  /* ── every generated page ─────────────────────────────────────────────── */
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const lineOf = makeLineLookup(html);
    const relative = posix(path.relative(DIST, file));
    const documentUrl = `/${relative === "index.html" ? "" : relative}`;
    const anchors = anchorsByFile.get(file);

    for (const tag of scanTags(html)) {
      const names = REF_ATTRIBUTES[tag.name];
      if (names) {
        for (const name of names) {
          const value = tag.attributes.get(name);
          if (value === undefined) continue;
          const line = lineOf(tag.offset);
          if (SRCSET_ATTRIBUTES.has(name)) {
            for (const candidate of value.split(",")) {
              const url = candidate.trim().split(/\s+/)[0];
              if (url) checkReference(file, line, `${tag.name}[${name}]`, url, { documentUrl, anchors });
            }
          } else {
            checkReference(file, line, `${tag.name}[${name}]`, value, { documentUrl, anchors });
          }
        }
      }

      if (tag.name === "meta") {
        const key = tag.attributes.get("property") ?? tag.attributes.get("name") ?? "";
        const content = tag.attributes.get("content");
        if (content && META_REFERENCES.test(key)) {
          checkReference(file, lineOf(tag.offset), `meta[${key}]`, content, { documentUrl, anchors });
        }
      }
    }
  }

  /* ── sitemap + robots ─────────────────────────────────────────────────── */
  for (const file of files.filter((f) => /sitemap.*\.xml$/i.test(f))) {
    const xml = await readFile(file, "utf8");
    const lineOf = makeLineLookup(xml);
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)];
    if (locs.length === 0) report(warnings, file, 1, "sitemap contains no <loc> entries");
    for (const match of locs) {
      const line = lineOf(match.index);
      let parsed;
      try {
        parsed = new URL(match[1]);
      } catch {
        report(errors, file, line, `<loc>${match[1]}</loc> is not a valid URL`);
        continue;
      }
      if (parsed.origin !== origin) continue; // a foreign origin is the host's business
      checkPath(parsed.pathname, parsed.hash, file, line, "sitemap <loc>", match[1]);
    }
  }

  const robots = files.find((file) => path.basename(file) === "robots.txt");
  if (robots) {
    const text = await readFile(robots, "utf8");
    const lineOf = makeLineLookup(text);
    for (const match of text.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)) {
      const line = lineOf(match.index);
      let parsed;
      try {
        parsed = new URL(match[1]);
      } catch {
        report(errors, robots, line, `Sitemap: ${match[1]} is not a valid URL`);
        continue;
      }
      if (parsed.origin !== origin) continue;
      checkPath(parsed.pathname, "", robots, line, "Sitemap", match[1]);
    }
  }

  /* ── optional live external check ─────────────────────────────────────── */
  const externalResults = [];
  if (CHECK_EXTERNAL && externals.size > 0) {
    const urls = [...externals.keys()];
    process.stdout.write(`  Checking ${urls.length} external URL(s)…\n`);
    const limit = 5;
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(limit, urls.length) }, async () => {
        while (next < urls.length) {
          const url = urls[next++];
          externalResults.push({ url, ...(await probe(url)) });
        }
      })
    );
  }

  async function probe(url) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; HealThaaliLinkCheck/1.0; +https://healthaali.in/)",
            accept: "text/html,*/*",
          },
        });
        const status = response.status;
        await response.body?.cancel();
        if (status < 400) return { ok: true, status };
        if ([401, 403, 405, 429].includes(status)) return { ok: true, status, restricted: true };
        if (attempt === 2) return { ok: false, status };
      } catch (error) {
        if (attempt === 2) return { ok: false, error: error?.name ?? String(error) };
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
    return { ok: false, error: "unknown" };
  }

  if (CHECK_EXTERNAL) {
    for (const result of externalResults) {
      const where = externals.get(result.url);
      const line = where?.line ?? 1;
      const file = where?.file ?? path.join(ROOT, "(unknown)");
      if (result.ok) {
        if (result.restricted) {
          report(warnings, file, line, `${result.url} → HTTP ${result.status} (restricted to bots; not treated as broken)`);
        }
      } else {
        report(
          errors,
          file,
          line,
          `${result.url} → ${result.status ? `HTTP ${result.status}` : `unreachable (${result.error})`}`
        );
      }
    }
  }

  /* ── report ───────────────────────────────────────────────────────────── */
  const format = (entry) => `  ${entry.file}:${entry.line}\n    ${entry.message}`;

  if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} broken reference(s):\n`);
    console.error(errors.map(format).join("\n"));
  }
  if (warnings.length > 0) {
    console.log(`\n! ${warnings.length} warning(s):\n`);
    console.log(warnings.map(format).join("\n"));
  }

  const pages = htmlFiles.length;
  if (errors.length > 0) {
    console.error(
      `\n✗ Link check failed — ${errors.length} broken of ${references} reference(s) across ${pages} page(s).\n`
    );
    process.exit(1);
  }
  console.log(
    `\n✓ Link check passed — ${references} reference(s) across ${pages} page(s) resolve.` +
      (CHECK_EXTERNAL
        ? ` ${externals.size} external URL(s) probed.`
        : ` ${externals.size} external URL(s) not contacted — add --external to probe them.`) +
      "\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
