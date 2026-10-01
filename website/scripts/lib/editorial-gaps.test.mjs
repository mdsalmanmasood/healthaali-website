/**
 * Tests for the shared phrase rules.
 *
 * These rules decide two things that a person acts on: the report an editor
 * reads (`npm run report:gaps`) and the note the scheduled sync puts in the pull
 * request for a new video. They also ran unexercised until now, and two of the
 * behaviours below are ones we got wrong in practice rather than in theory —
 * which is why they are written down here instead of being left to a comment.
 *
 * What is asserted, and why these cases
 * -------------------------------------
 * The cases are the ones where the rules are subtle rather than obvious:
 *
 *   - a phrase is only a phrase if every word in it carries weight, so a
 *     fragment like "under 500" is not a subject;
 *   - inside a title clause the windows overlap, and only the *rightmost*
 *     uncovered one is reported — so closing a phrase can reveal the window
 *     beside it, which is the trap that cost us a second pass on 1 October 2026;
 *   - a plural is the same subject, a hashtag is only a subject when the video's
 *     own prose uses the word, and a glued lowercase hashtag cannot be split;
 *   - prose is what a reader reads: a `data-yt-title` attribute and a link
 *     destination must not answer the phrase their own video publishes.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  collectPhrases,
  embedsByVideo,
  findGaps,
  gapsFor,
  postFromMarkdown,
  proseOf,
  readPosts,
  readSnapshot,
  wordsOf,
} from "./editorial-gaps.mjs";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

/** A video, in the shape `collectPhrases` and `findGaps` read. */
const video = (id, title, { description = "", published = "2026-01-01T00:00:00.000Z" } = {}) => ({
  id,
  title,
  description,
  published,
});

/** A published post, in the shape `readPosts` produces, without touching disk. */
const post = (body, { title = "", description = "", tags = [], embeds = [] } = {}) =>
  postFromMarkdown(
    "fixture.md",
    `---\n` +
      `title: "${title}"\n` +
      `description: "${description}"\n` +
      `tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]\n` +
      `publishedAt: 2026-01-01\n` +
      `---\n\n` +
      `${body}\n` +
      embeds.map((id) => `<figure class="yt-embed" data-yt="${id}"></figure>`).join("\n"),
  );

/** The phrases one title and description publish, sorted, for readable diffs. */
const phrasesOf = (recipe) => [...collectPhrases([recipe]).phrases.keys()].sort();

/** Just the phrases the report would print, sorted, for readable diffs. */
const gapsOf = (recipes, posts) => findGaps({ recipes, posts }).gaps.map((gap) => gap.phrase).sort();

/* ── the words ────────────────────────────────────────────────────────────── */

describe("wordsOf", () => {
  it("splits camelCase, and a word from a count but not a count from its unit", () => {
    assert.deepEqual(wordsOf("HighProtein #WeightLossRecipes under500 40g"), [
      "high",
      "protein",
      "weight",
      "loss",
      "recipes",
      "under",
      "500",
      "40g",
    ]);
  });
});

describe("proseOf", () => {
  it("keeps the words of a link and drops where it points", () => {
    const prose = proseOf("See [the fibre post](/blog/fibre-in-an-indian-diet) for that.");
    assert.match(prose, /the fibre post/);
    assert.doesNotMatch(prose, /fibre-in-an-indian-diet/);
  });

  it("keeps a figcaption and drops the attributes around it", () => {
    const prose = proseOf(
      '<figure class="yt-embed" data-yt="9X4sYFzklpI" data-yt-title="High Protein Bangda Banana Leaf Fry">' +
        "<figcaption>A banana leaf fish fry, wrapped and cooked with minimal oil.</figcaption></figure>",
    );

    /* A video's own title must not answer the phrase its own video publishes. */
    assert.match(prose, /banana leaf fish fry/);
    assert.doesNotMatch(prose, /High Protein Bangda/);
    assert.doesNotMatch(prose, /9X4sYFzklpI/);
  });

  it("keeps the words inside a table, which is how the fibre and protein tables count", () => {
    const prose = proseOf("| 1 katori of curd | about 5 to 6 g |");
    assert.match(prose, /1 katori of curd/);
    assert.match(prose, /5 to 6 g/);
  });
});

/* ── the phrases ──────────────────────────────────────────────────────────── */

