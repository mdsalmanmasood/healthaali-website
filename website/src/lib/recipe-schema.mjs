/**
 * Recipe snapshot schema — the single source of truth for the shape of
 * `src/data/recipes.json`.
 *
 * Plain ESM with JSDoc types and no dependency on TypeScript, Astro or any
 * Node API, so the *same* validator runs in two places:
 *
 *   - `src/data/recipes.ts`, i.e. during `astro build` and `astro dev`, where a
 *     malformed snapshot must fail loudly instead of rendering a broken page.
 *   - `scripts/sync-recipes.mjs`, before it writes anything, so bad data never
 *     reaches the repository in the first place.
 *
 * Deliberately not duplicated: two validators that drift apart are worse than
 * no validator, because they make the data look safe while it is not.
 *
 * Everything about this file is about failing *early and precisely*. A recipe
 * page that renders a card with an empty title, a dead video link or a missing
 * thumbnail is exactly the class of bug this exists to prevent.
 */

/** Bumped when the shape changes incompatibly. */
export const SCHEMA_VERSION = 1;

/** YouTube ids are exactly 11 characters of this alphabet. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** ISO-8601 UTC instant, e.g. 2026-09-13T04:44:32.000Z. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const YOUTUBE_URL = /^https:\/\/(?:www\.)?youtube\.com\/\S+$/;

/** Sources a recipe may come from. Instagram entries are hand-added. */
export const RECIPE_SOURCES = ["youtube", "instagram"];

/**
 * @typedef {object} RecipeChannel
 * @property {string} id
 * @property {string} title
 * @property {string} url
 */

/**
 * @typedef {object} Recipe
 * @property {string} id
 * @property {"youtube" | "instagram"} source
 * @property {string} title          Display title: hashtags stripped, whitespace collapsed.
 * @property {string} titleOriginal  The video's own title, verbatim. Never rendered.
 * @property {string} url
 * @property {string} published      ISO-8601 UTC instant.
 * @property {string} summary        One-paragraph teaser, derived. May be empty.
 * @property {string} description    Verbatim description, for structured data.
 * @property {string} thumbnail      File name inside src/assets/recipes/.
 */

/**
 * @typedef {object} RecipeSnapshot
 * @property {number} schemaVersion
 * @property {string} updatedAt  When the recipe list last *changed* — see the sync script.
 * @property {RecipeChannel} channel
 * @property {Recipe[]} recipes
 */

export class RecipeDataError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "RecipeDataError";
  }
}

/** @param {unknown} value */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string}
 */
function requireString(value, path) {
  if (typeof value !== "string") {
    throw new RecipeDataError(`${path} must be a string, received ${describe(value)}`);
  }
  if (value.trim().length === 0) {
    throw new RecipeDataError(`${path} must not be empty`);
  }
  return value;
}

/** @param {unknown} value */
function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  if (typeof value === "string") return `the string ${JSON.stringify(value.slice(0, 40))}`;
  return `${typeof value} ${String(value)}`;
}

/**
 * Validate a whole snapshot, throwing a `RecipeDataError` that names the exact
 * field at fault.
 *
 * @param {unknown} snapshot
 * @param {{ thumbnails?: Set<string> | string[] }} [options]
 *   `thumbnails` is the set of file names present in src/assets/recipes/. When
 *   supplied, every recipe's thumbnail must be in it. Callers that cannot see
 *   the filesystem (nothing here) may omit it.
 * @returns {RecipeSnapshot}
 */
