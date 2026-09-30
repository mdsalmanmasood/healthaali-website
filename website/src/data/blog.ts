/**
 * Blog posts, read from the `blog` collection and validated before use.
 *
 * Astro already validates the frontmatter shape (see src/content.config.ts).
 * This module adds the checks that need to know *which file* is at fault, plus
 * the derived values the UI wants:
 *
 *   - a URL-safe slug derived from the file name, unique across the collection
 *   - the cover image, resolved from src/assets/blog/ or a loud build failure
 *   - an estimated reading time
 *
 * Every failure here throws during `astro build`, so a malformed post cannot
 * reach production. Nothing is fetched from the network: the blog is built
 * entirely from files in this repository.
 */
import type { ImageMetadata } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

import { slugFromPostPath, tagSegment, tagSlug } from "../lib/post-slug";

import { absoluteUrl } from "./site";

export const blogPath = "/blog";
export const blogFeedPath = "/blog/rss.xml";
export const blogFeedTitle = "HealThaali — notes and recipes";
/** Tag pages live under /blog/tag/<slug>. */
export const blogTagBase = `${blogPath}/${tagSegment}`;
export const blogTagPath = (slug: string): string => `${blogTagBase}/${slug}`;
/** The URL for a tag as written in frontmatter, e.g. "High protein" → /blog/tag/high-protein. */
export const tagHref = (name: string): string => blogTagPath(tagSlug(name));

export type BlogEntry = CollectionEntry<"blog">;

export interface BlogTag {
  /** The tag exactly as written in a post's frontmatter. */
  name: string;
  /** Its URL segment, derived by the shared tagSlug(). */
  slug: string;
  href: string;
  /** The posts carrying it, newest first. Never empty. */
  posts: BlogPost[];
}

export interface BlogPost {
  /** URL segment, derived from the file name. `/blog/<slug>`. */
  slug: string;
  href: string;
  title: string;
  description: string;
  publishedAt: Date;
  updatedAt?: Date;
  tags: string[];
  /** Resolved cover image, ready for <Image>. Undefined when the post has none. */
  cover?: ImageMetadata;
  /** Required alongside `cover`; the meaningful description of that image. */
  coverAlt?: string;
  /** Absolute cover URL, for og:image and JSON-LD. */
  coverUrl?: string;
  /** Whole minutes, at 200 words per minute, never below 1. */
  readingMinutes: number;
  /** The raw entry, so pages can hand it to `render()`. */
  entry: BlogEntry;
}

/**
 * Covers are imported eagerly so Astro's image pipeline processes them and we
 * can read their real dimensions at build time. Adding a new cover means
 * dropping a file in `src/assets/blog/` — no code change.
 */
const coverModules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/blog/*.{png,jpg,jpeg,webp,avif}",
  { eager: true },
);

const coversByName = new Map<string, ImageMetadata>();
for (const [path, module] of Object.entries(coverModules)) {
  coversByName.set(path.slice(path.lastIndexOf("/") + 1), module.default);
}

const coverFileNames = () => [...coversByName.keys()].sort();

/**
 * Every Markdown file in the content directory, as a path relative to it.
 *
 * This exists because the collection itself cannot be trusted to report a
 * collision: Astro keys entries by id, so two files that reduce to the same
 * slug become one store entry and the later file silently replaces the
 * earlier. By the time `getCollection` runs, the evidence is already gone —
 * one file has simply disappeared, with no warning in the build log. Reading
 * the directory is the only way to see both.
 */
const postFilePaths = Object.keys(import.meta.glob("../content/blog/**/*.{md,mdx}")).map((path) =>
  path.replace(/^.*\/content\/blog\//, ""),
);

const assertPostSlugsAreUsable = (): void => {
  const bySlug = new Map<string, string[]>();

  for (const file of postFilePaths) {
    const slug = slugFromPostPath(file);
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), file]);

    /*
      /blog/tag/<slug> is generated from post frontmatter, so a post living at
      blog/tag/… would be written to the same paths. One would silently overwrite
      the other depending on build order.
    */
    if (slug === tagSegment || slug.startsWith(`${tagSegment}/`)) {
      fail(
        `"${file}" would publish under /blog/${tagSegment}/…, which is where the topic ` +
          `pages live. Move it out of that directory — the two would overwrite each other.`,
      );
    }
  }

  for (const [slug, files] of bySlug) {
    if (files.length > 1) {
      fail(
        `${files.join(" and ")} would all publish at /blog/${slug}. Only one entry ` +
          `per URL survives, so the others would vanish without a warning. Rename them ` +
          `so each resolves to its own slug.`,
      );
    }
  }
};

const fail = (message: string): never => {
  throw new Error(`[blog] ${message}`);
};

