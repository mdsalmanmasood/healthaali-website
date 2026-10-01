/**
 * HealThaali — editorial gaps, the shared half
 * --------------------------------------------
 * One question, two askers:
 *
 *   - `scripts/report-gaps.mjs` (`npm run report:gaps`) asks it about the whole
 *     library, on demand, and prints a report nobody has to act on.
 *   - `scripts/sync-recipes.mjs` asks it about a video the channel has just
 *     published, and puts the answer in the pull request it opens — the moment
 *     the question is actually worth asking, and the moment nobody would think
 *     to run the report.
 *
 * Both go through this module so the two can never disagree about what "no post
 * covers this" means. A second copy of these rules would drift, and the drift
 * would be invisible: two answers, both plausible, about the same video.
 *
 * What the question is
 * --------------------
 * The channel's own words are the corpus: the title of every video in
 * `src/data/recipes.json`, plus the hashtags in its description. A phrase is
 * *covered* when it appears anywhere in a published post — title, description,
 * tags or body. That is the generous reading, so a phrase that survives as a gap
 * is one no post touches at all.
 *
 * The rules, and why they are what they are, are argued in `report-gaps.mjs`
 * (stop words, the rightmost window per clause, plurals, hashtags). This file is
 * the implementation they share; the reasoning lives with the report that a
 * person reads.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/* ── the two word lists ───────────────────────────────────────────────────── */

/**
 * Grammar, not subject: one of these anywhere in a phrase disqualifies it,
 * because "lunch under 500" is a sentence fragment rather than a subject.
 */
export const STOP = new Set(
  (
    "a an the is are was were be been being am of in on at to for with and or but if then than " +
    "that this these those it its as by from up out so we you your our their his her they them i " +
    "u no not too very can could should would will just about into over after before under while " +
    "when what which who how why do does did done get got there here all any each other some more " +
    "most only also even own same such than like vs versus between every without plus"
  ).split(" "),
);

/**
 * Words that describe a video rather than a subject: "easy recipes" is about
 * nothing, "crispy" is about a photograph, and "foodshorts" is about a
 * platform. A phrase carries weight only if every word in it is outside this
 * set — which is what keeps boilerplate and adjectives out of the findings.
 */
export const NO_SUBJECT = new Set(
  (
    "recipe recipes short shorts video videos youtube subscribe reel reels healthy health healthaali " +
    "food foodshorts easy quick simple minute minutes min best perfect tasty yummy delicious " +
    "homemade watch like share comment link app download free today full new crispy juicy special " +
    "nutrition healthyfood healthyrecipes south indianstyle style pretty keeps approved ideas " +
    "inspiration journey heal thaali vibes anymore"
  ).split(" "),
);

/* ── words ────────────────────────────────────────────────────────────────── */

/** camelCase and PascalCase → separate words, so "#WeightLossRecipes" splits. */
export const splitCamel = (text) => text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

export const wordsOf = (text) =>
  splitCamel(text)
    /* A word and a count glued together ("under500") are two words; a count and
       its unit ("40g") are one, which is why only this direction is split. */
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * One word of a phrase, in a shape that tolerates a plural.
 *
 * "prawns" and "prawn", "eggs" and "egg", "tomatoes" and "tomato" are the same
 * subject; a report that treated them as different findings would be wrong on
 * every other line. So a trailing "s" or "es" is dropped before matching and
 * both forms are accepted back. Nothing else is normalised.
 */
export const stem = (word) => (word.length > 4 ? word.replace(/(?:es|s)$/, "") : word);
export const wordRegex = (word) => stem(word).replace(/[^a-z0-9]/g, "") + "(?:s|es)?";

/* ── the reading of the posts ─────────────────────────────────────────────── */

/** Frontmatter block at the top of the file, or "". */
export const frontmatter = (markdown) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? "";

export const body = (markdown) => markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

/**
 * The text a reader actually reads, with the markup that is not text removed.
 *
 * `<[^>]*>` drops `data-yt-title="…"` along with every other attribute and tag,
 * while keeping what sits between tags — a figcaption is prose and counts. Link
 * destinations go too: `](…)` is markup, the words in the link are not.
 */
