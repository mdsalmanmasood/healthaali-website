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
