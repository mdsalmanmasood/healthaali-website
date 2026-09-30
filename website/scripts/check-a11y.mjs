/**
 * HealThaali — accessibility gate (axe-core, in a real browser)
 * -------------------------------------------------------------
 *   npm run check:a11y
 *
 * Fails the build if any page violates a WCAG A/AA success criterion that is
 * mechanically testable. axe-core is the same engine behind Lighthouse's
 * accessibility category, run here directly, which buys three things:
 *
 *   1. **It is reliable on Windows.** Lighthouse's runner exits non-zero when
 *      chrome-launcher fails to delete its temporary Chrome profile *after* a
 *      successful audit (`EPERM ... rmdir lighthouse.NNNN`). Nothing in
 *      Lighthouse's configuration avoids that, so `npm run verify` would fail
 *      at random on a developer machine while passing in CI. This script
 *      decides its exit code from the collected results and treats teardown as
 *      best-effort, so a cleanup warning can never fail the gate.
 *   2. **It tests both colour schemes.** Every page is audited with
 *      `prefers-color-scheme` forced to light *and* dark, because dark-mode
 *      contrast has regressed here before and a single-scheme audit would miss
 *      half of the design.
 *   3. **It says what to fix.** Each finding reports the rule, its impact, the
 *      WCAG criterion, the CSS selector and axe's own explanation.
 *
 * It is also a lot smaller: Lighthouse CI pulled in 312 packages and seven
 * high-severity advisories; axe-core and puppeteer-core pull in none. No
 * browser is downloaded — Chrome is discovered on the machine (or pointed at
 * with CHROME_PATH / --chrome).
 *
 * Scope: every rule tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` or
 * `wcag22aa` — the WCAG 2.0/2.1/2.2 A and AA criteria. axe's `best-practice`
 * rules are deliberately excluded: they are advice rather than conformance, and
 * gating on them would make the build red for style opinions. Anything axe
 * could not decide (`incomplete`) is printed as a warning for a human, not
 * treated as a violation.
 *
 * The rule ids are resolved from axe by tag at startup rather than listed by
 * hand, so they follow the engine. Note that this selects by *id*, not with
 * `runOnly: {type: "tag"}`: a tag-only run quietly drops the rules axe marks
 * `experimental`, and `label-content-name-mismatch` — the rule that once caught
 * a real defect here — is one of those.
 *
 * Known limitation, and the reason the `incomplete` list matters: on this site
 * `color-contrast` comes back `incomplete` for text sitting over a decorative
 * `::before` gradient (the hero and the CTA band). axe refuses to guess a
 * background colour it cannot compute, so those elements are reported here in
 * full — rule and selector — instead of being scored. A green run therefore
 * means "no violation of any WCAG A/AA rule axe could decide", and if you
 * change a colour token you should read that list before believing it.
 *
 * Closing that gap properly needs pixel sampling of the rendered element, which
 * would have to avoid reproducing the decorative gradient's own logic; it is
 * left out on purpose rather than approximated with an answer that could be
 * confidently wrong.
 */

