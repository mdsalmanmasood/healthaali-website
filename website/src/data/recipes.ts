/**
 * Recipes — typed access to the generated snapshot.
 *
 * The data in `recipes.json` is produced by `npm run recipes` from the
 * channel's public YouTube feed, and the thumbnails in `src/assets/recipes/`
 * are downloaded by the same command. Nothing here fetches anything: the build
 * reads only committed files, so it is deterministic, offline and reproducible.
 *
 * Validation happens at import time, which means during `astro build` and
 * `astro dev`. A malformed snapshot — a missing title, a duplicate id, a
 * thumbnail that was not downloaded — fails the build with the exact field at
 * fault instead of shipping a broken card. The validator is shared with the
 * sync script (`src/lib/recipe-schema.mjs`), so the two can never disagree
 * about what "valid" means.
 */

import type { ImageMetadata } from "astro";
import snapshot from "./recipes.json";
import { assertSnapshot, sortByPublished } from "../lib/recipe-schema.mjs";
import { siteUrl } from "./site";

/**
 * Thumbnails, resolved by Vite so Astro optimises them at build time (AVIF/WebP,
 * correct intrinsic dimensions, `srcset`). They are local files rather than
 * `i.ytimg.com` hotlinks on purpose: the site's CSP allows `img-src 'self' data:`,
 * and a remote image would also make every build depend on YouTube.
 */
const thumbnails = import.meta.glob<ImageMetadata>("../assets/recipes/*.jpg", {
  eager: true,
  import: "default",
});

const byFileName = new Map(
  Object.entries(thumbnails).map(([file, image]) => [file.slice(file.lastIndexOf("/") + 1), image])
);

const validated = assertSnapshot(snapshot, { thumbnails: [...byFileName.keys()] });

export interface Recipe {
  /** YouTube video id. */
  id: string;
  source: "youtube" | "instagram";
  /** Display title: hashtags removed. Safe to render. */
  title: string;
  /** The video's own title, verbatim. Kept for traceability, never rendered. */
  titleOriginal: string;
  url: string;
  /** ISO-8601 instant. */
  published: string;
  /** One-paragraph teaser. May be empty, in which case render no teaser. */
  summary: string;
  /** Verbatim description, used for structured data. */
  description: string;
  /** Optimised thumbnail, resolved from the committed file. */
  image: ImageMetadata;
}

/** Newest first. */
export const recipes: Recipe[] = sortByPublished(validated.recipes).map((recipe) => ({
  ...recipe,
  // Asserted rather than optional: assertSnapshot already proved every
  // thumbnail is on disk, so a miss here would be a bug in this file.
  image: byFileName.get(recipe.thumbnail)!,
}));

/** The section hides itself entirely when there is nothing real to show. */
export const hasRecipes = recipes.length > 0;

/** Provenance, shown on the page so the source of the content is never ambiguous. */
export const recipeChannel = validated.channel;
export const recipesUpdatedAt = validated.updatedAt;

export const latestRecipes = (count: number): Recipe[] => recipes.slice(0, count);

/** `13 September 2026` — locale pinned so the build output does not vary by machine. */
export const formatRecipeDate = (published: string): string =>
  new Date(published).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** The listing page. */
export const recipesPath = "/recipes";

/**
 * Where one dish's own page lives: `/recipes/<video id>`.
 *
 * The address is built from the video id and not from the title. A title is
 * whatever the channel called the video and can be edited on YouTube at any
 * time, after which the next sync would rewrite it — and every URL, sitemap
 * entry and inbound link built from it would move. The id is permanent, so the
 * address is too. The words a visitor actually searches for belong in the
 * page's title, heading and description, which is where they are.
 */
export const recipePath = (recipe: Recipe): string => `${recipesPath}/${recipe.id}`;

/** `@id` of the ItemList on /recipes, so a dish page can point back at it. */
export const recipeListId = `${siteUrl}${recipesPath}#videos`;

/**
 * Can this dish be played on this site?
 *
 * Only YouTube entries can. The player in `BaseLayout.astro` builds a
 * `youtube-nocookie.com` frame from an 11-character id, and the snapshot's
 * schema also allows hand-added Instagram entries, which have neither. Those
 * link out to where the video really is, and both the card and the page say so
 * instead of rendering a player that would never load.
 */
export const isEmbeddable = (recipe: Recipe): boolean => recipe.source === "youtube";

/**
 * How a dish's source is named to a reader. Written out here rather than
 * capitalising the snapshot's value, so a new source added to the schema reads
 * as a name a person would recognise instead of as a raw key.
 */
export const sourceName = (recipe: Recipe): string =>
  recipe.source === "instagram" ? "Instagram" : "YouTube";

/** The `<iframe>` title — what the player is called to someone who cannot see it. */
export const recipeVideoTitle = (recipe: Recipe): string =>
  `${recipe.title} — HealThaali recipe video`;

/**
 * Text for the button the player script builds. The video's own title is a
 * sentence; on a card it needs to say what pressing it does.
 */
export const recipeVideoLabel = (recipe: Recipe): string => `Play “${recipe.title}”`;

/**
 * The description published with the video, split into readable paragraphs.
 *
 * This is the channel's own text, rendered as published. Nothing on this site
 * has watched the video and restated it — a page that invented quantities, or
 * compiled an ingredient list from a title, would be guessing on the reader's
 * behalf. The only edit is subtractive: a line that is nothing but hashtags is
 * dropped, because those are metadata for the platform rather than prose.
 */
const HASHTAG_ONLY = /^(?:#\S+\s*)+$/;

export const descriptionParagraphs = (recipe: Recipe): string[] =>
  recipe.description
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !HASHTAG_ONLY.test(line));

/**
 * Up to `count` other dishes, taken in published order from this one and
 * wrapping at the end, so every dish gets the same neighbours on every build
 * (a random or time-dependent pick would churn the generated pages).
 */
export const neighbouringRecipes = (recipe: Recipe, count: number): Recipe[] => {
  const start = recipes.findIndex((entry) => entry.id === recipe.id);
  if (start === -1) return recipes.slice(0, count);

  const others: Recipe[] = [];
  for (let step = 1; step < recipes.length && others.length < count; step += 1) {
    const candidate = recipes[(start + step) % recipes.length];
    if (candidate.id !== recipe.id) others.push(candidate);
  }
  return others;
};