describe("collectPhrases", () => {
  it("takes phrases from the title and not from adjectives or boilerplate", () => {
    assert.deepEqual(phrasesOf(video("v1", "Crispy Fish Fry 🐟🔥 | Easy & Healthy Recipe| 5 minutes recipe")), [
      "fish fry",
    ]);
  });

  it("drops a phrase with a stopword or a bare number in it", () => {
    assert.deepEqual(phrasesOf(video("v1", "Lunch Under 500 Calories")), []);
  });

  it("counts a one-word hashtag only when the video's prose uses that word", () => {
    const phrases = phrasesOf(
      video("v1", "Aloo Paratha Plate", {
        description: "A plate with Indian Mackerel beside it. #Mackerel #Shorts #weightlossrecipes",
      }),
    );

    /* "aloo paratha plate" is the one window left standing in that clause; a
       one-word hashtag is a phrase only because the description says the word. */
    assert.deepEqual(phrases, ["aloo paratha plate", "mackerel"]);
  });
});

/* ── the findings ─────────────────────────────────────────────────────────── */

describe("findGaps", () => {
  it("reports a title's phrase when no post contains it, and moves on when one does", () => {
    const recipes = [video("v1", "High Protein Bangda Banana Leaf Fry 🔥 | Healthy Fish")];

    /* The rightmost window of the clause is the finding; the three windows
       beside it name the same dish less completely. ("Healthy Fish" is not a
       phrase at all: "healthy" is on the no-subject list.) */
    assert.deepEqual(gapsOf(recipes, [post("Something else entirely.")]), ["banana leaf fry"]);

    /* A figcaption is prose a reader reads, so it answers the phrase — and the
       window beside it becomes the next finding. */
    const covering = post("<figure><figcaption>A banana leaf fry.</figcaption></figure>");
    assert.deepEqual(gapsOf(recipes, [covering]), ["bangda banana leaf"]);
  });

  it("treats a plural as the same subject", () => {
    const recipes = [video("v1", "Prawns Fry")];

    assert.deepEqual(gapsOf(recipes, [post("Something else entirely.")]), ["prawns fry"]);
    assert.deepEqual(gapsOf(recipes, [post("A prawn fry in five minutes.")]), []);
  });

  it("reports only the rightmost uncovered window of a clause", () => {
    const recipes = [video("v1", "Lose Weight with This Healthy Chana Chaat | High Protein Evening Snack")];

    /* "high protein evening" is the left window of the same clause, and speaks
       for nothing while the rightmost window is open. */
    assert.deepEqual(gapsOf(recipes, []), ["chana chaat", "protein evening snack"]);
  });

  it("reveals the neighbouring window once the rightmost one is covered", () => {
    const recipes = [video("v1", "Lose Weight with This Healthy Chana Chaat | High Protein Evening Snack")];
    const posts = [post("A protein evening snack, and a chana chaat, cover both clauses.")];

    /* Covering the rightmost window of each clause leaves the window beside it
       open. This is why a phrase can appear in the report after a post is
       written: it is the same hole, named the other way round. Naming the
       snack the way the channel does — "a high-protein evening snack" — closes
       both of that clause's windows at once. */
    assert.deepEqual(gapsOf(recipes, posts), ["high protein evening", "lose weight"]);

    const named = [
      post("A high-protein evening snack, with chana chaat, for anyone trying to lose weight."),
    ];
    assert.deepEqual(gapsOf(recipes, named), []);
  });

  it("orders findings by how many videos publish them", () => {
    const recipes = [
      video("v1", "Bangda Banana Leaf Fry"),
      video("v2", "Bangda Banana Leaf Fry", { published: "2026-02-01T00:00:00.000Z" }),
      video("v3", "Prawns Ghee Roast"),
    ];

    assert.deepEqual(gapsOf(recipes, []), ["banana leaf fry", "prawns ghee roast"]);
    const { gaps } = findGaps({ recipes, posts: [] });
    assert.deepEqual(gaps[0].ids.sort(), ["v1", "v2"]);
  });

  it("counts every phrase it looked at, which a thin report must not be confused with", () => {
    const recipes = [video("v1", "Bangda Banana Leaf Fry")];
    const { published, gaps } = findGaps({ recipes, posts: [] });

    /* Two windows are open in that clause; one of them is the finding. */
    assert.equal(published, 2);
    assert.equal(gaps.length, 1);
  });
});