const readingTime = (body: string | undefined): number => {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

/**
 * The post page supplies the <h1> from the frontmatter title, so a `#` heading
 * in the Markdown body would render a second one. No WCAG rule flags a
 * duplicate h1, which means nothing else in this project would catch it, so it
 * is caught here. Fenced code blocks are stripped first, because a `#` comment
 * in a shell snippet is not a heading.
 */
const assertNoH1InBody = (body: string | undefined, slug: string): void => {
  if (!body) return;

  const withoutCode = body
    .replace(/^```[\s\S]*?^```[^\n]*$/gm, "")
    .replace(/^~~~[\s\S]*?^~~~[^\n]*$/gm, "");

  if (/^#\s+\S/m.test(withoutCode)) {
    fail(
      `"${slug}" has a level-1 heading in its body. The title is already the <h1>; ` +
        `start body headings at "##".`,
    );
  }
};

const resolveCover = (entry: BlogEntry, slug: string): ImageMetadata | undefined => {
  const { cover, coverAlt } = entry.data;

  if (cover && !coverAlt) {
    fail(`"${slug}" sets a cover but no coverAlt. Describe the image, or drop the cover.`);
  }

  if (!cover) {
    return undefined;
  }

  const image = coversByName.get(cover);
  if (!image) {
    const available = coverFileNames();
    fail(
      `"${slug}" points at cover "${cover}", which is not in src/assets/blog/.\n` +
        (available.length > 0
          ? `       Available: ${available.join(", ")}`
          : "       That directory has no images yet."),
    );
  }

  return image;
};

/**
 * Published posts, newest first.
 *
 * Drafts are excluded unconditionally. See the note in src/content.config.ts:
 * there is one code path, so a draft cannot leak into a production build.
 */
export async function getPosts(): Promise<BlogPost[]> {
  // Checked before the collection is read: a collision means an entry has
  // already been dropped from it, so this must fail the build first.
  assertPostSlugsAreUsable();

  const entries = await getCollection("blog", ({ data }) => !data.draft);

  const posts = entries.map((entry) => {
    // `entry.id` is the slug: the collection's generateId is the same shared
    // slugFromPostPath that assertNoSlugCollisions just checked the directory
    // with. See src/lib/post-slug.ts.
    const slug = entry.id;

    const { publishedAt, updatedAt } = entry.data;
    if (updatedAt && updatedAt.getTime() < publishedAt.getTime()) {
      fail(`"${slug}" was updated before it was published. Check publishedAt and updatedAt.`);
    }

    assertNoH1InBody(entry.body, slug);

    const cover = resolveCover(entry, slug);

    return {
      slug,
      href: `${blogPath}/${slug}`,
      title: entry.data.title,
      description: entry.data.description,
      publishedAt,
      updatedAt,
      tags: entry.data.tags,
      cover,
      coverAlt: cover ? entry.data.coverAlt : undefined,
      coverUrl: cover ? absoluteUrl(cover.src) : undefined,
      readingMinutes: readingTime(entry.body),
      entry,
    } satisfies BlogPost;
  });

  return posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/**
 * Every topic in use, most-used first and then alphabetically.
 *
 * Two things are checked rather than assumed, because both produce a broken
 * site rather than an error:
 *
 *   - a tag with no URL-usable characters ("…", "!!!") would slug to an empty
 *     segment and generate `/blog/tag/` — a duplicate of the blog index.
 *   - two different spellings that reduce to one slug ("High Protein" and
 *     "high-protein") would generate the same page twice, and one would
 *     silently replace the other. Their posts are merged only when the names
 *     match exactly.
 *
 * Only published posts are passed in, so a tag disappears when its last post
 * does. There is no tag registry to keep in sync by hand.
 */
export const collectTags = (posts: BlogPost[]): BlogTag[] => {
  const bySlug = new Map<string, BlogTag>();

  for (const post of posts) {
    // A post may repeat a tag in two spellings; it must still appear once.
    const seenHere = new Set<string>();

    for (const name of post.tags) {
      const slug = tagSlug(name);

      if (slug.length === 0) {
        fail(
          `the tag "${name}" on "${post.slug}" has no characters usable in a URL. ` +
            `Rename the tag, or remove it.`,
        );
      }

      const existing = bySlug.get(slug);

      if (existing) {
        if (existing.name !== name) {
          fail(
            `the tags "${existing.name}" and "${name}" both resolve to ${blogTagPath(slug)}. ` +
              `One page would replace the other — rename one of them.`,
          );
        }
        if (!seenHere.has(slug)) existing.posts.push(post);
      } else {
        bySlug.set(slug, { name, slug, href: blogTagPath(slug), posts: [post] });
      }

      seenHere.add(slug);
    }
  }

  return [...bySlug.values()].sort(
    (a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name),
  );
};

/**
 * Up to `limit` other posts that share at least one tag, best match first.
 *
 * Anything with nothing in common is left out rather than padded in: a
 * "related" section that links unrelated posts is worse than no section, so the
 * caller is expected to render nothing when this returns an empty array.
 * `posts` arrives newest-first, which is also the tie-break.
 */
export const relatedPosts = (post: BlogPost, posts: BlogPost[], limit = 3): BlogPost[] => {
  const own = new Set(post.tags.map(tagSlug));
  if (own.size === 0) return [];

  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      candidate,
      shared: candidate.tags.filter((tag) => own.has(tagSlug(tag))).length,
    }))
    .filter((entry) => entry.shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared || b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
};

/** "12 March 2026" — the same format the recipe dates use. */
export const formatPostDate = (date: Date): string =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** The `datetime` attribute value for a <time> element. */
export const postDateAttribute = (date: Date): string => date.toISOString().slice(0, 10);
