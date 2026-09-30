/**
 * The single place a blog post's URL slug is decided.
 *
 * Two callers use this: the collection's `generateId` (which turns a file into
 * an entry id) and `src/data/blog.ts` (which checks the whole directory for
 * collisions). They must agree exactly — if they were separate
 * implementations, a file could collide for one and not the other, and the
 * result would be a silently wrong URL.
 *
 * Rules, applied in order:
 *
 *   1. drop the `.md` / `.mdx` extension
 *   2. lowercase everything
 *   3. runs of spaces or underscores become a single "-"
 *   4. anything that is not a letter, a digit, "-" or "/" is removed
 *   5. repeated "-" and "//" collapse
 *   6. leading and trailing separators are trimmed
 *
 * Directory separators survive, so `kitchen/less-oil.md` publishes at
 * `/blog/kitchen/less-oil` rather than being flattened.
 *
 * Note that Astro's own default would happily take a `slug:` key from the
 * frontmatter and use it verbatim. This module is used as an explicit
 * `generateId`, so the file name is the only thing that decides a URL — which
 * is also what makes the collision check below exhaustive.
 */

export const blogContentDir = "src/content/blog";

export const slugFromPostPath = (entryPath: string): string =>
  entryPath
    .replace(/\.(md|mdx)$/i, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9/-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-/]+|[-/]+$/g, "");

/**
 * A tag's slug, derived from the same rules as a post's.
 *
 * The one difference is that a tag is always a *single* URL segment, so any
 * directory separator becomes a dash: `/blog/tag/high-protein` is a topic,
 * whereas `/blog/tag/high/protein` would be a nested path the route could not
 * even match. "High protein", "high-protein" and "high_protein" therefore all
 * collapse to the same topic page — which is the intended behaviour, and why
 * `collectTags` fails the build if two differently-spelled tags collide.
 */
export const tagSlug = (tag: string): string => slugFromPostPath(tag).replace(/\//g, "-");

/**
 * The URL segment reserved for tag pages. A post published under `tag/…` would
 * land on the same URLs, so `src/data/blog.ts` refuses it.
 */
export const tagSegment = "tag";
