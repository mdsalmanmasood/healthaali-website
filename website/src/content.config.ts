/**
 * Content collections.
 *
 * There is exactly one collection: `blog`. A post is a Markdown file in
 * `src/content/blog/`, and the frontmatter below is validated at build time, so
 * a typo in a date or a missing description fails the build instead of shipping
 * a half-rendered page.
 *
 * Cross-field rules (updatedAt < publishedAt, a cover without alt text) are
 * *not* enforced here on purpose. They live in `src/data/blog.ts`, which can
 * name the offending file in its error message — a Zod refinement would only
 * report a path like ["coverAlt"] with no clue which post is at fault.
 */
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

import { blogContentDir, slugFromPostPath } from "./lib/post-slug";

/** Longest values that still fit the meta tags this site emits. */
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 200;

const blog = defineCollection({
  loader: glob({
    base: `./${blogContentDir}`,
    pattern: "**/*.{md,mdx}",
    /*
      The file name decides the URL, through the one shared slug function.
      Astro's default would instead forward a `slug:` frontmatter key verbatim
      and, more importantly, would key two identically-slugged files to the
      same entry id — silently dropping one of them.
    */
    generateId: ({ entry }) => {
      const slug = slugFromPostPath(entry);
      if (slug.length === 0) {
        throw new Error(
          `[blog] "${entry}" contains no characters usable in a URL. Rename the file.`,
        );
      }
      return slug;
    },
  }),
  schema: z.object({
    /** Post headline. Also used as the <title> and the og:title. */
    title: z
      .string()
      .min(1, "title cannot be empty")
      .max(MAX_TITLE, `title must be ${MAX_TITLE} characters or fewer`),

    /** One-sentence summary. Doubles as the meta description and card teaser. */
    description: z
      .string()
      .min(1, "description cannot be empty")
      .max(MAX_DESCRIPTION, `description must be ${MAX_DESCRIPTION} characters or fewer`),

    /**
     * Publication date. `2026-03-12` is read as that day in UTC.
     *
     * The message replaces Zod's default for a failed coercion, which reads
     * "Expected type `date`, received `object`" — accurate and useless. This one
     * says what to write instead.
     */
    publishedAt: z.coerce.date({
      error: "publishedAt must be a real date, written as YYYY-MM-DD (e.g. 2026-03-12)",
    }),

    /** Last substantive edit, when there has been one. */
    updatedAt: z.coerce
      .date({ error: "updatedAt must be a real date, written as YYYY-MM-DD" })
      .optional(),

    /** Free-form labels shown on the card and post page. */
    tags: z.array(z.string().min(1)).default([]),

    /**
     * Id of the author in `src/data/authors.ts`, e.g. `healthaali-kitchen`.
     *
     * Optional: a post with no byline is attributed to the team rather than to
     * nobody. The id is checked against the author list in src/data/blog.ts,
     * which can name the offending post — a Zod enum here would only report the
     * list of allowed values.
     */
    author: z.string().min(1).optional(),

    /**
     * `draft: true` keeps a post out of the site, the sitemap and the RSS feed
     * — in development as well as in a production build. There is deliberately
     * no "preview drafts locally" escape hatch: one code path means a draft can
     * never reach production by accident.
     */
    draft: z.boolean().default(false),

    /** File name of a cover image in `src/assets/blog/`, e.g. "protein-101.jpg". */
    cover: z.string().min(1).optional(),

    /** Required whenever `cover` is set. Empty alt text is only right for decoration. */
    coverAlt: z.string().min(1).optional(),
  }),
});

export const collections = { blog };
