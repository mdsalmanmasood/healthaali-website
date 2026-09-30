/**
 * HealThaali — recipe snapshot sync
 * ---------------------------------
 *   npm run recipes              fetch new videos and update the snapshot
 *   npm run recipes -- --dry-run show what would change, write nothing
 *   npm run check:recipes        validate the committed snapshot, offline
 *
 *   --report <path.md>           write a Markdown summary of what this run
 *                                found, for a commit message, a pull request
 *                                body or the GitHub step summary. Written on
 *                                every run, including one that changes
 *                                nothing, so a scheduled job can act on the
 *                                file rather than on an exit code.
 *
 * The recipes section is generated from real, public, structured data: the
 * channel's YouTube Atom feed. No API key, no scraping, no OAuth:
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UC…
 *
 * DESIGN: the build never touches the network.
 *
 * This script is the *only* thing that talks to YouTube. It writes a snapshot
 * (`src/data/recipes.json`) and the thumbnails (`src/assets/recipes/`) into the
 * repository, and the site is then built entirely from those committed files.
 * That keeps CI deterministic and offline, keeps `npm run build` reproducible,
 * and means a YouTube outage can never fail a deploy.
 *
 * A sync with nothing new changes nothing. The `updatedAt` field records when
 * the recipe list last *changed*, not when the script last ran, so re-syncing is
 * byte-for-byte idempotent and a scheduled sync only produces a commit when
 * there is genuinely new content.
 *
 * The snapshot never shrinks on its own.
 *
 * The feed is a rolling window of the ~15 most recent videos, so a naive
 * "replace the file with the feed" sync would silently delete older recipes
 * from the site as new ones are posted. This merges by video id instead:
 * the feed updates and inserts, and only `--prune` (explicitly, and with a
 * warning) removes anything.
 *
 * Nothing about a video is invented or rewritten. Titles and descriptions are
 * stored verbatim as `titleOriginal` / `description`; `title` and `summary` are
 * clearly-derived display copies with hashtags and bare URLs removed, and the
 * verbatim originals are kept alongside them. View counts and star ratings are
 * read by the feed and deliberately NOT stored — a number snapshotted into a
 * repository goes stale, and this site does not publish numbers it cannot
 * stand behind.
 *
 * Instagram has no equivalent public structured feed (its oEmbed and Graph
 * endpoints are token-gated), so Instagram posts are added by hand to
 * `src/data/recipes.json` with `"source": "instagram"`. A sync preserves them.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  SCHEMA_VERSION,
  assertSnapshot,
  sortByPublished,
} from "../src/lib/recipe-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── channel ──────────────────────────────────────────────────────────────── */

/**
 * Verified from the live channel: https://www.youtube.com/@healthaali resolves
 * to this id, and it is the same account linked from src/data/site.ts. Override
 * with `--channel` or the YOUTUBE_CHANNEL_ID environment variable.
 */
const DEFAULT_CHANNEL_ID = "UCg2F-igICHaYvBNwxUwNDHQ";

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const FEED = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
const THUMB = (id, name) => `https://i.ytimg.com/vi/${id}/${name}.jpg`;

/** YouTube serves the real page only to something that looks like a browser. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Preferred thumbnail sizes, best first. The fallbacks may be letterboxed. */
const THUMBNAIL_VARIANTS = ["maxresdefault", "sddefault", "hqdefault"];
const THUMBNAIL_WIDTH = 800;
const SUMMARY_LIMIT = 180;
const REQUEST_TIMEOUT = 25_000;

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT_FILE = path.resolve(ROOT, option("--out", "src/data/recipes.json"));
const ASSET_DIR = path.resolve(ROOT, option("--assets", "src/assets/recipes"));
const CHECK_ONLY = hasFlag("--check");
const DRY_RUN = hasFlag("--dry-run");
const PRUNE = hasFlag("--prune");
const FORCE = hasFlag("--force");
/* Markdown summary destination — see writeReport() below. */
const REPORT = option("--report", null);
const REPORT_MD = REPORT ? path.resolve(ROOT, REPORT) : null;
const CHANNEL_INPUT = option("--channel", process.env.YOUTUBE_CHANNEL_ID ?? DEFAULT_CHANNEL_ID);