/* ── what the sync asks of the same data ──────────────────────────────────── */

describe("embedsByVideo and gapsFor", () => {
  it("counts the posts that show a video, and only counts real video ids", () => {
    const posts = [
      post("one", { embeds: ["abcdefghijk"] }),
      post("two", { embeds: ["abcdefghijk", "lmnopqrstuv"] }),
      post("three", { embeds: ["v1"] }),
    ];
    const counts = embedsByVideo(posts);

    assert.equal(counts.get("abcdefghijk"), 2);
    assert.equal(counts.get("lmnopqrstuv"), 1);
    /* "v1" is two characters: not a YouTube id, so nothing was embedded. */
    assert.equal(counts.get("v1"), undefined);
  });

  it("selects the findings that involve the videos a sync has just added", () => {
    const recipes = [
      video("new", "Bangda Banana Leaf Fry"),
      video("old", "Prawns Ghee Roast"),
    ];
    const { gaps } = findGaps({ recipes, posts: [] });

    assert.deepEqual(gapsFor(gaps, ["new"]).map((gap) => gap.phrase), ["banana leaf fry"]);
    assert.deepEqual(gapsFor(gaps, ["nothing"]), []);
  });
});

/* ── reading the snapshot ─────────────────────────────────────────────────── */

describe("readSnapshot", () => {
  let dir;

  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "editorial-gaps-snapshot-"));
    await writeFile(
      path.join(dir, "recipes.json"),
      JSON.stringify({ schemaVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z", recipes: [video("abcdefghijk", "One")] }),
    );
    await writeFile(path.join(dir, "bare.json"), JSON.stringify([video("abcdefghijk", "One")]));
    await writeFile(path.join(dir, "empty.json"), JSON.stringify({ schemaVersion: 1, recipes: [] }));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the recipes out of the object the sync writes", async () => {
    const snapshot = await readSnapshot(path.join(dir, "recipes.json"));
    assert.deepEqual(snapshot.recipes.map((recipe) => recipe.id), ["abcdefghijk"]);
    assert.equal(snapshot.updatedAt, "2026-01-01T00:00:00.000Z");
  });

  it("accepts a bare array, which is the shape an older or hand-written file has", async () => {
    const snapshot = await readSnapshot(path.join(dir, "bare.json"));
    assert.deepEqual(snapshot.recipes.map((recipe) => recipe.id), ["abcdefghijk"]);
  });

  it("refuses a snapshot that is missing, because an empty library is not a finding", async () => {
    await assert.rejects(
      () => readSnapshot(path.join(dir, "nope.json")),
      /No recipe snapshot at .*nope\.json\.\n  Run `npm run recipes`/,
    );
  });

  it("refuses a snapshot with no recipes in it", async () => {
    await assert.rejects(
      () => readSnapshot(path.join(dir, "empty.json")),
      /holds no recipes\.\n  An empty snapshot would make every phrase below a gap/,
    );
  });
});

/* ── reading the posts ────────────────────────────────────────────────────── */

describe("readPosts", () => {
  let dir;

  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "editorial-gaps-"));
    await writeFile(
      path.join(dir, "published.md"),
      '---\ntitle: "Published"\ndescription: "d"\ntags: ["Habits"]\npublishedAt: 2026-01-01\n---\n\nBody.\n',
    );
    await writeFile(
      path.join(dir, "half-written.md"),
      '---\ntitle: "Draft"\ndescription: "d"\ntags: []\npublishedAt: 2026-01-01\ndraft: true\n---\n\nBody.\n',
    );
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads published posts and skips drafts, which cannot answer a phrase", async () => {
    const posts = await readPosts(dir);
    assert.deepEqual(posts.map((entry) => entry.slug), ["published"]);
  });

  it("refuses a directory that is not there, rather than reporting every phrase as a gap", async () => {
    await assert.rejects(
      () => readPosts(path.join(dir, "nope")),
      /No blog directory at .*nope\. Pass --posts <path> if it moved\./,
    );
  });

  it("refuses a directory with nothing published in it", async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), "editorial-gaps-empty-"));
    await mkdir(path.join(empty, "nested"), { recursive: true });

    await assert.rejects(() => readPosts(empty), /holds no published posts/);

    await rm(empty, { recursive: true, force: true });
  });
});