import { createServer } from "node:http";
import { readdir, readFile, stat, rm, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const axe = require("axe-core");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIST = path.resolve(ROOT, option("--dist", "dist"));
const CHROME_OVERRIDE = option("--chrome", process.env.CHROME_PATH ?? process.env.CHROME_BIN ?? "");
const NAV_TIMEOUT = Number(option("--timeout", "30000"));

/** WCAG 2.0 / 2.1 / 2.2 level A and AA criteria (axe tags that exist). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * The rule ids behind those tags, resolved from the engine at run time.
 *
 * Deliberately not `runOnly: {type: "tag"}`: a tag-only run silently drops the
 * rules axe ships as `experimental`, and `label-content-name-mismatch` — the
 * rule that once caught a real defect on this site's desktop brand link — is
 * one of them. Selecting by id keeps every WCAG A/AA rule, experimental ones
 * included, and tracks the engine instead of a hand-maintained list.
 */
const WCAG_RULES = axe
  .getRules()
  .filter((rule) => (rule.tags ?? []).some((tag) => WCAG_TAGS.includes(tag)))
  .map((rule) => rule.ruleId);

/** Each page is audited once per scheme; dark mode is not optional here. */
const SCHEMES = ["light", "dark"];

/* ── helpers ──────────────────────────────────────────────────────────────── */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const posix = (relative) => relative.split(path.sep).join("/");

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/**
 * The Chrome binary. Discovered rather than downloaded, so this stays a
 * dependency-light devDependency and CI uses the runner's own Chrome.
 */
function findChrome() {
  if (CHROME_OVERRIDE) return existsSync(CHROME_OVERRIDE) ? CHROME_OVERRIDE : "";
  const candidates = {
    win32: [
      `${process.env.PROGRAMFILES ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ],
  }[process.platform] ?? [];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? "";
}

/** Minimal static file server: enough for a local audit, nothing more. */
function serveDist(root) {
  const server = createServer(async (request, response) => {
    const send = (status, body, type) => {
      response.writeHead(status, {
        "content-type": type ?? "text/plain; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    };

    if (request.method !== "GET" && request.method !== "HEAD") return send(405, "Method not allowed");

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      return send(400, "Bad request");
    }

    let resolved = path.resolve(root, `.${pathname}`);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return send(403, "Forbidden");

    try {
      if ((await stat(resolved)).isDirectory()) resolved = path.join(resolved, "index.html");
    } catch {
      /* fall through to the 404 fallback below */
    }

    try {
      const body = await readFile(resolved);
      return send(200, body, MIME[path.extname(resolved).toLowerCase()]);
    } catch {
      // Mirror the real hosts: any unknown path serves dist/404.html with a
      // 404 status, so the error page is audited as it is actually delivered.
      try {
        const body = await readFile(path.join(root, "404.html"));
        return send(404, body, MIME[".html"]);
      } catch {
        return send(404, "Not found");
      }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  try {
    await stat(DIST);
  } catch {
    fail(`No build output at ${DIST}. Run "npm run build" first (or pass --dist <dir>).`);
  }

  const files = await walk(DIST);
  const htmlFiles = files.filter((file) => file.toLowerCase().endsWith(".html"));
  if (htmlFiles.length === 0) fail(`No HTML files in ${DIST} — run "npm run build".`);

  /** Page routes, discovered from the build so new pages are covered for free. */
  const pages = htmlFiles
    .map((file) => {
      const relative = posix(path.relative(DIST, file));
      if (relative === "index.html") return { file, route: "/" };
      if (relative.endsWith("/index.html")) return { file, route: `/${relative.slice(0, -"index.html".length)}` };
      return { file, route: `/${relative}` };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  const chromePath = findChrome();
  if (!chromePath) {
    fail(
      "Could not find a Chrome or Chromium installation.\n" +
        "  Set CHROME_PATH, or pass --chrome <path>."
    );
  }

  console.log(`\nAccessibility audit — ${pages.length} page(s) × ${SCHEMES.length} colour scheme(s)\n`);
  console.log(`  Chrome  ${chromePath}`);
  console.log(`  Engine  axe-core ${require("axe-core/package.json").version}`);
  console.log(`  Rules   ${WCAG_RULES.length} rule(s) tagged ${WCAG_TAGS.join(", ")}`);
  console.log("          (includes axe's experimental rules, e.g. label-content-name-mismatch)\n");

  const { server, port } = await serveDist(DIST);
  let userDataDir = "";
  let browser;
  const findings = [];
  const reviews = [];

  try {
    // Our own profile directory, so teardown is ours to handle gracefully.
    userDataDir = await mkdtemp(path.join(os.tmpdir(), "healthaali-a11y-"));
    browser = await puppeteer.launch({
      executablePath: chromePath,
      userDataDir,
      headless: true,
      protocolTimeout: NAV_TIMEOUT + 15000,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        // Pin the colour space, or wide-gamut displays can shift the colours
        // axe measures and make contrast results machine-dependent.
        "--force-color-profile=srgb",
      ],
    });

    let audits = 0;
    for (const scheme of SCHEMES) {
      for (const page of pages) {
        const page_ = await browser.newPage();
        let result;
        try {
          await page_.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
          await page_.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: scheme },
            // The site is designed to respect this; it also stops a transition
            // from being measured mid-flight.
            { name: "prefers-reduced-motion", value: "reduce" },
          ]);

          const url = `http://127.0.0.1:${port}${page.route}`;
          await page_.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT });
          // Webfonts change text metrics, so wait for them before measuring.
          await page_.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));
          await page_.addScriptTag({ path: AXE_PATH });

          result = await page_.evaluate(
            async (rules) =>
              await window.axe.run(document, {
                runOnly: { type: "rule", values: rules },
                resultTypes: ["violations", "incomplete"],
              }),
            WCAG_RULES
          );
        } catch (error) {
          findings.push({
            route: page.route,
            scheme,
            rule: "(audit failed)",
            impact: "critical",
            help: error?.message ?? String(error),
            tags: [],
            helpUrl: "",
            nodes: [],
          });
          continue;
        } finally {
          try {
            await page_.close();
          } catch {
            /* closing a page must never decide the outcome */
          }
        }

        audits++;
        for (const violation of result.violations ?? []) {
          findings.push({
            route: page.route,
            scheme,
            rule: violation.id,
            impact: violation.impact ?? "unknown",
            help: violation.help,
            tags: violation.tags ?? [],
            helpUrl: violation.helpUrl,
            nodes: (violation.nodes ?? []).map((node) => ({
              target: (node.target ?? []).join(" "),
              summary: node.failureSummary ?? "",
              html: (node.html ?? "").slice(0, 160),
            })),
          });
        }
        for (const review of result.incomplete ?? []) {
          for (const node of review.nodes ?? []) {
            const check = node.any?.[0] ?? node.all?.[0] ?? {};
            reviews.push({
              route: page.route,
              scheme,
              rule: review.id,
              target: (node.target ?? []).join(" "),
              reason: String(check.message ?? "").replace(/\s+/g, " ").trim(),
              expected: check.data?.expectedContrastRatio ?? "",
            });
          }
        }
      }
    }

    /* ── report ─────────────────────────────────────────────────────────── */
    const style = (finding) =>
      [
        `    ${finding.rule}  [${finding.impact}]  ${finding.help}`,
        finding.tags.length ? `      criteria: ${finding.tags.filter((t) => /^wcag\d/.test(t)).join(", ")}` : "",
        finding.helpUrl ? `      ${finding.helpUrl}` : "",
        ...finding.nodes.flatMap((node) => [
          `      → ${node.target}`,
          ...node.summary
            .split("\n")
            .filter(Boolean)
            .map((line) => `        ${line.replace(/\s+/g, " ").trim()}`),
        ]),
      ]
        .filter(Boolean)
        .join("\n");

    if (findings.length > 0) {
      console.error(`\n✗ ${findings.length} accessibility violation(s):\n`);
      const grouped = new Map();
      for (const finding of findings) {
        const key = `${finding.route}  (${finding.scheme})`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(finding);
      }
      console.error([...grouped].map(([key, list]) => `  ${key}\n${list.map(style).join("\n")}`).join("\n\n"));
    }

    if (reviews.length > 0) {
      // Group by selector so the same element is listed once, however many
      // pages and colour schemes it appears on.
      const grouped = new Map();
      for (const review of reviews) {
        const key = `${review.rule}\u0000${review.target}`;
        if (!grouped.has(key)) grouped.set(key, { ...review, places: new Set() });
        grouped.get(key).places.add(`${review.route} ${review.scheme}`);
      }
      const list = [...grouped.values()].sort((a, b) => a.target.localeCompare(b.target));

      console.log(
        `\n! ${list.length} thing(s) axe could NOT decide automatically — not failures,\n` +
          "  but not verified either. They are listed here so they cannot pass unnoticed;\n" +
          "  see the note at the top of scripts/check-a11y.mjs.\n"
      );
      for (const item of list) {
        console.log(`  ${item.rule}  →  ${item.target}`);
        if (item.reason) console.log(`      ${item.reason}${item.expected ? ` (needs ${item.expected})` : ""}`);
        const places = [...item.places];
        console.log(
          `      ${places.length} page audit(s): ${places.slice(0, 4).join(", ")}${places.length > 4 ? ", …" : ""}`
        );
      }
    }

    if (findings.length === 0) {
      console.log(
        `\n✓ Accessibility audit passed — ${audits} page audit(s), no WCAG A/AA violation found.\n`
      );
    } else {
      console.error(
        `\n✗ Accessibility audit failed — ${findings.length} violation(s) across ${audits} page audit(s).\n`
      );
    }

    return findings.length === 0 ? 0 : 1;
  } finally {
    // Best-effort teardown. On Windows, Chrome can still hold its profile
    // directory for a moment after exiting, so a cleanup failure is reported
    // as a note and never as a build failure.
    try {
      if (browser) await browser.close();
    } catch {
      try {
        browser?.process()?.kill("SIGKILL");
      } catch {
        /* nothing left to do */
      }
    }
    try {
      if (userDataDir) await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      console.log(`  note: Chrome profile left at ${userDataDir} (still locked); it is safe to delete.`);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