/* ── small helpers ────────────────────────────────────────────────────────── */

const log = (message) => process.stdout.write(`${message}\n`);
const fail = (message) => {
  process.stderr.write(`\n✗ ${message}\n\n`);
  process.exit(1);
};

/** Resolve XML character references. */
function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Text of the first `<name>` inside `block`, decoded. */
function text(block, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? decodeEntities(match[1]).trim() : "";
}

/** Value of `attr` on the first `<name …>` inside `block`, decoded. */
function attribute(block, name, attr) {
  const match = new RegExp(`<${name}\\b[^>]*\\b${attr}="([^"]*)"`).exec(block);
  return match ? decodeEntities(match[1]).trim() : "";
}

/**
 * Display title: the video's own words with hashtags removed and whitespace
 * collapsed. Hashtags are channel metadata, not part of the recipe name, and
 * they render badly at card size. Falls back to the verbatim title if removing
 * them would leave nothing, so no recipe can ever lose its name.
 */
function toDisplayTitle(rawTitle) {
  const cleaned = rawTitle
    .replace(/#[^\s#]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s|·,;:–—-]+$/u, "")
    .trim();
  return cleaned.length > 0 ? cleaned : rawTitle;
}

/**
 * One-paragraph teaser for the card. Bare URLs are dropped because they read as
 * noise at card size; the full description is stored separately and used for
 * the video's structured data.
 */
function toSummary(description) {
  const firstParagraph =
    description
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? "";

  const cleaned = firstParagraph
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#[^\s#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= SUMMARY_LIMIT) return cleaned;

  const cut = cleaned.slice(0, SUMMARY_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:.–—-]+$/u, "")}…`;
}

async function get(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { "user-agent": UA, "accept-language": "en-US,en" },
  });
  return response;
}

/** Accept `UC…`, `@handle` or a full channel URL; return a channel id. */
async function resolveChannelId(input) {
  const value = input.trim();
  if (CHANNEL_ID.test(value)) return value;

  const handleMatch = /(?:^|\/)(@[A-Za-z0-9._-]+)$/.exec(value);
  const handle = handleMatch ? handleMatch[1] : null;
  if (!handle) {
    fail(
      `--channel must be a channel id (UC…), an @handle or a channel URL.\n` +
        `  Received: ${JSON.stringify(value)}`
    );
  }

  let response;
  try {
    response = await get(`https://www.youtube.com/${handle}`);
  } catch (error) {
    fail(`Could not reach youtube.com to resolve ${handle}: ${error?.message ?? error}`);
  }
  if (!response.ok) {
    fail(`youtube.com${handle} returned HTTP ${response.status} — is the handle spelling right?`);
  }

  const html = await response.text();
  const found = /"channelId":"(UC[A-Za-z0-9_-]{22})"/.exec(html)?.[1] ?? /"externalId":"(UC[A-Za-z0-9_-]{22})"/.exec(html)?.[1];
  if (!found) {
    fail(
      `Could not find a channel id on the page for ${handle}.\n` +
        "  Pass --channel UC… directly (find it at youtube.com → the channel → About)."
    );
  }
  return found;
}

/** Parse the Atom feed into raw entries. */
function parseFeed(xml) {
  const channelTitle = text(xml, "title");
  const channelUrl =
    /<link rel="alternate" href="([^"]+)"/.exec(xml)?.[1] ?? "";
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

  return {
    channelTitle,
    channelUrl: decodeEntities(channelUrl),
    entries: entries.map((entry) => ({
      id: text(entry, "yt:videoId"),
      titleOriginal: text(entry, "title"),
      published: text(entry, "published"),
      description: text(entry, "media:description"),
      link: attribute(entry, "link", "href"),
    })),
  };
}

/**
 * Download and normalise one thumbnail. Returns the encoded JPEG, or null if no
 * variant could be fetched — the caller treats that as a hard failure, because
 * a recipe whose image is missing must never be written to the snapshot.
 */