export const proseOf = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1 ")
    .replace(/[|*_`#>~]/g, " ");

/** One frontmatter value, unquoted. Values here are single-line by contract. */
export const field = (fm, name) =>
  (fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");

/** `tags: ["High protein", "Indian food"]` — the quoted strings, in order. */
export const tagsOf = (fm) => [...(field(fm, "tags").matchAll(/"([^"]*)"/g))].map(([, tag]) => tag);

/**
 * One published post, as the phrase rules need to see it.
 *
 * A draft is not published, so it cannot answer a phrase — same rule as
 * `check:blog-links`. `prose` is what a reader sees (see `proseOf`), so a
 * video's title buried in a `data-yt-title` attribute cannot answer the phrase
 * its own video publishes, and `embeds` is what the post shows.
 */
export const postFromMarkdown = (file, markdown) => {
  const fm = frontmatter(markdown);

  return {
    file,
    slug: file.replace(/\.mdx?$/, ""),
    title: field(fm, "title"),
    description: field(fm, "description"),
    tags: tagsOf(fm),
    publishedAt: field(fm, "publishedAt"),
    prose: proseOf(body(markdown)),
    embeds: new Set([...markdown.matchAll(/data-yt="([A-Za-z0-9_-]{11})"/g)].map(([, id]) => id)),
  };
};

/**
 * Every published post in a directory, by file name.
 *
 * Throws with the message the caller should print when the directory is missing
 * or holds nothing but drafts: an empty scan would make every phrase in the
 * library read as a gap, which is a broken input rather than a finding, and a
 * caller that exits on it does not belong in here.
 */
export async function readPosts(dir, { root = process.cwd() } = {}) {
  const relative = path.relative(root, dir).split(path.sep).join("/") || dir;

  if (!existsSync(dir)) {
    throw new Error(
      `No blog directory at ${relative}. Pass --posts <path> if it moved.\n` +
        "  Refusing to pass on a directory that does not exist: an empty scan\n" +
        "  would look identical to a blog whose links are all fine.",
    );
  }

  const files = (await readdir(dir)).filter((name) => /\.mdx?$/.test(name)).sort();
  const posts = [];

  for (const file of files) {
    const markdown = await readFile(path.join(dir, file), "utf8");
    if (/^draft:\s*true\s*$/m.test(frontmatter(markdown))) continue;
    posts.push(postFromMarkdown(file, markdown));
  }

  if (posts.length === 0) {
    throw new Error(
      `${relative} holds no published posts, so every phrase would read as a gap.`,
    );
  }

  return posts;
}

/* ── the snapshot ─────────────────────────────────────────────────────────── */

/**
 * The recipe snapshot, or the message a caller should print when it is not
 * usable.
 *
 * Throws rather than exiting: a snapshot that is missing or empty would make
 * every phrase in the library read as a gap, which is a broken input rather
 * than a finding, and each caller says so in its own voice.
 *
 * The recipes are `snapshot.recipes` — the top level of the file is an object —
 * but a bare array is accepted, because that is the shape an older snapshot and
 * a hand-written one can have.
 */
export async function readSnapshot(file, { root = process.cwd() } = {}) {
  const relative = path.relative(root, file).split(path.sep).join("/") || file;

  if (!existsSync(file)) {
    throw new Error(
      `No recipe snapshot at ${relative}.\n` +
        "  Run `npm run recipes` to build one from the channel's feed.",
    );
  }

  const snapshot = JSON.parse(await readFile(file, "utf8"));
  const recipes = Array.isArray(snapshot) ? snapshot : snapshot.recipes;

  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new Error(
      `${relative} holds no recipes.\n` +
        "  An empty snapshot would make every phrase below a gap for no reason.",
    );
  }

  return { recipes, updatedAt: snapshot.updatedAt ?? "" };
}

/* ── phrases ──────────────────────────────────────────────────────────────── */

/**
 * A title's clauses, not its punctuation.
 *
 * "Crispy Fish Fry 🐟🔥 | Easy & Healthy Recipe| 5 minutes recipe| zero oil" is
 * four subjects, and the trigram "recipe zero oil" is not one of them. Splitting
 * on the separators a title actually uses (|, ·, dashes, sentence punctuation)
 * before taking n-grams is what stops phrases from straddling clauses.
 */
export const segmentsOf = (text) =>
  text
    .split(/[|·•]|[.!?:;]|\s[–—]\s|\s-\s/g)
    .map(wordsOf)
    .filter((segment) => segment.length > 0);

/**
 * Is this run of words something a post could be about?
 *
 * Every word has to carry weight: one stopword or non-subject word anywhere
 * disqualifies the phrase. "tacos for weight" is a caption, not a subject, and
 * "5 minute high" is what is left of "5-Minute High Protein Breakfast" once its
 * middle word is a duration. A bare number is a quantity rather than a subject —
 * "500 calories" is not something to write a post about, while "40g protein"
 * is, because the unit is attached to the number.
 */
export const isContent = (gram) =>
  gram.every((word) => !STOP.has(word) && !NO_SUBJECT.has(word) && !/^\d+$/.test(word));

/**
 * Every 2- and 3-word phrase inside one clause, with where each one starts.
 *
 * The windows overlap by construction — "banana leaf", "banana leaf fry" and
 * "leaf fry" all come out of one clause — so all of them are collected here and
 * narrowed later, once it is known which ones a post already contains.
 */
export function candidates(clause) {
  const found = [];
  for (let size = 2; size <= 3; size += 1) {
    for (let start = 0; start + size <= clause.length; start += 1) {
      const gram = clause.slice(start, start + size);
      if (isContent(gram)) found.push({ phrase: gram.join(" "), start, size });
    }
  }
  return found;
}

/** The candidates in a clause that no longer candidate from it contains. */
export const maximal = (list) =>
  list.filter(
    (entry) =>
      !list.some((other) => other !== entry && ` ${other.phrase} `.includes(` ${entry.phrase} `)),
  );

/**
 * Every phrase the channel publishes, mapped to the videos that publish it,
 * plus the clauses those phrases came from.
 *
 * Titles contribute their clauses. Descriptions contribute their hashtags, with
 * one extra allowance: a one-word hashtag counts when the video's own prose
 * uses that word too ("#Mackerel" beside a sentence about mackerel is a label
 * for a subject; "#Shorts" is not). Hashtags that are words glued without case
 * changes — "#weightlossrecipes" — cannot be split, and are left alone rather
 * than guessed at.
 *
 * The clauses come back because they are what decides which of several
 * overlapping phrases is the finding, and that can only be known after the
 * posts have been read.
 */
export function collectPhrases(recipes) {
  const phrases = new Map();
  const clausesByVideo = [];

  const add = (phrase, id) => {
    if (!phrases.has(phrase)) phrases.set(phrase, new Set());
    phrases.get(phrase).add(id);
  };

  for (const recipe of recipes) {
    const clauses = segmentsOf(recipe.title ?? "");

    const description = recipe.description ?? "";
    /* The description without its hashtags, for the one-word allowance. */
    const prose = new Set(wordsOf(description.replace(/#[A-Za-z0-9_]+/g, " ")));

    for (const [, tag] of description.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)) {
      const words = wordsOf(tag);

      if (words.length === 1) {
        if (words[0].length >= 4 && prose.has(words[0])) add(words[0], recipe.id);
        continue;
      }

      clauses.push(words);
    }

    clausesByVideo.push({ id: recipe.id, clauses });

    for (const clause of clauses) {
      for (const entry of maximal(candidates(clause))) add(entry.phrase, recipe.id);
    }
  }

  return { phrases, clausesByVideo };
}

/**
 * The pattern a phrase has to appear as, in the whole post corpus.
 *
 * Words are allowed to touch anything that is not a letter or digit between
 * them, because a post writes "high-protein" and a hashtag writes "HighProtein".
 */
export const phraseRegex = (phrase) =>
  new RegExp(
    `(?:^|[^a-z0-9])${phrase
      .split(" ")
      .map(wordRegex)
      .join("[^a-z0-9]+")}(?:[^a-z0-9]|$)`,
  );

/**
 * Phrases no post contains — one per clause, then one per finding.
 *
 * Within a clause the windows overlap, so the clause reports its *rightmost*
 * uncovered phrase: the end of a noun phrase is its head, and "banana leaf fry"
 * says more about a dish than "high protein bangda" from the same title. The
 * other windows in that clause are ways of naming the same subject, and drop —
 * which also means covering one of them can reveal the next, so a phrase that
 * appears out of nowhere after a post is written is the neighbouring window of
 * one that was just closed.
 *
 * Across clauses, a phrase contained in a longer phrase published by the same
 * videos is dropped for the same reason — "banana leaf fish" and "banana leaf
 * fry" are one hole, not two. Phrases with *different* video sets stay: two
 * separate holes, however similar the words.
 */
export function phraseGaps({ phrases, clausesByVideo }, posts, recipes) {
  const corpus = posts
    .map((post) => [post.title, post.description, post.tags.join(" "), post.prose].join("\n"))
    .join("\n")
    .toLowerCase();

  const gaps = [...phrases]
    .filter(([phrase]) => !phraseRegex(phrase).test(corpus))
    .map(([phrase, ids]) => ({ phrase, ids: [...ids] }));
  const gapPhrases = new Set(gaps.map((gap) => gap.phrase));

  /* The one phrase a clause reports, and the windows it speaks for. */
  const shadowed = new Set();
  for (const { clauses } of clausesByVideo) {
    for (const clause of clauses) {
      const open = maximal(candidates(clause)).filter((entry) => gapPhrases.has(entry.phrase));
      if (open.length === 0) continue;

      const chosen = [...open].sort(
        (a, b) => b.start - a.start || b.size - a.size || a.phrase.localeCompare(b.phrase),
      )[0];

      /* Every window in the clause names the same subject, so the others speak
         for nothing once one is reported. */
      for (const entry of open) if (entry !== chosen) shadowed.add(entry.phrase);
    }
  }

  /* The newest video publishing a phrase, so two single-video findings are
     ordered by how recently the channel said them. */
  const newestOf = (ids) =>
    ids.map((id) => recipes.find((recipe) => recipe.id === id)?.published ?? "").sort().at(-1) ?? "";

  const sorted = gaps
    .filter((gap) => !shadowed.has(gap.phrase))
    .sort(
      (a, b) =>
        b.ids.length - a.ids.length ||
        newestOf(b.ids).localeCompare(newestOf(a.ids)) ||
        b.phrase.length - a.phrase.length ||
        a.phrase.localeCompare(b.phrase),
    );

  const wordsOfPhrase = (phrase) => new Set(phrase.split(" "));
  const kept = [];
  for (const gap of sorted) {
    const duplicate = kept.some((other) => {
      /* Every video publishing this phrase also publishes the other one. */
      if (!gap.ids.every((id) => other.ids.includes(id))) return false;

      /* A phrase inside a longer one from the same videos is the rarer finding
         written less completely. */
      if (` ${other.phrase} `.includes(` ${gap.phrase} `)) return true;
      /* So is a phrase sharing two words with one from the same videos. */
      const shared = [...wordsOfPhrase(gap.phrase)].filter((word) =>
        wordsOfPhrase(other.phrase).has(word),
      );
      return shared.length >= 2;
    });
    if (!duplicate) kept.push(gap);
  }

  return { published: phrases.size, gaps: kept };
}

/** The whole-library question, in one call: which published phrases no post answers. */
export const findGaps = ({ recipes, posts }) => phraseGaps(collectPhrases(recipes), posts, recipes);

/**
 * How many posts show each video — the difference between "no post names this"
 * and "no post has this at all", which are different jobs to do.
 */
export function embedsByVideo(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const id of post.embeds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The findings that involve any of `ids`, in the order the report would print them. */
export const gapsFor = (gaps, ids) => {
  const wanted = new Set(ids);
  return gaps.filter((gap) => gap.ids.some((id) => wanted.has(id)));
};
