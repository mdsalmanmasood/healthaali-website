# HealThaali — official website

The public marketing website for **HealThaali** (Heal + Thaali) — a personalized nutrition
companion for home-cooked Indian food. Static-first [Astro](https://astro.build) site:
no SSR adapter, no client framework, and JavaScript limited to the theme toggle, the mobile
menu and the sticky-header state.

- **Canonical domain:** https://healthaali.in
- **Products:** Android app (primary) + web app (in development)
- **Output:** fully static `dist/` — Cloudflare Pages, Netlify, Vercel, or any static host

---

## Requirements

- **Node.js** — a currently supported LTS release (developed against Node 24)
- **npm** (the project uses npm; the `.bat` helpers assume it)

Check your versions:

```bat
node -v
npm -v
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Then open the printed URL (default http://localhost:4321).

On Windows you can also just **double-click `run.bat`** — it installs dependencies if
`node_modules` is missing and then starts the dev server.

## Production build

```bash
npm run build
```

This runs `astro check` (type + template diagnostics) and then `astro build`, writing the
static site to `dist/`.

Windows: double-click **`build.bat`**.

## Preview the built site

```bash
npm run preview
```

Windows: **`preview.bat`** builds first, then serves `dist/`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Astro dev server with HMR |
| `npm run dev:force` | Same, but replaces a dev server that is already running |
| `npm run dev:stop` | Stop a dev server started by an earlier run |
| `npm run build` | `astro check && astro build` → `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run preview:stop` | Stop a preview server started by an earlier run |
| `npm run check` | Type/template diagnostics only |
| `npm run check:links` | Link, anchor, sitemap and robots integrity in the built site |
| `npm run check:links:external` | The same, plus live checks of external URLs |
| `npm run check:a11y` | axe-core WCAG A/AA audit of every built page, in light *and* dark |
| `npm run check:placeholders` | Fail on any `[bracketed]` placeholder left in a built page |
| `npm run check:recipes` | Validate the committed recipe snapshot, offline |
| `npm run check:blog-links` | Fail when a post links to fewer than two other posts, or is an orphan |
| `npm run check:blog-dates` | Fail when a post is dated before the video it embeds |
| `npm run check:sync-workflow` | Fail when the daily sync can no longer open or close its editorial reminders — an un-gated `npm run reminders` step, or no `issues: write` |
| `npm run check:weight` | Fail when a built page exceeds its gzipped HTML/CSS/JS budget |
| `npm run check:seo` | One `<h1>`, unique titles and descriptions, canonicals, parseable JSON-LD, and a sitemap that agrees with the build |
| `npm run report:gaps` | Report the phrases the channel publishes that no post answers, and the thinnest topic pages (a report, not a gate — it always exits 0). The scheduled sync asks the same question about a new video, in its report |
| `npm run reminders` | Open a labelled issue for every video no post carries, and close the ones that have since been written about (needs the GitHub CLI) |
| `npm run verify` | The whole chain, in the order `ci.yml` runs it: recipes → blog links → blog dates → the sync guard → build → placeholders → links → weight → SEO → a11y → tests |
| `npm run assets` | Re-derive every image from the supplied brand kit |
| `npm run blog:images` | Convert any blog cover artwork to WebP (quality 75) and wire it into the post |
| `npm run blog:images -- --prompts` | Rewrite `src/assets/blog/PROMPTS.md` from the prompt manifest |
| `npm run recipes` | Sync the recipe snapshot from the public YouTube feed |

### Troubleshooting: “Another astro dev server is already running”

Astro 7 refuses to start a second dev server. If you see:

```text
Another astro dev server is already running.
  URL:  http://localhost:4321
  PID:  12345
```

either stop it (`npm run dev:stop`) or replace it (`npm run dev:force`).

You do not have to do either one by hand: **`run.bat` and `preview.bat` shut down
this project's previous dev/preview server before starting a new one**, then use
`dev:force` as a backstop, so double-clicking them always works. Closing the
console window with Ctrl+C stops the server cleanly.

### If the site appears on port 4322 instead of 4321

Astro never fails on a busy port — it quietly moves to the next free one, so the
URL printed in the console is always the real one. The batch files release 4321
from *this* project's own servers, but a server belonging to a **different**
project (or any other program) holding 4321 will still push this site to 4322.
In that case just open the URL the console prints, or stop the other program.

## Quality gates

These run against the **built** site rather than the sources, because that is
what a visitor receives — except the three that read the sources on purpose (the
recipe snapshot, and the blog's internal links and dates), which say so where
they are described. All of them are plain npm scripts, so CI and your terminal execute
the same code.

### Link integrity — `npm run check:links`

[`scripts/check-links.mjs`](scripts/check-links.mjs) walks `dist/` and resolves
every `href`, `src`, `srcset` candidate, `poster` and form `action` in every
generated page, reporting the file and line of anything that does not resolve.
It has no dependencies — no browser download, nothing to keep updated.

It covers:

- internal links, in both `/about` and `/about/` form (the site builds with
  `trailingSlash: "ignore"`, and the hosts serve either)
- `#fragments`, including cross-page ones like `/features#nutrition` — a "Skip
  to main content" link that silently goes nowhere fails the build
- typos that otherwise look like working links: `htps://`, a bare
  `www.example.com`, a malformed absolute URL
- `og:image`, `og:url`, `twitter:image` and canonical URLs
- every `<loc>` in `sitemap-*.xml`, and every `Sitemap:` line in `robots.txt`

**External URLs are syntax-checked but not contacted by default.** A 429 from
Instagram must never turn a pull request red, so `--external` opts into live
checks (two attempts, five at a time) and treats 401/403/405/429 as "reachable
but restricted to bots" rather than broken. Run it by hand when you change a
social link.

### Blog internal links — `npm run check:blog-links`

[`scripts/check-blog-links.mjs`](scripts/check-blog-links.mjs) reads the
Markdown in `src/content/blog/` and holds two rules:

- **Every published post links to at least two others.** Two is a floor, not a
target — the posts here carry four or five each — but a floor is the part a gate
can enforce.
- **Every published post is linked from at least one other.** A post with no
inbound links is reachable only from the index and its tags, which is what an
orphan is.

It prints the whole graph (out-links and in-links per post, weakest first) rather
than the first failure, because the useful answer to "this one is short" is
"here is where the links already are". `--min <n>` raises the floor, and `--dir`
points it somewhere else.

It reads the sources and not `dist/` on purpose. Whether a link *resolves* is the
link checker's job on the built site; this catches a post that links to nothing
and a cross-link to a slug that does not exist, both reported against the file
that needs the edit. It is not a rule in `src/data/blog.ts` because that module
runs during `astro dev` — a half-written draft should not be able to stop you
running the dev server. Drafts are skipped here for the same reason.

### Blog dates — `npm run check:blog-dates`

[`scripts/check-blog-dates.mjs`](scripts/check-blog-dates.mjs) reads the same
Markdown, the upload timestamps in [`src/data/recipes.json`](src/data/recipes.json),
and holds one rule:

- **No published post is dated before the newest video it embeds.** A post
explains cooking that has already been filmed, so it cannot have explained a
video that had not been uploaded yet. This is the floor half of
[Dating a post](#dating-a-post), and the half a build would never notice on its
own: a date is a valid date whatever it claims.

It also fails on an embed whose id is not in the snapshot. Without a snapshot
entry there is no upload date to compare against, so a single typo in a `data-yt`
would quietly take the rule out of play for that post. The snapshot merges by
video id and never drops an entry, so an id it does not know was never in the
feed.

It prints a table — every post, its date, the upload date of its newest embed
and the gap between them — because the gap is the other half of the convention.
The posts here run one or two days after their video; `--max-gap <days>` turns
that habit into a failure when you want it, and stays off by default because a
wider gap is an editorial choice rather than a mistake. `--dir` and `--recipes`
point it at other files.

Same reasoning as the link gate for living here rather than in
`src/data/blog.ts`, and the same reason drafts are skipped.

### The sync's reminder guard — `npm run check:sync-workflow`

[`scripts/check-sync-workflow.mjs`](scripts/check-sync-workflow.mjs) reads
[`.github/workflows/sync-recipes.yml`](../.github/workflows/sync-recipes.yml) and
holds two rules about the step that keeps the editorial reminders in the issue
tracker ([`scripts/editorial-reminders.mjs`](scripts/editorial-reminders.mjs)):

- **It must run even when a step above it failed.** A step with no `if:` runs
only if everything before it succeeded, and the first thing the sync job does is
fetch the YouTube feed. That feed answered a transient HTTP 404 on the first
scheduled run (1 October), which skipped every step after it — including the half
of the reminders that needs no news at all, closing a reminder whose video a post
now carries. The step carries `if: always()`, and this gate says so on the next
push rather than on the morning it matters.
- **It must be allowed to write issues.** Without `issues: write` every quiet run
is green and the step fails on the first morning there is something to open — the
worst day to discover a missing permission.

Neither is visible anywhere else: the site builds, every audit passes, and the
workflow simply stops doing the thing it was fixed to do. That is why it runs in
`ci.yml` as well as in `npm run verify` — the edit that would undo it arrives as
an ordinary push.

It reads the step's `run:` rather than its name, checks every step that invokes
the reminders, and reads the permissions the job actually inherits: a job's own
`permissions:` block overrides the workflow's, which is exactly the kind of edit
that looks harmless in a diff. The rules live in
[`scripts/lib/sync-workflow.mjs`](scripts/lib/sync-workflow.mjs), where they are
tested; `--workflow <path>` points it at another file.

### Accessibility — `npm run check:a11y`

[`scripts/check-a11y.mjs`](scripts/check-a11y.mjs) serves `dist/` itself, walks
every built page, and fails if axe-core reports a violation of any rule tagged
WCAG 2.0, 2.1 or 2.2 level A or AA. A new page is covered the moment it is
added — there is no URL list to keep up to date.

It drives a real browser rather than linting the templates, because that is the
only way to catch rules like `label-content-name-mismatch`, which depends on how
a breakpoint actually renders. That rule is also why the rule set is selected
by **rule id** rather than by tag: axe ships it as `experimental`, and a
tag-only run skips it without saying so.

**Every page is audited twice, once with `prefers-color-scheme: light` and once
with `dark`**, with `prefers-reduced-motion: reduce` forced on — both a real
user preference and a way to stop a transition being measured mid-flight.
Dark-mode contrast has regressed here before, and a single-scheme audit misses
half of the design.

A failure names the rule, its impact, the WCAG criterion, the CSS selector and
axe's own explanation, so it tells you what to change.

#### Why not Lighthouse CI

It was the first choice, and it is the tool the numbers below were originally
measured with. It was dropped because chrome-launcher throws `EPERM` while
deleting its temporary Chrome profile **after** a successful audit on Windows,
which Lighthouse CI reports as a failed run — leaving `npm run verify` failing
at random on a developer machine while passing in CI. No configuration avoids
it, and choosing axe-core directly also removed 312 packages and seven
high-severity advisories.

#### What this gate does not prove

axe reports `color-contrast` as *incomplete* for text over a decorative
`::before` gradient — the hero and the CTA band — because it will not guess a
background colour it cannot compute. Lighthouse scores those cases as passing
and says nothing about them; here they are listed in full, with selectors,
under "could not decide automatically". A green run therefore means **no
violation of any WCAG A/AA rule axe could decide**, and that list is worth
reading whenever you touch a colour token. Closing the gap properly needs pixel
sampling of the rendered element, which would risk confidently wrong answers.

### Placeholder guard — `npm run check:placeholders`

[`scripts/check-placeholders.mjs`](scripts/check-placeholders.mjs) fails the
build if any `[square-bracket]` placeholder survives into `dist/`. Square
brackets are the convention this project uses for "a fact nobody has supplied
yet" — the `/privacy` and `/terms` pages once carried a whole page of them,
under a "Pre-launch draft" banner.

That scaffolding is invisible to every other gate: brackets are valid text, so
the typecheck, the link checker and axe all pass while a visitor reads
`[confirm provider and regions]`. This is the gate that notices. It is worth
having because those pages are edited rarely — exactly the conditions under
which a stale draft gets merged back in.

It scans **every** built page, not just the two legal ones, checking visible
text *and* attribute values (so `alt="[chart]"` is caught too). `<script>`,
`<style>` and HTML comments are removed first, because all three legitimately
contain brackets — JSON-LD arrays, CSS selectors like `[data-theme-toggle]`,
and the bundled theme/menu scripts. Bracket characters written as HTML entities
(`&#91;`, `&lbrack;`) are decoded first so they cannot hide behind escaping, and
the two legal routes must exist in the build, so a dropped route cannot make an
empty scan look like a pass.

There is no opt-out comment on purpose: at the moment no page needs a real
square bracket, so "square brackets mean unfinished" holds site-wide. If that
ever changes, edit the script in the same commit as the text that needs one.

### Page weight — `npm run check:weight`

[`scripts/check-weight.mjs`](scripts/check-weight.mjs) fails the build when a
page's gzipped HTML, CSS or total crosses a budget. It exists because
performance regressions are invisible to every other gate here: a page that gains
a second stylesheet or a charting library still typechecks, still passes axe,
still has working links, and still scores well on an idle laptop. The only place
it shows up is in the bytes.

It measures what a visitor downloads — the page's HTML, every same-origin
stylesheet, every script and `modulepreload`, each distinct file counted once —
and reports the heaviest pages so a slow drift is visible before it trips.
Images and fonts are deliberately **not** counted: a hero photograph is a product
decision rather than a regression, and folding it in would turn the budget into
"did we add a picture", which is how a gate starts crying wolf. Sizes are
gzipped, using gzip rather than Brotli because it is the conservative bound.

The budgets live in the script with the measured figures beside them, so raising
one is a deliberate, reviewable act rather than a quiet edit.

### Everything at once

```bash
npm run verify   # recipes → blog links → blog dates → sync guard → build
                 # → placeholders → links → weight → SEO → a11y → tests
```

## Project structure

```text
src/
├── assets/
│   ├── authors/          author portraits (optional; see src/assets/authors/README.md)
│   ├── blog/             post cover images + generation prompts (see
│   │                     src/assets/blog/README.md)
│   ├── brand/            logo mark, banner, social square (generated)
│   ├── recipes/          video thumbnails (downloaded by `npm run recipes`)
│   └── screens/          13 app screens cut from the product design board (generated)
├── components/           Header, MobileMenu, Footer, ThemeToggle, Logo, Button,
│                         SectionHeading, FeatureCard, AppScreenshot, FAQ,
│                         DownloadCTA, RecipeCard, VideoEmbed, PostCard, TopicRail,
│                         Breadcrumbs, PostByline, TestimonialCard, Icon, JsonLd,
│                         PolicyHistory
├── content/
│   └── blog/             one Markdown file per post (the file name is the URL)
├── data/                 site, navigation, features, faq, screenshots, testimonials,
│                         recipes.json (generated) + recipes.ts (typed loader),
│                         blog.ts (validated blog loader), authors.ts (who writes),
│                         products.ts, schema.ts (site-wide JSON-LD),
│                         deletion.ts (request route), legal-history.ts (version history)
├── layouts/BaseLayout.astro
├── lib/
│   ├── icons.ts          inline stroke icon set (no icon package)
│   ├── breadcrumbs.ts    one crumb array -> visible trail + BreadcrumbList
│   ├── post-slug.ts      the one slug function, shared by the loader and the data layer
│   ├── youtube.ts        the embed host and the watch URL, in one place
│   └── recipe-schema.mjs validator shared by the build and the sync script
├── pages/                index, features, products, recipes (+ one page per dish at
│                         recipes/[id]), blog (+ rss.xml, tag/[tag] and author/[author]),
│                         web-app, android, about, contact, privacy, terms,
│                         delete-account, 404
├── content.config.ts     blog collection: frontmatter schema + slug generation
└── styles/               tokens.css, global.css, components.css, utilities.css
public/                   favicon, icons, manifest, robots.txt, og-image
scripts/
├── lib/                  decisions shared by more than one script
│   ├── editorial-gaps.mjs          phrases the videos publish that no post answers
│   └── editorial-reminders.mjs     which reminders should be open, and what they say
├── extract-assets.mjs    re-derive every image from the supplied brand kit
├── sync-recipes.mjs      fetch the recipe snapshot from the YouTube feed, and report
│                         what a new video still needs written
├── editorial-reminders.mjs  open and close the issues tracking unwritten-about videos
├── blog-images.mjs       blog cover art -> WebP (q75) + frontmatter, and the prompts
├── check-links.mjs       link / anchor / sitemap integrity of the built site
├── check-placeholders.mjs fail on `[bracketed]` text left in a built page
└── check-a11y.mjs        WCAG A/AA audit of the built site (axe-core)
```

The two workflows live one level up, in `.github/workflows/`:
[`ci.yml`](../.github/workflows/ci.yml) (checks every push and pull request) and
[`sync-recipes.yml`](../.github/workflows/sync-recipes.yml) (the scheduled recipe sync).

## Asset pipeline

**The supplied brand kit is the visual source of truth.** Nothing is invented: the logo,
palette and app screenshots are all derived from the assets you provided.

All committed images are generated by `npm run assets`, which reads the read-only asset
drop that sits next to this repository (`../asset/HealThaali Assets`) and writes:

- `src/assets/screens/*.png` — the 13 app screens, cropped from the design board at
  coordinates documented in the script
- `src/assets/brand/logo-mark.png` — the HT monogram, trimmed and transparent
- `src/assets/brand/banner.jpg`, `social-square.jpg` — brand photography
- `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png`
- `public/og-image.jpg` — the 1200×630 social card

`../asset/` is git-ignored, so a fresh clone already contains the generated output; the
script only needs the source drop if you want to re-derive it.

Recipe thumbnails are the one set of images **not** produced by `npm run assets` — they
come from the channel's videos and are downloaded by `npm run recipes`. See below.

## Recipes

The `/recipes` page is generated from real, public, structured data: the HealThaali
channel's YouTube Atom feed. No API key, no OAuth, no scraping.

```bash
npm run recipes                # fetch new videos, update the snapshot
npm run recipes -- --dry-run   # show what would change, write nothing
npm run check:recipes          # validate what is committed (offline)
npm run recipes -- --report out.md   # …and write a Markdown summary of the run
```

`--report <path>` writes a short Markdown digest of what the run found — the new videos
with links and dates, anything retitled, anything kept although the feed dropped it, and
an explicit "nothing new" when that is the case. It is written on **every** run,
including one that changes nothing, which is what lets the scheduled workflow decide what
to do by reading a file instead of interpreting an exit code. See
[Scheduled recipe sync](#scheduled-recipe-sync).

The digest also answers the editorial half of a new upload: for the videos the run added
or retitled, it lists the phrases no post covers yet, and whether any post carries the
video at all. That is the same question `npm run report:gaps` asks of the whole library,
through the same rules (`scripts/lib/editorial-gaps.mjs`), asked at the moment it is
worth asking — the morning after the video goes out, in the pull request a reviewer is
already reading. It reports and never fails: a new video with nothing written about it is
the normal state of a new video.

A pull request gets merged, though, so the same job keeps the finding in the issue
tracker as well: `npm run reminders` opens one labelled issue per video no post carries,
with the phrases that need answering in the body, and closes it again with a comment
naming the post once one does. It runs on every scheduled run rather than only the ones
with news, because closing is the half that needs no news — the writing lands in an
ordinary push and the next run tidies up. The decision it makes is
`scripts/lib/editorial-reminders.mjs`, so what gets opened can be tested without a token
or a network.

The channel is set by `--channel` / `YOUTUBE_CHANNEL_ID` (a `UC…` id, an `@handle` or a
channel URL) and defaults to the verified HealThaali account already linked from
`src/data/site.ts`.

### The build never touches the network

`npm run recipes` is the **only** thing that talks to YouTube. It writes
`src/data/recipes.json` and the thumbnails under `src/assets/recipes/`, and the site is
then built entirely from those committed files. CI stays offline and deterministic,
`npm run build` is reproducible, and a YouTube outage cannot fail a deploy.

It also makes a scheduled sync clean: `updatedAt` records when the recipe list last
*changed*, not when the script last ran, so re-syncing with nothing new leaves the file
byte-for-byte identical and produces no diff to commit.

### The snapshot never shrinks on its own

The feed is a rolling window of the ~15 most recent videos, so "replace the file with
the feed" would silently delete older recipes as new ones are posted. The sync merges by
video id instead — the feed updates and inserts, nothing is ever removed. `--prune`
exists but refuses to run while the recipes it would delete are still in the snapshot,
because an absent video usually means "older than the feed window", not "deleted".

### What is stored, and what is deliberately not

Verbatim from the feed: `titleOriginal`, `description`, `published`, `url`. Derived for
display, with the original kept alongside: `title` (hashtags removed) and `summary`
(first paragraph, bare URLs removed, clamped to 180 characters).

**View counts and star ratings are read by the feed and deliberately not stored.** A
number snapshotted into a repository goes stale, and this site does not publish numbers
it cannot stand behind. `duration` is not in the feed, so it is omitted rather than
guessed at.

Nothing is rewritten by hand. If a title reads badly, fix it on YouTube and re-sync.

### Instagram

Instagram has no equivalent public structured feed — its oEmbed and Graph endpoints are
token-gated — so Instagram posts are added by hand to `recipes.json` with
`"source": "instagram"`, and a sync preserves them. Scraping was rejected on purpose: it
breaks without warning, which is the opposite of what a content page should do.

### Each dish has a page, and the video plays there

Every recipe also gets its own page at `/recipes/<video id>`, built from the snapshot by
[`src/pages/recipes/[id].astro`](src/pages/recipes/[id].astro). The card's play button starts
the video where the thumbnail already is, and the dish's page plays it in a player box. Both
are the same click-to-play figure a blog post writes by hand, rendered here from
[`VideoEmbed.astro`](src/components/VideoEmbed.astro) instead: **nothing is requested from
Google until the button is pressed**, and before the page's script runs the control is a plain
link to the same video.

The address is the video id, not the title. A title is whatever the channel called the video
and can be edited on YouTube at any time, after which the next sync would rewrite it — and
every URL, sitemap entry and inbound link built from it would move. The id cannot change. The
words a reader searches for are in the page's title, heading and description, which is where
they belong.

The page states what it is: the video, the description that was published with it (hashtag
lines removed, nothing else edited, and no ingredient list compiled out of a title), the same
medical disclaimer the blog carries, and up to three other dishes. There is deliberately no
calorie table and no `recipeIngredient` markup, because nothing on this site has measured a
dish it has not cooked; the app is where a plate is counted against your own portions.

A dish whose `source` is not `youtube` gets no player at all — the snapshot allows a hand-added
Instagram entry, and there is no id this site can embed for one — so the card and the page link
out to where the video really is, and name the site it is on.

Structured data follows from that: the listing is an `ItemList` of `VideoObject` with a stable
`@id`, and each dish's `VideoObject` is `isPartOf` it. The blog's embeds stay hand-written in
Markdown — see [Videos in a post](#videos-in-a-post).

### Validation

One validator — [`src/lib/recipe-schema.mjs`](src/lib/recipe-schema.mjs) — is shared by
the sync script (before it writes anything) and by the loader at import time. A missing
title, a duplicate id, a malformed link or a thumbnail that was never downloaded fails
`npm run build` with the exact field at fault, instead of shipping a broken card.
`npm run check:recipes` runs the same checks offline in about a second.

With an empty snapshot the page renders an honest "being filmed" state and the homepage
teaser disappears entirely. No placeholder dishes — the same rule as
`src/data/testimonials.ts`.

Astro then optimises those sources (AVIF/WebP, responsive `srcset`, correct dimensions) at
build time via `astro:assets`.

### Brand tokens

Colours are sampled from the supplied logo and app UI and defined once in
[`src/styles/tokens.css`](src/styles/tokens.css) — primary green `#2a8a33`, accent orange
`#f06000`, gold `#e0a93a`, cream `#fdfbf5`. Components never hardcode a colour.

> **Note on naming:** the wordmark is **HealThaali** (Heal + Thaali). The domain
> `healthaali.in` and the social handles `@healthaali` keep their existing spelling.

## Blog

Posts are Markdown files in `src/content/blog/`. The file name becomes the URL:

| File | Published at |
| --- | --- |
| `protein-101.md` | `/blog/protein-101` |
| `kitchen/less-oil.md` | `/blog/kitchen/less-oil` |

Frontmatter is validated at build time by
[`src/content.config.ts`](src/content.config.ts). `title`, `description` and `publishedAt`
are required; `updatedAt`, `tags`, `author`, `cover`, `coverAlt` and `draft` are optional.
`author` names an entry in [`src/data/authors.ts`](src/data/authors.ts) and defaults to
the team byline; an unknown id fails the build with the list of known authors.

### Dating a post

A post is dated **1–2 days after the newest video it embeds**, using the upload timestamp in
[`src/data/recipes.json`](src/data/recipes.json). The blog explains cooking that has already
been filmed, so the date follows the video out rather than the other way round — and that
gives the archive a hard floor: no post is dated before a video it shows, because a post
cannot have explained a video that did not exist yet. `npm run check:blog-dates` enforces
that floor — see [Blog dates](#blog-dates--npm-run-checkblog-dates) — while the size of the
gap is printed there rather than gated.

It is also why the posts run across the channel's own timeline (February to September 2026)
instead of sitting on an evenly spaced ladder of recent dates, which is what a set of posts
written in one sitting otherwise looks like. Where two posts embed the same newest video, the
later one takes the following day so no two posts share a date. `updatedAt` is a different
field and stays absent until a post has actually been revised.

### The file name is the URL

There is no `slug:` override. An explicit `generateId` points the collection at the single
slug function in [`src/lib/post-slug.ts`](src/lib/post-slug.ts), so `Picking Protein 101.md`
and `picking-protein-101.md` both publish at `/blog/picking-protein-101`.

That indirection is not cosmetic. Astro's default would forward a frontmatter `slug:`
verbatim, **and it keys entries by id — so two files that reduce to the same slug collapse
into one store entry and the later file silently replaces the earlier.** By the time
`getCollection` runs, one post has simply disappeared with nothing in the build log. The
data layer therefore reads the directory itself and fails the build naming both files:

```text
[blog] Fault Dup.md and fault-dup.md would all publish at /blog/fault-dup. Only one
       entry per URL survives, so the others would vanish without a warning. Rename them.
```

This applies to drafts too, and it matters: a draft named `Kitchen Notes.md` would
otherwise silently remove the published `kitchen-notes.md` from the site.

### Body headings start at `##`

The page title is the `<h1>`, so a `#` heading in a body renders a second one. No WCAG rule
flags a duplicate `<h1>`, which means the accessibility gate would not catch it — so the
build rejects it instead, naming the file. Fenced code blocks are stripped first, so a `#`
comment in a shell snippet is fine.

### Covers, and the prompts for them

`cover:` names a file in `src/assets/blog/` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`) and
`coverAlt` is required alongside it. A name that does not resolve fails the build and lists
the files that do exist:

```text
[blog] "protein-101" points at cover "protein.jpg", which is not in src/assets/blog/.
       Available: protein-101.jpg
```

Astro resizes and re-encodes the cover at build time for each size the page asks for. The
listing card renders it with empty alt text because the headline beside it already names the
post; the meaningful description is used on the post page, in `og:image:alt` and in the
post's `ImageObject`.

The six launch posts were written before their artwork existed, so the images were specified
first and generated later. Rather than commit placeholder art, the prompts live in
the manifest at the top of [`scripts/blog-images.mjs`](scripts/blog-images.mjs), next to the
alt text they describe, and the script does the wiring:

```bash
npm run blog:images               # convert what exists, report what does not
npm run blog:images -- --prompts  # rewrite src/assets/blog/PROMPTS.md
```

- The artwork is saved as `asset/blog/<post-file-name>.png` (that folder is git-ignored).
- The script converts it to **WebP at quality 75, 1600 px wide** in `src/assets/blog/`, and
  inserts `cover:` and `coverAlt:` into that post's frontmatter. The format and the setting
  live in the script rather than in a note somebody has to remember.
- **A missing image is not a failure.** The post simply has no cover: the card renders
  without media, the post page without a hero image, and nothing claims otherwise.
- `coverAlt` is written before the picture exists, and the script will not overwrite a cover
  you set by hand. If the image you generate shows something else, change the alt text in
  the manifest and re-run — an alt text that does not match the picture is worse than none.

### Videos in a post

A post can play one of our recipe videos on the page. The Markdown carries the whole figure,
because a `.md` file cannot use a component:

```text
<figure class="yt-embed" data-yt="EiDdnn9bd9w" data-yt-title="A 490-calorie lunch" data-yt-shape="vertical">
  <a class="yt-embed__fallback" href="https://www.youtube.com/shorts/EiDdnn9bd9w" target="_blank" rel="noopener noreferrer">
    Watch it on YouTube
  </a>
  <figcaption>What the video shows, and why it is here.</figcaption>
</figure>
```

Four rules are enforced by `parseVideos` in [`src/data/blog.ts`](src/data/blog.ts), and each
one fails the build naming the post. They exist because every one of these mistakes produces
a *quietly* broken player instead of an error:

1. `data-yt` must be exactly 11 URL-safe characters. A malformed id renders "video
   unavailable".
2. `data-yt-title` is required. It is the `<iframe>`'s accessible name, so without it the
   video cannot be announced at all.
3. A `<figcaption>` is required, and `data-yt-shape` must be `wide` (16:9) or `vertical`
   (9:16, for the Shorts the channel publishes).
4. The fallback link must end with the video id. Without JavaScript that link *is* the
   embed, and a link to a different video would break the page for exactly the reader who
   has the least.

**Nothing is fetched from Google until someone presses play.** The figure renders as a
button (built from the same icon set as the rest of the site); the `<iframe>` is created from
`youtube-nocookie.com` on the click, and the count of `data-yt` attributes must match the
number of complete figures, so an embed that renders but is missing from the structured data
is a build failure too.

That is also why `frame-src https://www.youtube-nocookie.com` is in the CSP and why the
player's host is not something a post can choose. Recipe cards and dish pages use the same
figure, from a component rather than from Markdown — see
[Each dish has a page](#each-dish-has-a-page-and-the-video-plays-there) for what those add.

The structured data is derived from the embeds rather than repeated in frontmatter: one
`VideoObject` per video, inside the post's `BlogPosting`. If the id is one of the channel's
own videos then `uploadDate`, `thumbnailUrl` and the description come from the committed
recipe snapshot — real values from the one place they are stored. A video that is not in the
snapshot gets a name and a URL and nothing invented.

### Topics and related posts

A post's `tags` are free text. Every tag actually in use gets its own page at
`/blog/tag/<slug>`, built from the published posts — there is no hand-maintained list of
topics, so a tag appears when its first post does and disappears with its last one.
`/blog` shows the same set as a rail of chips, most-used first, with the current topic
marked by `aria-current` rather than by colour alone.

Slugs use the same shared rules as post URLs, with one difference: a tag is always a
**single** URL segment, so a slash becomes a dash. `High protein`, `high-protein` and
`high_protein` are therefore the same topic — which is deliberate, and why two tags that
reduce to one slug **fail the build**, naming both:

```text
[blog] the tags "High protein" and "high-protein" both resolve to
       /blog/tag/high-protein. One page would replace the other — rename one of them.
```

A tag with no URL-usable characters (`"…"`, `"!!!"`) is rejected for the same reason: it
would generate `/blog/tag/`, a duplicate of the blog index.

`/blog/tag/` is a reserved directory. A post saved under it would be written to the same
paths as the topic pages, one silently overwriting the other depending on build order, so
the build refuses it:

```text
[blog] "tag/notes.md" would publish under /blog/tag/…, which is where the topic pages
       live. Move it out of that directory — the two would overwrite each other.
```

**Related posts** are ranked by how many tags they share, then by recency, and capped at
three. A post that shares nothing with this one is left out rather than padded in, so a
post with no overlapping tags renders **no related section at all** — the section heading
explains the rule when it does appear, because a "related" list that links unrelated posts
is worse than none.

Tag chips are links on a post page but plain text inside a listing card. That is not an
oversight: `PostCard` is deliberately a single-link component whose title link carries an
`::after` overlay across the whole card, and a second interactive element underneath that
overlay would be unreachable by keyboard and mouse alike.

With no posts there are no tags, so no topic pages are generated and no rail is rendered —
the same empty-state rule as the rest of the blog.

### Authors and bylines

Who wrote a post is data, not copy. [`src/data/authors.ts`](src/data/authors.ts) holds one
entry per author — name, `role`, a short `bio`, the profiles that belong to them, and
whether they are the team or a named individual.

There are two entries. **Nehal Masood** is typed as a `Person` and is who every post names
today; **HealThaali Kitchen** is the team, typed as an `Organization`, and is the fallback
for a post that names nobody. Every value in both entries was supplied by the person or the
brand it describes — no invented portrait, job title or credential, and no `sameAs` pointing
at the brand's accounts, because those are the brand's and not a person's.

**A post states its own author.** `author: nehal-masood` in the frontmatter is the claim;
the default is the team rather than the person, so a future post cannot be attributed to her
by accident. A byline nobody wrote is the kind of claim this site avoids everywhere else.

- `/blog/author/<id>` is generated for authors **with a published post**, from the posts
themselves, so an author page cannot exist without a byline pointing at it or vice versa.
- The page carries a `ProfilePage` whose `mainEntity` is the author, plus the posts as
  `hasPart`. `mainEntity` is built by the same function the byline uses, so the page a
  visitor reads and the entity a crawler reads cannot describe different people.
- The byline shows the author's own photograph when one has been supplied, and a monogram —
  their initials — instead of a stand-in face when none has; the schema carries no `image`
  until a real photograph exists. Nehal Masood's portrait is supplied today — see
  [`src/assets/authors/`](src/assets/authors/README.md) for the file and how it was made —
  while the team byline, which has no picture of a person, still draws `HK`.
- A post's `author` is the full node: `jobTitle` and `worksFor` for a person, pointing at the
  site-wide `Organization`; `parentOrganization` for the team, so a crawler can get from
  "HealThaali Kitchen wrote this" to the brand the rest of the site describes.
- Adding a real photograph is two steps and no code: put the file in
  `src/assets/authors/`, then name it in the entry's `portrait`. Naming one that is not on
  disk fails the build with the list of files that do exist.

### Breadcrumbs

One array, in [`src/lib/breadcrumbs.ts`](src/lib/breadcrumbs.ts), produces both the visible
trail and the `BreadcrumbList`. Written separately they drift: a page gets renamed and only
one of the two is updated, and search results start showing a path the site no longer
serves.

Every crumb carries its own `href`, including the last one — the schema wants a URL for
every step, and a breadcrumb that links to the page you are already on is the one thing a
breadcrumb must not do. `Breadcrumbs.astro` decides: the final crumb is plain text with
`aria-current="page"`. The separators are CSS `::before` content, so a screen reader
announces the stops rather than the slashes between them.

### The feed

`/blog/rss.xml` is generated from the same posts with no feed library. Escaping (including
the C0 control characters XML 1.0 forbids) is done by hand, and `lastBuildDate` is omitted
when there are no posts rather than stamped with the build time — a build with no new posts
therefore produces a byte-identical file. It was verified by parsing the output with a real
XML parser: a post whose title contains `&`, `<b>` and a quoted phrase decodes back to
exactly that text, and the document reports no parser error.

### External links in a post body

A Markdown link to another site behaves like an ordinary link and opens in the same tab.
The site's own components add `target="_blank" rel="noopener noreferrer"` to verified
external destinations; auto-rewriting author-written Markdown links would need another
dependency, and silently changing how an author's link behaves is worse than the
inconsistency.

### The empty state is still there

The blog's empty state was written before the first post and has been kept since, through every batch of posts added after it.
It is not decoration: with no published posts, `/blog` renders "the first post is being
written" and points at `/recipes`, no topic pages are generated, and the RSS feed omits
`lastBuildDate` rather than stamping the build time.

Two consequences of that state are expected when it happens, and neither is a bug:

- `[WARN] [glob-loader] No files found matching …` in the build log while the directory has
  no posts.
- `/blog` stays indexable and stays in the sitemap. Excluding a `noindex` page from the
  sitemap is consistent, but a single thin page that is linked from the navigation anyway
  would gain nothing from being hidden, and the empty state is real content rather than a
  stub.

### What gets written next

The blog is written to answer questions people actually type, in the order they
type them — not to fill a calendar. Three rules decide what gets a post:

- **It has to be a real question with a real answer.** “How much protein is in
dal” and “is soya bad for men” are asked constantly and have honest answers. A
topic that only exists to mention the app gets folded into a post that already
exists.
- **It has to be answerable without inventing anything.** See the content policy
above: no invented features, ratings, certifications or company details. That is
why there is no post on managing a diagnosed condition — the useful version of
that answer is a doctor's, and a blog that says so is more trustworthy than one
that guesses.
- **It has to belong to the cluster.** Every post links to at least two others
(enforced), so a topic that does not connect to anything already published is a
sign it is the wrong topic, or that something else should have been written
first.

The queue, roughly in the order these earn their place:

| Topic | The question it answers |
| --- | --- |
| Millets, brown rice and multigrain atta | “Are the premium swaps worth it?” — mostly a fibre and price story, not a calorie one |
| Roti or rice | Already answered inside the weight-loss post; only worth its own page if the search data says so |
| Ghee, coconut oil, mustard oil | Which fat, and whether any of them is special — sizing up the oil post |
| Fasting and festival weeks | Navratri, Ekadashi, Ramadan: what changes and what does not |
| A week of dinners | The balanced plate applied to seven real evenings, one of them a failure |

Anything medical-adjacent — PCOS, thyroid, diabetes management — is deliberately
absent rather than pending. The honest version of those posts is “ask your
doctor for the version that applies to you”, which this blog already says in the
disclaimer on every page; a longer post would add words, not information.

### Writing a post, end to end

1. Write the Markdown in `src/content/blog/` — body headings start at `##`, and the file
   name is the URL.
2. Embed any recipe video with a `<figure class="yt-embed">` block (above), or none at all.
3. Set `publishedAt` one or two days after the newest embedded video's upload date — see
   [Dating a post](#dating-a-post) for why.
4. Add a cover: put the artwork in `asset/blog/<file-name>.png` and run
   `npm run blog:images`.
5. Link it to at least two other posts — `npm run check:blog-links` prints the graph and
   fails if the new post is short or is left as an orphan.
6. Run `npm run verify`. It type-checks, builds, and then checks placeholders, links, page
   weight and accessibility against the built output — which is where a missing alt text, a
   broken internal link or an over-budget page shows up.

## Products

`/products` is the hub for what exists today, generated from
[`src/data/products.ts`](src/data/products.ts). Every availability state is derived from the
same environment variables the rest of the site uses, so setting `PUBLIC_ANDROID_URL`
changes `/products`, `/android` and the header call to action together. The app's feature
list is `pillars` from [`src/data/features.ts`](src/data/features.ts) — the same array the
homepage renders — so a rename there cannot leave this page advertising something that no
longer exists.

There is **no price field anywhere**, because no price has been supplied. Android and the
browser app are one product on two platforms, so they appear as platform rows inside a
single offering rather than as two cards, and the header navigation carries one "Products"
item instead of one per platform.

## Theme system

Light, dark and system are all supported:

- The preference lives in `localStorage` under `healthaali-theme` (as specified in the
  build guide), with values `light`, `dark` or `system`.
- An inline script in `<head>` applies the theme **before first paint**, so dark mode never
  flashes white.
- The header toggle cycles System → Light → Dark. All three states are rendered up-front and
  revealed by `[data-theme]` on `<html>`, so the right icon shows even before JavaScript runs.
- `prefers-reduced-motion` is respected throughout.

## SEO

- Unique `<title>`, `<meta name="description">` and canonical URL per page
- Open Graph + Twitter card with a generated 1200×630 `og-image.jpg`
- `@astrojs/sitemap` generates `sitemap-index.xml` at build time
- `robots.txt` points at that sitemap
- JSON-LD, with every `url`/`logo` written as an absolute URL:
  - **Site-wide `Organization` + `WebSite`** on every page, emitted once from
    `BaseLayout` out of `src/data/schema.ts` as a single `@graph`. The
    `Organization` carries the real 512×512 `icon-512.png` logo, the support
    inbox (`email` + a `customer support` `ContactPoint`), the verified social
    profiles in `sameAs`, and the legal identity from `site.legal`:
    `legalName` plus a `PostalAddress` with locality, region and
    `addressCountry: "IN"`. **No `streetAddress`, company number, `vatID`,
    `founder` or `foundingDate`** is emitted, because none has been supplied.
    The `WebSite` points at the `Organization` through `publisher`. Both nodes
    have stable `@id`s, so the brand, the site and the contact address read as
    one entity — and other nodes (e.g. `ContactPage`) reference that `@id`
    instead of declaring a second organisation. There is **no** `SearchAction`:
    the site has no search page, and inventing one would advertise a URL it does
    not serve.
  - **The legal node and the legal pages share one source.** `legalName` and
    `address` are read from `site.legal` in `src/data/site.ts` — the same object
    `/privacy` and `/terms` render — and the prose sentence is derived from
    `legalAddress` rather than typed twice. A crawler and a visitor therefore
    cannot be told different cities, and adding a real registered address would
    update the page and the markup in the same edit.
  - `SoftwareApplication` on the homepage, `BreadcrumbList` on inner pages,
    `Blog` on the listing, `BlogPosting` on each post, `CollectionPage` on each
    tag page, `ProfilePage` on each author page, `ContactPage` on `/contact`,
    `ItemList` of `VideoObject` on `/recipes` and one `VideoObject` on each
    dish's page, which is `isPartOf` that list by `@id`
  - **A post is described as what it is**: `wordCount`, `articleSection` and
    `keywords` from the post itself, an `ImageObject` with the cover's real
    dimensions, `author` from the author registry, `publisher` and `isPartOf`
    pointing at the site-wide `Organization` and the blog's `Blog` node by `@id`,
    and one nested `VideoObject` per embedded video
  - **Article Open Graph fields on posts only**: `og:type=article` plus
    `article:published_time`, `article:modified_time`, `article:author` and one
    `article:tag` per tag. `og:image:alt` and `twitter:image:alt` carry the
    cover's alt text — a social card is read aloud like any other image
  - **Breadcrumbs are visible and structured at once**, from one array
    (`src/lib/breadcrumbs.ts`): the trail a reader can click and the
    `BreadcrumbList` a crawler reads cannot describe different paths
- `/blog/rss.xml` — an RSS 2.0 feed, advertised with
  `<link rel="alternate" type="application/rss+xml">` on the blog pages
- One `<h1>` per page, descriptive alt text on every image, custom `404.astro`
- **No canonical URL on a `noindex` page.** `/404/` is not a URL this site
  serves (any unknown path returns `dist/404.html`), so `BaseLayout` omits the
  canonical and `og:url` tags whenever `noindex` is set instead of inventing
  one. `npm run check:links` would fail on it if it came back.

## Environment variables

Copy `.env.example` to `.env`. Only `PUBLIC_`-prefixed values reach the browser, and there
are no secrets in this project.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical origin (defaults to `https://healthaali.in`) |
| `PUBLIC_WEBAPP_URL` | Real web app URL. Empty → the site shows **coming soon** instead of a dead link |
| `PUBLIC_ANDROID_URL` | Google Play listing. Empty → **coming soon** |
| `PUBLIC_CONTACT_EMAIL` | Support address shown on `/contact` and in the footer. **Defaults to `info@healthaali.in`**; a blank value keeps the default rather than hiding it |
| `PUBLIC_CONTACT_ENDPOINT` | Form endpoint. Empty → the contact form is disabled and says so |
| `PUBLIC_ANALYTICS_ID` | Cloudflare Web Analytics token. Empty → no analytics at all |

One variable has no `PUBLIC_` prefix, because only the sync script reads it and it must
never reach the browser: `YOUTUBE_CHANNEL_ID` for `npm run recipes`. It is optional —
the verified channel is already the default.

**No placeholder URLs are ever linked.** Every "coming soon" button is a deliberately
disabled control that activates the moment the matching variable is set.

## Deployment

Static output, so any host works. Config for all three is already in the repo.

Everything in this section that lives in a dashboard rather than in the repository
— the Pages build settings, its watch paths, the custom domains, and the zone's
records — is written down with the values actually in use in
[`LAUNCH.md`](../LAUNCH.md). `npm run check:launch` re-derives that list from
public DNS, RDAP and HTTPS, and exits non-zero only on a real problem rather than
on items that are simply not done yet. Give it a read-only `CLOUDFLARE_API_TOKEN`
and it reads the dashboard settings themselves as well — the Pages build
configuration, the custom domains and the zone's records — since none of those
leave a public trace to infer from — including which revision is live: every page
carries `<meta name="build-commit">`, taken at build time from the host's own
environment variable (`CF_PAGES_COMMIT_SHA` on Pages, `GITHUB_SHA` in Actions,
`COMMIT_REF` on Netlify, `VERCEL_GIT_COMMIT_SHA` on Vercel), so the deployed
artefact can be traced to a commit without opening a dashboard. The same check
runs unattended every six
hours in
[`launch-check.yml`](../.github/workflows/launch-check.yml), which installs
nothing but Node, so a dependency problem can never masquerade as a deployment
problem. It is not part of `npm run verify`, which stays offline and hermetic on
purpose.

### Cloudflare Pages (recommended — free, no Node server needed)

1. **Create the project** — *Workers & Pages* → *Create* → *Pages* → *Connect to
   Git*, authorize GitHub, and pick this repository.
2. **Build settings** (*Set up builds and deployments*):

   ```text
   Production branch:      main
   Root directory:         website   ← advanced field; the Astro app is in this subdirectory
   Build command:          npm run build
   Build output directory: dist
   ```

   `website/.nvmrc` pins the build to Node 22, the same major version CI and
   `netlify.toml` use. Nothing to set in the dashboard.
3. **Environment variables** are optional — with none set the build produces the
   honest "coming soon" state described above. Add real values under *Settings* →
   *Environment variables* (Production) and redeploy to apply them.
4. Pushes to `main` deploy to production; every pull request gets a preview URL.
   The first build prints a `*.pages.dev` address that already serves the site,
   before any DNS change.
5. **Build watch paths** (*Settings* → *Build* → *Build watch paths*): set the
   include paths to `website/*` and leave the excludes empty. The dashboard
   defaults to `*`, which means every push rebuilds the site — including commits
   that only touch this repository's `.github/` directory or its launch notes at
   the root. Wildcards match across `/`, so `website/*` also covers nested files
   like `website/src/pages/index.astro`. Pages skips path matching and always
   builds when a push has no file changes or spans 3000+ files / 20+ commits.
   This setting exists only in the dashboard; nothing in the repository
   expresses it.

### Custom domain and DNS (the domain is registered at GoDaddy)

Add the domain in *Custom domains* → *Set up a custom domain*. What works next
depends on who runs DNS for `healthaali.in`:

- **Move the zone to Cloudflare (recommended).** Both `healthaali.in` and
  `www.healthaali.in` are then one click each: Cloudflare writes the records,
  flattens the apex CNAME, and issues the certificate. The HTML is built for the
  apex origin (`PUBLIC_SITE_URL` defaults to `https://healthaali.in`), so this is
  the configuration the canonicals and sitemap already assume.
  To move it: Cloudflare → *Add a site* → `healthaali.in` (Free plan) → copy the
  two nameservers → GoDaddy → *Domain settings* → *Nameservers* → *Change* → paste
  them. Cloudflare imports existing records during setup: **confirm any MX/TXT mail
  records survived before the change goes through.**
- **Keep DNS at GoDaddy.** External DNS cannot host the apex on Pages — GoDaddy
  does not allow a CNAME at the root. Only `www` works: add a GoDaddy CNAME record
  `www` → `<project>.pages.dev` (the Pages wizard shows the exact target), then
  forward the apex to `https://www.healthaali.in` with GoDaddy forwarding. Set
  `PUBLIC_SITE_URL=https://www.healthaali.in` and redeploy, otherwise canonicals,
  `og:url` and the sitemap keep naming a host that is not serving the page.

### Other hosts

**Netlify** — `netlify.toml` is committed, so there is nothing to configure in the UI.

**Vercel** — `vercel.json` is committed (`framework: astro`, output `dist`).

No Node server or SSR adapter is required. `dist/404.html` is generated from
`src/pages/404.astro` and every one of these hosts serves it for unknown paths
automatically — no redirect rule needed.

### Security and cache headers

[`public/_headers`](public/_headers) holds the `Content-Security-Policy`,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`,
plus immutable caching for the fingerprinted `_astro/` assets. Astro copies it to
`dist/_headers`, and **both Cloudflare Pages and Netlify read it from there** — so
one file configures two hosts. Vercel does not read `_headers`, so
`vercel.json` mirrors the same values; change one, change the other.

Two things in that CSP are deliberate and load-bearing:

- `script-src` and `style-src` allow `'unsafe-inline'` because the theme boot script
  (which must run before the first paint so dark mode never flashes), the JSON-LD
  blocks and Astro's inlined stylesheets are all inline by design.
- **`form-action` is intentionally absent.** The contact form posts to
  `PUBLIC_CONTACT_ENDPOINT`, which does not exist yet, so any value would be a guess
  that could silently break the form the day you wire it up. `public/_headers`
  contains the exact line to add once the endpoint is real.
- **`frame-src` allows exactly one host: `https://www.youtube-nocookie.com`.** A video
  can be played on a blog post, a recipe card and a dish's page, and that is the only frame
  any of them may load. `youtube-nocookie.com` sets no cookie until the video is played, and
  the player is fetched only after the reader presses play — so no third-party script or
  frame is requested while a page loads, and `script-src` stays `'self'` plus Cloudflare's
  beacon. What that means for a reader's data is stated on `/privacy`, and the version
  history there records when it was added.

### Verified Lighthouse results

A periodic manual measurement, not part of CI — see **Quality gates** above for
what is actually enforced. These figures come from the built `dist/` served
**locally**, with the real headers applied so the deployed CSP is in force, which
makes them a floor rather than the production number: the live site is served
over HTTP/2 with compression at the edge. To replace this table with deployed
figures, run the recipe in
[`LAUNCH.md`](../LAUNCH.md#6-measuring-the-deployed-site) §6 and record the date.

| Page | Mode | Perf | A11y | Best practices | SEO |
| --- | --- | --- | --- | --- | --- |
| `/` | Mobile | 99 | 100 | 100 | 100 |
| `/` | Desktop | 100 | 100 | 100 | 100 |
| `/features` | Mobile | — | 100 | 100 | 100 |
| `/contact` | Mobile | — | 100 | 100 | 100 |
| `/privacy` | Mobile | — | 100 | 100 | 100 |

LCP 2.0 s / TBT 0 ms / CLS 0 on throttled mobile. The remaining non-perfect audits
are `unused-css-rules` (~14 KiB) and `render-blocking-insight` (~150 ms), both of
which shrink further behind real hosting, since this was measured over plain
HTTP/1.1 with no compression or HTTP/2 multiplexing.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and
pull request targeting `main`, and can be triggered by hand. One job:

```text
npm ci → npm run check → npm run check:recipes → npm run check:blog-links
       → npm run check:blog-dates → npm run check:sync-workflow → npm run build
       → npm run check:placeholders → npm run check:links → npm run check:weight
       → npm run check:seo → npm run check:a11y → npm run test:launch
```

Node 22 is pinned deliberately: [`.nvmrc`](.nvmrc) and `netlify.toml` set the same
major version for the real deployments, so CI tests the runtime the site actually
ships on. **No
environment variables are set.** Every `PUBLIC_` value is optional, and with all
of them empty the build produces the honest "coming soon" placeholder state —
which is exactly the state that should be verified.

The recipe step is offline on purpose: CI validates the committed snapshot and
never calls YouTube, so a sync that has not been run yet can never break the
build. Run `npm run recipes` locally and commit the result.

The accessibility step needs a Chrome or Chromium binary. GitHub's
`ubuntu-latest` image ships one at `/usr/bin/google-chrome`, which the script
finds on its own; nothing is downloaded. `CHROME_PATH` (or `--chrome <path>`)
overrides the search if a runner ever differs.

Two things CI deliberately does **not** do:

- **It never contacts external URLs.** See the link-check notes above. If you
  want those covered, add a scheduled workflow that runs
  `npm run check:links:external`.
- **It does not gate on Lighthouse performance.** Performance scores track the
  runner's CPU and are the classic source of flaky CI. The two remaining
  non-perfect audits are listed in the table above and tracked by hand.

Both browser-driven devDependencies — `axe-core` and `puppeteer-core` — are
never part of the deployed output, and the project reports **zero
vulnerabilities** from `npm audit`, production and development alike.

## Scheduled recipe sync

[`.github/workflows/sync-recipes.yml`](../.github/workflows/sync-recipes.yml) runs once a
day at 03:00 UTC (08:30 IST) and can be dispatched by hand. It fetches the channel's
feed, updates the committed snapshot, and proposes the change as a pull request.

**On most days it does nothing at all**, and that is the designed outcome:

```text
npm ci → npm run recipes → did the working tree change?
                            ├── no  → stop. No branch, no commit, no pull request.
                            └── yes → npm run verify → commit → push → open/refresh a PR
```

No interpreting is needed, because `npm run recipes` is already idempotent: it writes
`src/data/recipes.json` only when the assembled snapshot really differs from the file on
disk, and it preserves `updatedAt` across a no-op run so the file stays byte-identical.
Git, not the script, is the source of truth for "did anything change".

Each run appends its Markdown report to the workflow's step summary, so a quiet day still
leaves a readable record of what was checked.

### One pull request at a time

Everything is proposed on the single branch `automation/recipe-sync`. If a pull request
for that branch is still open, its commits and description are refreshed; if the previous
one was merged or closed, a new one is opened. A fresh branch each morning would bury the
repository in near-identical pull requests that a reviewer could not tell apart.

Only an **open** pull request is reused — the lookup is filtered by `--state open`. Without
that filter, GitHub's branch lookup would find the previous, already-merged pull request
and quietly edit that instead of opening a new one.

### Why it verifies the change itself

GitHub suppresses workflow runs for events caused by the repository's `GITHUB_TOKEN`,
which includes pull requests opened with it. **`ci.yml` therefore does not run on the pull
request this workflow creates.** Rather than hand over an unverified change, the job runs
`npm run verify` — typecheck, build, link integrity and accessibility — *before* it
commits anything. A change that fails those gates is never pushed and never proposed; the
run fails instead, which is visible in the Actions tab.

To have `ci.yml` show up as a check on the pull request, push with a personal access token
or GitHub App token instead of `secrets.GITHUB_TOKEN` and drop the verify step. The
trade-off is a long-lived credential in the repository, which is why the default is the
self-verifying job above.

### The push cannot clobber anyone

The job reads the remote's current commit with `git ls-remote` and then pins it:

```bash
git push --force-with-lease="refs/heads/$BRANCH:$REMOTE_SHA" …
```

A bare `--force-with-lease` would be worse than useless here, because a `git fetch` first
refreshes the very ref the lease compares against, so the lease would always pass. Pinning
the commit that was observed means a branch that moved in between — a hand edit, another
run — is rejected rather than overwritten. All of this was rehearsed against a throwaway
bare remote before being committed: the first push creating the branch, a lease that
matches going through, a stale lease being rejected with `stale info`, and the other
actor's commit surviving.

### Caveats

- GitHub disables scheduled workflows in repositories with no activity for 60 days. Any
  commit — including merging one of these pull requests — resets that clock, and
  `workflow_dispatch` runs it by hand at any time.
- Scheduled runs only fire on the default branch, and can be delayed at times of high load.
- GitHub sends failure notifications for a scheduled workflow **to the user who last
  edited the cron line**, not to the repository owner, and the runs are attributed to that
  same user. If their access is ever removed, the schedule stops silently.
- The workflow needs `contents: write` and `pull-requests: write`. If your organisation
  has restricted the default token to read-only, the push will fail loudly rather than
  silently doing nothing.
- Nothing was verified on a real runner: the repository has no remote, so this workflow has
  never executed on GitHub. Its git and shell logic was rehearsed locally against a
  throwaway repo, and the YAML was schema-validated with `@action-validator/cli` — which
  was also confirmed to reject a deliberately broken workflow, so the pass means something.

## Content policy

This site deliberately does **not** publish invented product claims. There are no ratings,
download counts, testimonials, awards or certifications, because none were supplied.

The `/privacy` and `/terms` pages carry real, operator-supplied legal details — entity,
entity type, location and governing law — held in `site.legal` in `src/data/site.ts`, with
the effective date coming from the version history instead (see **Legal version history**).
There is no pre-launch banner and no
`[square-bracket]` scaffolding left on either page: anything that could not be verified was
removed rather than guessed. Publishing a street address, a registered company number or a
certification claim would all be inventing a fact, so none appears. The site-wide
`Organization` structured data reads the same `site.legal` object, so the brand node and the
policies state the same entity. `npm run check:placeholders` now fails the build if that
scaffolding ever comes back — see **Quality gates**.

The blog is the same rule applied to prose: `/blog` ships with no posts rather than with
articles written to fill it. Add one and it appears in the listing, the feed and the
sitemap in the same build.

Account deletion gets its own route rather than a line in the policy — see **Account
deletion** below. Both documents are versioned, and each keeps its own history — see **Legal
version history**.

The published contact address is `info@healthaali.in` — a real inbox, which is why it is a
default in `src/data/site.ts` rather than a placeholder in `.env`.

`src/data/testimonials.ts` is intentionally empty — the reviews section on the homepage only
renders once real, attributable quotes are added.

## Account deletion

`/delete-account` is the request route the privacy policy points at, so the policy's
deletion section is a process rather than "email us and we will sort it out". It states the
exact scope of the deletion and gives the request as a message a visitor can copy or send
in one click.

- **In the app** — Settings → Data & Privacy, the route the policy already documents,
described in three steps.
- **By email** — a `mailto:` built in `src/data/deletion.ts` with a fixed subject
  (`HealThaali account deletion request`) and a plain-text body, so the request is one
  click and arrives in the support inbox in a form that can be matched to an account.
  Both parts are `encodeURIComponent`-encoded, so the newlines survive the `href`.

The same file feeds every link to the page, so the instructions and the route cannot
disagree. Three things it deliberately does **not** do:

- **No web form.** The site is static and no submission endpoint is configured, and a form
  that silently dropped a deletion request would be worse than an email link that works.
  If `PUBLIC_CONTACT_ENDPOINT` is ever set, copy the contact page's form pattern here.
- **No stated turnaround.** No response time has been supplied, so none is published —
  "within 30 days" would be a commitment nobody made. The page says we reply to confirm
  instead. Add a figure the moment the operator decides on one.
- **No app deep link.** No custom URL scheme or store URL exists yet, so the in-app route
  is described in words, and the page says the Android app is not published yet (driven by
  `hasAndroidApp`) rather than describing steps nobody can follow.

The route is linked from `/privacy#deletion`, `/terms` (Termination) and the footer's
Legal column — not the header, whose five items fill the row at 1024px.

## Legal version history

`/privacy` and `/terms` each end with a **Version history** list naming the date every version
took effect and what it changed. The date in the page header is read from the same list, so
the header and the history cannot disagree about which version is in force.

Both live in [`src/data/legal-history.ts`](src/data/legal-history.ts), one array per
document, as `{ effectiveDate, summary, details }`. Dates are ISO (`"2026-09-29"`) and
formatted with `Intl.DateTimeFormat("en-GB", { timeZone: "UTC" })`, which is why the entry
holds one field instead of a date plus a hand-written label — and UTC is what stops a
negative-offset build machine from printing the day before.

**Newest first is load-bearing.** The first entry is the current version, and it is labelled
as such from its position in the list rather than from a flag that could go stale. Two
build-time guards in that file protect the ordering, because a wrong "current version" is not
something a visitor can spot:

- an empty history, or an entry whose date is not `YYYY-MM-DD`, throws;
- entries that are not in descending date order throw, naming both dates.

`src/components/PolicyHistory.astro` renders the list for either document, so both histories
look identical and the `#history` anchor exists on both.

**The history starts at first publication.** No earlier versions are listed, because there
were none. Inventing a plausible-looking revision log would fabricate exactly the record this
file exists to keep straight, so the first entry says "First version" and nothing more. To
record a real change: add an entry at the top, describe what changed, and leave the previous
entry untouched — the previous dates stay visible on the page, which is the point.

## License

Proprietary — © HealThaali. All rights reserved.