export function assertSnapshot(snapshot, options = {}) {
  if (!isRecord(snapshot)) {
    throw new RecipeDataError(`snapshot must be an object, received ${describe(snapshot)}`);
  }

  const { schemaVersion, updatedAt, channel, recipes } = /** @type {Record<string, unknown>} */ (snapshot);

  if (schemaVersion !== SCHEMA_VERSION) {
    throw new RecipeDataError(
      `schemaVersion must be ${SCHEMA_VERSION}, received ${describe(schemaVersion)}. ` +
        "Re-run `npm run recipes` to regenerate the snapshot."
    );
  }

  requireString(updatedAt, "updatedAt");
  if (!ISO_INSTANT.test(String(updatedAt))) {
    throw new RecipeDataError(`updatedAt must be an ISO-8601 UTC instant, received "${updatedAt}"`);
  }

  if (!isRecord(channel)) {
    throw new RecipeDataError(`channel must be an object, received ${describe(channel)}`);
  }
  const channelId = requireString(channel.id, "channel.id");
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    throw new RecipeDataError(`channel.id "${channelId}" is not a YouTube channel id (UC + 22 chars)`);
  }
  requireString(channel.title, "channel.title");
  const channelUrl = requireString(channel.url, "channel.url");
  if (!YOUTUBE_URL.test(channelUrl)) {
    throw new RecipeDataError(`channel.url "${channelUrl}" is not a youtube.com URL`);
  }

  if (!Array.isArray(recipes)) {
    throw new RecipeDataError(`recipes must be an array, received ${describe(recipes)}`);
  }

  const available = options.thumbnails ? new Set(options.thumbnails) : null;
  /** @type {Set<string>} */
  const seen = new Set();

  recipes.forEach((raw, index) => {
    const at = `recipes[${index}]`;
    if (!isRecord(raw)) {
      throw new RecipeDataError(`${at} must be an object, received ${describe(raw)}`);
    }

    const id = requireString(raw.id, `${at}.id`);
    if (!VIDEO_ID.test(id)) {
      throw new RecipeDataError(
        `${at}.id "${id}" is not a YouTube video id (11 characters of A-Z a-z 0-9 _ -)`
      );
    }
    if (seen.has(id)) {
      throw new RecipeDataError(`${at}.id "${id}" is duplicated — every recipe needs a unique id`);
    }
    seen.add(id);

    if (!RECIPE_SOURCES.includes(String(raw.source))) {
      throw new RecipeDataError(
        `${at}.source must be one of ${RECIPE_SOURCES.join(", ")}, received ${describe(raw.source)}`
      );
    }

    requireString(raw.title, `${at}.title`);
    requireString(raw.titleOriginal, `${at}.titleOriginal`);

    const url = requireString(raw.url, `${at}.url`);
    if (!YOUTUBE_URL.test(url) && !/^https:\/\/(?:www\.)?instagram\.com\/\S+$/.test(url)) {
      throw new RecipeDataError(`${at}.url "${url}" is not a youtube.com or instagram.com URL`);
    }

    const published = requireString(raw.published, `${at}.published`);
    if (!ISO_INSTANT.test(published) || Number.isNaN(Date.parse(published))) {
      throw new RecipeDataError(`${at}.published "${published}" is not a valid ISO-8601 UTC instant`);
    }

    // `summary` is the only field allowed to be empty: some descriptions start
    // with a blank line, and an empty teaser must render as no teaser at all.
    if (typeof raw.summary !== "string") {
      throw new RecipeDataError(`${at}.summary must be a string, received ${describe(raw.summary)}`);
    }
    if (typeof raw.description !== "string") {
      throw new RecipeDataError(`${at}.description must be a string, received ${describe(raw.description)}`);
    }

    const thumbnail = requireString(raw.thumbnail, `${at}.thumbnail`);
    if (thumbnail.includes("/") || thumbnail.includes("\\")) {
      throw new RecipeDataError(`${at}.thumbnail "${thumbnail}" must be a file name, not a path`);
    }
    if (available && !available.has(thumbnail)) {
      throw new RecipeDataError(
        `${at}.thumbnail "${thumbnail}" does not exist in src/assets/recipes/. ` +
          "Run `npm run recipes` to fetch it, or remove the recipe."
      );
    }
  });

  return /** @type {RecipeSnapshot} */ (snapshot);
}

/**
 * Sort newest first. Ties break on id so the order is stable across runs —
 * a non-deterministic sort would churn the generated file and the sitemap.
 *
 * @param {Recipe[]} recipes
 * @returns {Recipe[]}
 */
export function sortByPublished(recipes) {
  return [...recipes].sort((a, b) => {
    const delta = Date.parse(b.published) - Date.parse(a.published);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}
