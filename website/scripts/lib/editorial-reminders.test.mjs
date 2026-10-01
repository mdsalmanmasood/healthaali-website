/**
 * Tests for the reminder decision.
 *
 * The decision is three questions — which video is an open reminder about,
 * should it be open, and what does it say — and every one of them has a way to
 * go quietly wrong: a reminder opened twice for the same video, a reminder never
 * closed once the post is written, a reminder closed for the wrong video because
 * two dishes share a title. None of that is visible in a terminal, which is why
 * it is asserted here.
 *
 * The `gaps` these cases pass in come from the real rule set
 * (`editorial-gaps.mjs`), so the wiring from "which phrases no post covers" to
 * "what the issue says" is exercised end to end rather than stubbed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findGaps } from "./editorial-gaps.mjs";
import {
  closeCommentFor,
  issueBodyFor,
  issueTitleFor,
  plan,
  videoIdInTitle,
} from "./editorial-reminders.mjs";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const SITE = "https://healthaali.in";

const video = (id, title, extra = {}) => ({
  id,
  title,
  url: `https://www.youtube.com/shorts/${id}`,
  published: "2026-02-07T04:30:11.000Z",
  description: "",
  ...extra,
});

/** A post, in the shape `findGaps` and the plan both read. */
const post = (slug, ids = [], extra = {}) => ({
  slug,
  title: "",
  description: "",
  tags: [],
  prose: "",
  embeds: new Set(ids),
  ...extra,
});

const issue = (number, title) => ({ number, title, url: `${SITE}/issues/${number}` });

/* ── the title, and finding the video again ───────────────────────────────── */

describe("issueTitleFor and videoIdInTitle", () => {
  it("names the video the way the channel did, and keeps the id to find it by", () => {
    const recipe = video("9X4sYFzklpI", "High Protein Bangda Banana Leaf Fry 🔥 | Healthy Fish");
    const title = issueTitleFor(recipe);

    assert.equal(
      title,
      "Write the post behind “High Protein Bangda Banana Leaf Fry 🔥 | Healthy Fish” (9X4sYFzklpI)",
    );
    assert.equal(videoIdInTitle(title, [recipe.id]), recipe.id);
  });

  it("survives a retitle on YouTube, because the id is what it matches on", () => {
    const old = issueTitleFor(video("abcdefghijk", "The old title"));
    assert.equal(videoIdInTitle(old, ["abcdefghijk"]), "abcdefghijk");
  });

  it("claims no video for a title that names one the snapshot does not have", () => {
    assert.equal(videoIdInTitle(issueTitleFor(video("abcdefghijk", "Gone")), ["zyxwvutsrqp"]), undefined);
    assert.equal(videoIdInTitle("Some hand-written issue", ["abcdefghijk"]), undefined);
  });
});

/* ── what the reminder says ───────────────────────────────────────────────── */

describe("issueBodyFor", () => {
  const recipe = video("9X4sYFzklpI", "High Protein Bangda Banana Leaf Fry 🔥 | Healthy Fish");

  it("lists the phrases no post covers, and how to read a phrase finding", () => {
    const body = issueBodyFor({ recipe, phrases: ["banana leaf fish", "mackerel"], site: SITE });

    assert.match(body, /no post on the site carries it yet/);
    assert.match(body, /\*\*Video:\*\* \[High Protein Bangda Banana Leaf Fry 🔥 \| Healthy Fish\]\(https:\/\/www\.youtube\.com\/shorts\/9X4sYFzklpI\) — 2026-02-07/);
    assert.match(body, /\*\*Dish page:\*\* https:\/\/healthaali\.in\/recipes\/9X4sYFzklpI/);
    assert.match(body, /\*\*No post covers:\*\* “banana leaf fish”, “mackerel”/);
    assert.match(body, /§7 of LAUNCH\.md/);
    assert.match(body, /closes itself/);
  });

  it("says so when the phrases are covered and only the video is missing", () => {
    const body = issueBodyFor({ recipe, phrases: [], site: SITE });

    assert.match(body, /every phrase this video publishes already appears in a post/);
    assert.doesNotMatch(body, /No post covers/);
  });
});

