/**
 * HealThaali — the editorial reminder decision, as a library
 * ---------------------------------------------------------
 * `scripts/editorial-reminders.mjs` keeps the reminders in the issue tracker:
 * one labelled issue per video that no post carries, closed again once a post
 * does. The *doing* needs `gh` and a token and cannot run anywhere else; the
 * *deciding* needs nothing but this repository, so it lives here, where it can
 * be imported and tested — including the part that matters most, which is
 * matching an open reminder back to the video it is about.
 *
 * The three questions, in order
 * -----------------------------
 *   1. Which video is this open reminder about? (`videoIdInTitle` — by id, not
 *      by title, because a video can be retitled on YouTube and the reminder
 *      must survive that.)
 *   2. Should it be open? (`plan` — a video no post embeds.)
 *   3. What does it say? (`issueTitleFor`, `issueBodyFor`, `closeCommentFor`.)
 *
 * Nothing here talks to GitHub, reads a file or prints anything.
 */

import { gapsFor } from "./editorial-gaps.mjs";

/**
 * The title of a reminder.
 *
 * The video's own name, in quotes, because that is what the channel called it;
 * and the id in brackets, because the id is what survives a retitle — it is how
 * the close pass knows which video an open issue is about.
 */
export const issueTitleFor = (recipe) => `Write the post behind “${recipe.title}” (${recipe.id})`;

/**
 * The video id a reminder is about, or undefined when its title names none.
 *
 * Matched against the ids in the snapshot rather than by pattern: a title can
 * contain anything, and the snapshot is the only list of ids that means
 * something here.
 */
export const videoIdInTitle = (title, ids) => ids.find((id) => title.includes(`(${id})`));

/** The issue body: what is missing, where the video is, and how to read a phrase. */
export function issueBodyFor({ recipe, phrases, site }) {
  const published = String(recipe.published ?? "").slice(0, 10);
  const lines = [
    "The channel has published this video, and no post on the site carries it yet.",
    "",
    `- **Video:** [${recipe.title}](${recipe.url})${published ? ` — ${published}` : ""}`,
    `- **Dish page:** ${site}/recipes/${recipe.id}`,
  ];

  if (phrases.length > 0) {
    lines.push(`- **No post covers:** ${phrases.map((phrase) => `“${phrase}”`).join(", ")}`);
    lines.push("");
    lines.push(
      "A phrase here is either a post that has not been written or a post that covers",
      "the subject without naming it — the second is a sentence of editing rather than a",
      "page, and §7 of LAUNCH.md works through how to tell them apart. `npm run report:gaps`",
      "is the report this comes from, with the whole library in it.",
    );
  } else {
    lines.push(
      "- **Phrases:** every phrase this video publishes already appears in a post, so what",
      "  is missing is a post that carries the video itself.",
    );
    lines.push("");
    lines.push(
      "`npm run report:gaps` is the report this comes from, with the whole library in it.",
    );
  }

  lines.push("");
  lines.push(
    "This reminder closes itself: the next scheduled recipe sync closes it once a post",
    "embeds the video.",
  );

  return lines.join("\n");
}

/**
 * What gets written when the work is done, so the issue records its own ending.
 *
 * The posts are linked, because the useful thing for anyone reading the closed
 * reminder later is where the writing landed.
 */
export function closeCommentFor({ recipe, posts, site }) {
  const carried = posts.map((post) => `[${post.slug}](${site}/blog/${post.slug})`).join(", ");

  return (
    `Written: ${carried} now ${posts.length === 1 ? "carries" : "carry"} ` +
    `[${recipe.title}](${recipe.url}). Closing this reminder, because that was the whole ` +
    "point of it."
  );
}

/**
 * The whole decision, with nothing to do with `gh` in it: given the videos, the
 * posts, the phrase findings and the open reminders, what should be opened, what
 * should be closed, and what is already in place?
 *
 * Three lists come back, and the third matters as much as the others: a reminder
 * that is already open for a video still unwritten must not be opened twice, or
 * the tracker fills with duplicates of the same job. A fourth list — reminders
 * whose title names no video in the snapshot — is reported and left untouched,
 * because a video that was pruned or a reminder somebody wrote by hand is a
 * decision for a person.
 *
 * `gaps` is the whole-library phrase finding (see `findGaps`), filtered here to
 * the phrases each video publishes, so the issue says which words no post has.
 */
export function plan({ recipes, posts, gaps, issues, site }) {
  const ids = recipes.map((recipe) => recipe.id);

  /* Which posts carry each video, and which video each open reminder is about. */
  const carried = new Map();
  for (const post of posts) {
    for (const id of post.embeds) carried.set(id, [...(carried.get(id) ?? []), post]);
  }

  const tracking = new Map();
  const orphaned = [];
  for (const issue of issues) {
    const id = videoIdInTitle(issue.title, ids);
    if (!id) orphaned.push(issue);
    else if (!tracking.has(id)) tracking.set(id, issue);
  }

  const open = [];
  const close = [];
  const waiting = [];

  for (const recipe of recipes) {
    const issue = tracking.get(recipe.id);
    const postsWithIt = carried.get(recipe.id) ?? [];

    if (postsWithIt.length > 0) {
      if (issue) {
        close.push({
          issue,
          recipe,
          comment: closeCommentFor({ recipe, posts: postsWithIt, site }),
        });
      }
      continue;
    }

    if (issue) {
      waiting.push({ issue, recipe });
      continue;
    }

    const phrases = gapsFor(gaps, [recipe.id]).map((gap) => gap.phrase);
    open.push({
      recipe,
      phrases,
      title: issueTitleFor(recipe),
      body: issueBodyFor({ recipe, phrases, site }),
    });
  }

  return { open, close, waiting, orphaned };
}