async function fetchThumbnail(videoId) {
  for (const variant of THUMBNAIL_VARIANTS) {
    try {
      const response = await get(THUMB(videoId, variant));
      if (!response.ok) continue;
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) continue;

      const bytes = Buffer.from(await response.arrayBuffer());
      // YouTube answers a missing maxresdefault with a tiny placeholder image.
      if (bytes.byteLength < 5000) continue;

      const image = sharp(bytes);
      const meta = await image.metadata();
      if (!meta.width || !meta.height || meta.width < 480 || meta.height < 270) continue;

      const encoded = await image
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer();

      return { bytes: encoded, variant };
    } catch {
      /* try the next variant */
    }
  }
  return null;
}

/* ── modes ────────────────────────────────────────────────────────────────── */

async function readExisting() {
  if (!existsSync(OUT_FILE)) return null;
  try {
    return JSON.parse(await readFile(OUT_FILE, "utf8"));
  } catch (error) {
    fail(`src/data/recipes.json exists but is not valid JSON: ${error.message}`);
  }
}

async function listThumbnails() {
  if (!existsSync(ASSET_DIR)) return [];
  return (await readdir(ASSET_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

/**
 * `--report <path>` — write a Markdown summary of this run.
 *
 * Deliberately written even when nothing changed: the scheduled workflow in
 * `.github/workflows/sync-recipes.yml` reads this file to decide whether to
 * propose a pull request, and appends it to the GitHub step summary so every
 * run leaves a readable record. It reports titles and links, never a raw JSON
 * diff, because a reviewer's question is always "what is new?"
 */
async function writeReport({ changed, added, updated, retained, recipes, channel, feedCount, dryRun }) {
  if (!REPORT_MD) return;

  const lines = [];

  if (changed) {
    lines.push(`### ${added.length > 0 ? `${added.length} new video${added.length === 1 ? "" : "s"}` : "Recipe data changed"} on ${channel.title}`);
    lines.push("");

    for (const recipe of [...added].sort((a, b) => b.published.localeCompare(a.published))) {
      lines.push(`- [${recipe.title}](${recipe.url}) — ${recipe.published.slice(0, 10)}`);
    }

    if (added.length > 0) {
      lines.push("");
      lines.push(
        `The snapshot now lists ${recipes.length} recipe${recipes.length === 1 ? "" : "s"}. ` +
          "Thumbnails are downloaded by the same run."
      );
    }
  } else {
    lines.push("### Nothing new since the last sync");
    lines.push("");
    lines.push(
      `The feed's ${feedCount} video${feedCount === 1 ? "" : "s"} are all already in the snapshot, ` +
        "so no file was written and the working tree is untouched."
    );
  }

  if (updated.length > 0) {
    lines.push("");
    lines.push("#### Retitled or re-dated");
    lines.push("");
    for (const { previous, current } of updated) {
      const what =
        previous.title !== current.title
          ? `retitled: “${previous.title}” → “${current.title}”`
          : `date corrected to ${current.published.slice(0, 10)}`;
      lines.push(`- [${current.title}](${current.url}) — ${what}`);
    }
  }

  if (retained.length > 0) {
    lines.push("");
    lines.push("#### Kept although the feed no longer lists them");
    lines.push("");
    lines.push(
      "The feed only covers recent uploads, so an absent video means \"older than the " +
        "feed window\", not \"deleted\". Nothing is ever removed automatically:"
    );
    lines.push("");
    for (const recipe of retained) {
      lines.push(`- ${recipe.title} (\`${recipe.id}\`)`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `<sub>Source: [${channel.title}](${channel.url}) · channel \`${channel.id}\` · ` +
      `generated by \`scripts/sync-recipes.mjs\`${dryRun ? " (dry run — nothing written)" : ""}</sub>`
  );
  lines.push("");

  try {
    await mkdir(path.dirname(REPORT_MD), { recursive: true });
    await writeFile(REPORT_MD, lines.join("\n"));
  } catch (error) {
    /* The snapshot itself is already written and valid; a report that cannot be
       written must not look like a failed sync. */
    log(`  note: could not write the report to ${REPORT_MD}: ${error.message}`);
  }
}

/** `npm run check:recipes` — validate what is committed, without the network. */
async function checkOnly() {
  const snapshot = await readExisting();
  if (!snapshot) {
    fail(
      `No snapshot at ${path.relative(ROOT, OUT_FILE)}.\n` +
        "  Run `npm run recipes` (needs network) to create it, or remove the recipes section."
    );
  }

  const thumbnails = await listThumbnails();
  try {
    assertSnapshot(snapshot, { thumbnails });
  } catch (error) {
    fail(error.message);
  }

  const orphans = thumbnails.filter(
    (name) => !snapshot.recipes.some((recipe) => recipe.thumbnail === name)
  );
  log(
    `✓ Recipe snapshot is valid — ${snapshot.recipes.length} recipe(s), ` +
      `${thumbnails.length - orphans.length} thumbnail(s) present.`
  );
  if (orphans.length > 0) {
    log(`  note: ${orphans.length} unused file(s) in src/assets/recipes/ (not referenced by any recipe).`);
  }
  return;
}

async function sync() {
  const channelId = await resolveChannelId(CHANNEL_INPUT);
  log(`\nSyncing recipes from YouTube channel ${channelId}\n`);

  const feedResponse = await get(FEED(channelId)).catch((error) => {
    fail(`Could not reach the YouTube feed: ${error?.message ?? error}`);
  });
  if (!feedResponse.ok) {
    fail(`The YouTube feed returned HTTP ${feedResponse.status}.`);
  }

  const feed = parseFeed(await feedResponse.text());
  if (feed.entries.length === 0) {
    log("  The feed is empty — nothing to add. The existing snapshot is left untouched.");
  }
  if (feed.channelTitle.toLowerCase() !== "healthaali") {
    log(`  note: the feed belongs to "${feed.channelTitle}" — check --channel if that is a surprise.`);
  }

  const existing = await readExisting();
  const previous = existing?.recipes ?? [];
  const byId = new Map(previous.map((recipe) => [recipe.id, recipe]));

  const feedIds = new Set();
  let added = 0;
  let updated = 0;
  /* Kept for the report, so a reviewer reads titles rather than a JSON diff. */
  const addedRecipes = [];
  const updatedRecipes = [];

  for (const entry of feed.entries) {
    if (!entry.id) {
      fail("The feed contains an entry without a video id — refusing to write a partial snapshot.");
    }
    if (!entry.titleOriginal) {
      fail(`Video ${entry.id} has no title in the feed — refusing to write a partial snapshot.`);
    }

    feedIds.add(entry.id);
    const recipe = {
      id: entry.id,
      source: "youtube",
      title: toDisplayTitle(entry.titleOriginal),
      titleOriginal: entry.titleOriginal,
      // The feed's own link is authoritative (it is /shorts/… for Shorts and
      // /watch?v=… otherwise); fall back to the canonical watch URL.
      url: entry.link || `https://www.youtube.com/watch?v=${entry.id}`,
      published: new Date(entry.published).toISOString(),
      summary: toSummary(entry.description),
      description: entry.description,
      thumbnail: `${entry.id}.jpg`,
    };

    const before = byId.get(entry.id);
    if (!before) {
      added++;
      addedRecipes.push(recipe);
    } else if (before.title !== recipe.title || before.published !== recipe.published) {
      updated++;
      updatedRecipes.push({ previous: before, current: recipe });
    }
    byId.set(entry.id, recipe);
  }

  const retained = previous.filter((recipe) => !feedIds.has(recipe.id));

  if (PRUNE && retained.length > 0) {
    fail(
      `--prune would remove ${retained.length} recipe(s) that are still on the site ` +
        `(${retained.map((r) => r.id).join(", ")}).\n` +
        "  The feed only lists the most recent videos, so an absent video usually means\n" +
        "  \"older than the feed window\", not \"deleted\". Remove them from the JSON by hand\n" +
        "  if you really mean it, then run the sync again."
    );
  }

  const recipes = sortByPublished([...byId.values()]);

  /* Thumbnails: fetch only what is missing. Never rewrite an existing file
     unless --force, so a routine sync produces no binary churn. */
  await mkdir(ASSET_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;

  for (const recipe of recipes) {
    const target = path.join(ASSET_DIR, recipe.thumbnail);
    if (existsSync(target) && !FORCE) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      log(`  would fetch thumbnail for ${recipe.id} (${recipe.title.slice(0, 50)})`);
      downloaded++;
      continue;
    }

    const thumbnail = await fetchThumbnail(recipe.id);
    if (!thumbnail) {
      fail(
        `Could not fetch a usable thumbnail for ${recipe.id} (${THUMB(recipe.id, THUMBNAIL_VARIANTS[0])}).\n` +
          "  Nothing was written. Re-run, or drop that recipe from src/data/recipes.json."
      );
    }
    await writeFile(target, thumbnail.bytes);
    downloaded++;
  }

  const channel = {
    id: channelId,
    title: feed.channelTitle || existing?.channel?.title || "HealThaali",
    url: feed.channelUrl || `https://www.youtube.com/channel/${channelId}`,
  };

  /* `updatedAt` means "when the recipe list last changed", not "when this ran".
     Preserving it across a no-op sync keeps the file byte-identical, so a
     routine sync leaves the working tree clean and a scheduled job produces a
     commit only when there is genuinely new content. */
  const stable = (value) =>
    JSON.stringify({ v: value?.schemaVersion, c: value?.channel, r: value?.recipes });
  // A previous snapshot missing `updatedAt` (an older schema, or a hand-written
  // file) counts as changed, so a fresh timestamp is written rather than the
  // previous value being copied through as `undefined`.
  const previousUpdatedAt = typeof existing?.updatedAt === "string" ? existing.updatedAt : null;
  const unchanged =
    previousUpdatedAt !== null &&
    Boolean(existing) &&
    stable(existing) === stable({ schemaVersion: SCHEMA_VERSION, channel, recipes });

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: unchanged ? previousUpdatedAt : new Date().toISOString(),
    channel,
    recipes,
  };

  const thumbnails = DRY_RUN
    ? { thumbnails: [...(await listThumbnails()), ...recipes.map((r) => r.thumbnail)] }
    : { thumbnails: await listThumbnails() };

  try {
    assertSnapshot(snapshot, thumbnails);
  } catch (error) {
    fail(`The generated snapshot would be invalid, so nothing was written.\n  ${error.message}`);
  }

  log(`  from feed    ${feed.entries.length} video(s) (${added} new, ${updated} updated)`);
  if (retained.length > 0) {
    log(`  retained     ${retained.length} recipe(s) no longer in the feed window`);
  }
  log(`  thumbnails   ${downloaded} fetched, ${skipped} already present`);
  log(`  total        ${recipes.length} recipe(s)`);

  /*
    "Changed" is a byte comparison of the file, not a count of feed items: a
    video whose title was reworded on YouTube, or a re-run on another day,
    produces the same file and must not look like news to a scheduled job.
  */
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  const previousJson = existsSync(OUT_FILE) ? await readFile(OUT_FILE, "utf8") : "";
  const changed = json !== previousJson;

  await writeReport({
    changed,
    added: addedRecipes,
    updated: updatedRecipes,
    retained,
    recipes,
    channel,
    feedCount: feed.entries.length,
    dryRun: DRY_RUN,
  });

  if (DRY_RUN) {
    log("\n--dry-run: nothing was written.\n");
    return;
  }

  if (!changed) {
    log("\n✓ Snapshot already up to date — no change written.\n");
    return;
  }
  await writeFile(OUT_FILE, json);
  log(`\n✓ Wrote ${path.relative(ROOT, OUT_FILE)} (${recipes.length} recipe(s)).\n`);
}

if (CHECK_ONLY) {
  await checkOnly();
} else {
  await sync();
}