describe("closeCommentFor", () => {
  const recipe = video("9X4sYFzklpI", "Bangda Banana Leaf Fry");

  it("names and links the post that did the work", () => {
    const comment = closeCommentFor({ recipe, posts: [post("bangda-banana-leaf-fish-fry")], site: SITE });

    assert.match(comment, /\[bangda-banana-leaf-fish-fry\]\(https:\/\/healthaali\.in\/blog\/bangda-banana-leaf-fish-fry\)/);
    assert.match(comment, /now carries/);
  });

  it("reads as a sentence when more than one post carries the video", () => {
    const comment = closeCommentFor({
      recipe,
      posts: [post("one"), post("two")],
      site: SITE,
    });

    assert.match(comment, /now carry/);
  });
});

/* ── the plan ─────────────────────────────────────────────────────────────── */

describe("plan", () => {
  const written = video("iArJsgETUN4", "Crispy Paneer Pocket 😍 | 10-Min High Protein Snack");
  const unwritten = video("9X4sYFzklpI", "High Protein Bangda Banana Leaf Fry 🔥 | Healthy Fish");
  const recipes = [written, unwritten];
  const posts = [post("high-protein-meals-under-15-minutes", ["iArJsgETUN4"])];
  const { gaps } = findGaps({ recipes, posts });

  it("opens a reminder for a video no post carries, with the phrases no post covers", () => {
    const result = plan({ recipes, posts, gaps, issues: [], site: SITE });

    assert.deepEqual(result.open.map((entry) => entry.recipe.id), ["9X4sYFzklpI"]);
    assert.deepEqual(result.open[0].phrases, ["banana leaf fry"]);
    assert.deepEqual(result.close, []);
    assert.deepEqual(result.waiting, []);
  });

  it("does not open a second reminder for a video that is already tracked", () => {
    const tracked = issue(12, issueTitleFor(unwritten));
    const result = plan({ recipes, posts, gaps, issues: [tracked], site: SITE });

    assert.deepEqual(result.open, []);
    assert.deepEqual(result.waiting.map((entry) => entry.issue.number), [12]);
  });

  it("closes a reminder whose video a post now carries", () => {
    const tracked = issue(12, issueTitleFor(written));
    const result = plan({ recipes, posts, gaps, issues: [tracked], site: SITE });

    assert.deepEqual(result.close.map((entry) => entry.issue.number), [12]);
    assert.match(result.close[0].comment, /high-protein-meals-under-15-minutes/);
    assert.deepEqual(result.open.map((entry) => entry.recipe.id), ["9X4sYFzklpI"]);
  });

  it("says nothing about a video that is written about and untracked", () => {
    const result = plan({ recipes, posts, gaps, issues: [], site: SITE });

    assert.deepEqual(result.close, []);
    assert.ok(!result.open.some((entry) => entry.recipe.id === "iArJsgETUN4"));
  });

  it("leaves a reminder that names no video in the snapshot alone", () => {
    const foreign = issue(9, "Write the post behind “A dish we no longer list” (zzzzzzzzzzz)");
    const result = plan({ recipes, posts, gaps, issues: [foreign], site: SITE });

    assert.deepEqual(result.orphaned.map((entry) => entry.number), [9]);
    assert.deepEqual(result.close, []);
    assert.deepEqual(result.waiting, []);
  });

  it("handles a video whose phrases are all covered, which is the common case", () => {
    /* "Paneer Pocket" publishes "paneer pocket"; the post below says it. */
    const covered = video("lmnopqrstuv", "Paneer Pocket");
    const withIt = [
      post("paneer-eggs-dal-soya-which-protein", ["lmnopqrstuv"], {
        prose: "A paneer pocket in ten minutes, and about 18 g of protein.",
      }),
    ];
    const findings = findGaps({ recipes: [covered], posts: withIt });

    assert.deepEqual(findings.gaps, []);

    const result = plan({
      recipes: [covered],
      posts: withIt,
      gaps: findings.gaps,
      issues: [issue(7, issueTitleFor(covered))],
      site: SITE,
    });

    assert.deepEqual(result.close.map((entry) => entry.issue.number), [7]);
  });
});
