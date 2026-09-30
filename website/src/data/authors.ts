/**
 * Who writes the blog.
 *
 * A byline is a claim about authorship, so nothing here is guessed. There are
 * two entries and both are supplied by the people they describe: the person who
 * founds and writes the blog, and the team byline that stands in when a post
 * names nobody.
 *
 * **A post states its own author.** `author:` in the frontmatter is what a post
 * means, and all of them name the person today; `defaultAuthorId` below is only
 * the fallback for a post that names nobody. That direction is deliberate: a
 * default of "the person" would attribute a future post to her without anyone
 * having written the claim, and an authorship claim nobody made is exactly the
 * kind this site avoids.
 *
 * Nothing here is invented — no portrait that does not exist, no job title that
 * was not supplied, no credential, no `sameAs` profile that is not the author's
 * own. `role` and `bio` are published on every byline and on the author page, so
 * they are written to be sentences the named person would sign.
 *
 * The team author is its own node — the kitchen that writes under the brand —
 * and says so with `parentOrganization`. It deliberately does not reuse the
 * site-wide Organization's `@id`: the two have different names ("HealThaali" and
 * "HealThaali Kitchen"), and two names on one `@id` is an ambiguity a crawler
 * has to resolve by guessing.
 */
import type { ImageMetadata } from "astro";

import { organizationId } from "./schema";
import { absoluteUrl, site } from "./site";

/** A verified profile of the author: what to call it, and where it is. */
export interface AuthorProfile {
  name: string;
  href: string;
}

export interface Author {
  /** URL segment: `/blog/author/<id>`. */
  id: string;
  /** Display name in the byline and the author page heading. */
  name: string;
  /**
   * What the author *is* in structured data. `Person` for a named human,
   * `Organization` for the team. Never `Person` for a team byline.
   */
  type: "Person" | "Organization";
  /** One short line under the name — what the byline is accountable for. */
  role: string;
  /** Two or three sentences for the author page. Plain text, no claims. */
  bio: string;
  /**
   * True when this author is the team behind the brand rather than a named
   * individual. The schema node then carries `parentOrganization`, so the
   * byline is tied to the organisation the policies and the footer describe.
   */
  team: boolean;
  /** Verified profiles that belong to this author. Empty if there are none. */
  profiles: AuthorProfile[];
  /**
   * File name of a portrait in `src/assets/authors/`, e.g. `salman.webp`.
   * Optional: without one the byline shows a monogram instead of a face, and
   * nothing pretends to be a photograph.
   */
  portrait?: string;
}

export const authorSegment = "author";

/** `/blog/author/<id>`. */
export const authorPath = (id: string): string => `/blog/${authorSegment}/${id}`;

export const authors: Author[] = [
  {
    id: "nehal-masood",
    name: "Nehal Masood",
    type: "Person",
    role: "Founder, HealThaali",
    bio: [
      "Nehal Masood started HealThaali and writes everything on this blog. She",
      "cooks the food that gets filmed, works out the portions behind each plate,",
      "and writes down what was measured and what is still uncertain — which is",
      "why the numbers in these posts arrive with their working.",
    ].join(" "),
    team: false,
    /*
      Empty on purpose, and not a placeholder for the brand's accounts. `sameAs`
      says "this profile is this person", and the YouTube and Instagram accounts
      below are the brand's, published as the brand everywhere else on the site.
      Add a URL here only when it is a profile that belongs to her.
    */
    profiles: [],
    /*
      Supplied by the author, cropped square and encoded to WebP at quality 75 —
      see src/assets/authors/README.md for what the file is and how it was made.
      Naming one that is not on disk fails the build rather than shipping a
      byline with a broken picture.
    */
    portrait: "nehal-masood.webp",
  },
  {
    id: "healthaali-kitchen",
    name: "HealThaali Kitchen",
    type: "Organization",
    role: "Recipes, testing and nutrition notes",
    bio: [
      "The posts on this blog are written by the same people who cook for the",
      "camera and build the HealThaali app. We write down what we cooked, what we",
      "measured, and what we are still unsure about. Where a number depends on",
      "your body, your kitchen or your portion sizes, we say so rather than",
      "quoting a figure that sounds more certain than it is.",
    ].join(" "),
    team: true,
    /*
      The two profiles the asset kit confirms, taken from the same list the
      footer and the site-wide Organization node use. Nothing is added here that
      is not published elsewhere on the site already.
    */
    profiles: site.socials.map((social) => ({
      name: social.name,
      href: social.href,
    })),
  },
];

/**
 * Used when a post does not name an author: the team, not the person.
 *
 * See the note at the top of this file. Every post today names `nehal-masood`
 * explicitly, so this is reached only by a new post that says nothing about who
 * wrote it — and a team byline is the honest answer to "who wrote this?" when
 * nobody said.
 */
export const defaultAuthorId = "healthaali-kitchen";

export const authorById = (id: string): Author | undefined =>
  authors.find((author) => author.id === id);

/**
 * Portraits are resolved the same way blog covers are: drop a file in the
 * directory and name it in the entry above. A portrait that is named but absent
 * throws during the build — the alternative is a byline that silently loses its
 * photograph.
 */
const portraitModules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/authors/*.{png,jpg,jpeg,webp,avif}",
  { eager: true },
);

const portraitsByName = new Map<string, ImageMetadata>();
for (const [path, module] of Object.entries(portraitModules)) {
  portraitsByName.set(path.slice(path.lastIndexOf("/") + 1), module.default);
}

export const authorPortrait = (author: Author): ImageMetadata | undefined => {
  if (!author.portrait) return undefined;

  const image = portraitsByName.get(author.portrait);
  if (!image) {
    const available = [...portraitsByName.keys()].sort();
    throw new Error(
      `[authors] "${author.id}" names portrait "${author.portrait}", which is not in ` +
        `src/assets/authors/.\n` +
        (available.length > 0
          ? `          Available: ${available.join(", ")}`
          : "          That directory has no images yet."),
    );
  }

  return image;
};

/**
 * The authors with at least one published post, in the order they are declared
 * above. Author pages are generated from this, so an unused author has no page
 * and no link points at one.
 */
export const authorsUsedBy = (posts: { author: { id: string } }[]): Author[] => {
  const used = new Set(posts.map((post) => post.author.id));
  return authors.filter((author) => used.has(author.id));
};

/**
 * The author's `@id`: a stable fragment on the author's own page.
 *
 * Stable because it is derived from the id in this file, not from anything that
 * moves — a byline and the page it points at will not drift apart.
 */
export const authorEntityId = (author: Author): string =>
  `${absoluteUrl(authorPath(author.id))}#author`;

/**
 * The author as a JSON-LD node.
 *
 * The full node is emitted rather than a bare `{"@id": …}` reference, so the
 * statement stands on its own wherever it appears. The team's node points at
 * the organisation the rest of the site already declares, which is how a
 * crawler gets from "HealThaali Kitchen wrote this" to the brand behind it.
 */
export const authorSchemaNode = (author: Author): Record<string, unknown> => {
  // Throws when a portrait is named but absent, which is the point: see
  // src/assets/authors/README.md.
  const portrait = authorPortrait(author);

  return {
    "@type": author.type,
    "@id": authorEntityId(author),
    name: author.name,
    url: absoluteUrl(authorPath(author.id)),
    /*
      A named person is described as a person: the role they are published under,
      and the organisation they work for. The team node instead points at the
      organisation it is part of, because "HealThaali Kitchen" is the brand
      rather than somebody the brand employs.
    */
    ...(author.team
      ? { parentOrganization: { "@id": organizationId } }
      : { jobTitle: author.role, worksFor: { "@id": organizationId } }),
    /*
      The photograph, when there is one. Until then the node carries no `image`
      at all — a monogram is drawn in CSS and is not an image of anybody, so
      pointing `image` at it would describe a picture that does not exist.
    */
    ...(portrait
      ? {
          image: {
            "@type": "ImageObject",
            url: absoluteUrl(portrait.src),
            width: portrait.width,
            height: portrait.height,
          },
        }
      : {}),
    ...(author.profiles.length > 0 ? { sameAs: author.profiles.map((p) => p.href) } : {}),
  };
};
