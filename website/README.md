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
| `npm run verify` | `check:recipes` + `build` + `check:placeholders` + `check:links` + `check:a11y` — exactly what CI runs |
| `npm run assets` | Re-derive every image from the supplied brand kit |
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

Three checks run against the **built** site rather than the sources, because that
is what a visitor receives. All are plain npm scripts, so CI and your terminal
execute the same code.

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

### Everything at once

```bash
npm run verify   # build → check:placeholders → check:links → check:a11y
```

## Project structure

```text
src/
├── assets/
│   ├── blog/             post cover images (hand-added; see src/assets/blog/README.md)
│   ├── brand/            logo mark, banner, social square (generated)
│   ├── recipes/          video thumbnails (downloaded by `npm run recipes`)
│   └── screens/          13 app screens cut from the product design board (generated)
├── components/           Header, MobileMenu, Footer, ThemeToggle, Logo, Button,
│                         SectionHeading, FeatureCard, AppScreenshot, FAQ,
│                         DownloadCTA, RecipeCard, PostCard, TopicRail,
│                         TestimonialCard, Icon, JsonLd, PolicyHistory
├── content/
│   └── blog/             one Markdown file per post (empty until the first one)
├── data/                 site, navigation, features, faq, screenshots, testimonials,
│                         recipes.json (generated) + recipes.ts (typed loader),
│                         blog.ts (validated blog loader), products.ts,
│                         schema.ts (site-wide JSON-LD), deletion.ts (request route),
│                         legal-history.ts (per-document version history)
├── layouts/BaseLayout.astro
├── lib/
│   ├── icons.ts          inline stroke icon set (no icon package)
│   ├── post-slug.ts      the one slug function, shared by the loader and the data layer
│   └── recipe-schema.mjs validator shared by the build and the sync script
├── pages/                index, features, products, recipes, blog (+ rss.xml and
│                         tag/[tag]), web-app, android, about, contact, privacy,
│                         terms, delete-account, 404
├── content.config.ts     blog collection: frontmatter schema + slug generation
└── styles/               tokens.css, global.css, components.css, utilities.css
public/                   favicon, icons, manifest, robots.txt, og-image
scripts/
├── extract-assets.mjs    re-derive every image from the supplied brand kit
├── sync-recipes.mjs      fetch the recipe snapshot from the YouTube feed
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

### Videos are linked, not embedded

Every card opens the video on YouTube in a new tab. An embed would mean an iframe, a
third-party script and a `frame-src`/`script-src` exception in the CSP, for content the
site does not control. Linking is the honest, cheap, privacy-preserving option and keeps
the security headers tight.

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
are required; `updatedAt`, `tags`, `cover`, `coverAlt` and `draft` are optional.

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

### Covers

`cover:` names a file in `src/assets/blog/` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`) and
`coverAlt` is required alongside it. A name that does not resolve fails the build and lists
the files that do exist:

```text
[blog] "protein-101" points at cover "protein.jpg", which is not in src/assets/blog/.
       Available: protein-101.jpg
```

Astro resizes and re-encodes the cover at build time; commit the good-quality original. The
listing card renders it with empty alt text because the headline beside it already names the
post, and the meaningful description is used on the post page.

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

### The empty state is deliberate

The blog ships with **no posts**, because none has been written. Rather than padding it with
articles nobody wrote, `/blog` renders an honest "the first post is being written" state
that points at `/recipes`, which does have real content. Two consequences are expected, and
neither is a bug:

- `[WARN] [glob-loader] No files found matching …` appears in every build while the
directory is empty. It disappears with the first post.
- `/blog` stays indexable and stays in the sitemap. Excluding a `noindex` page from the
sitemap is consistent, but a single thin page that is linked from the navigation anyway
would gain nothing from being hidden, and the empty state is real content rather than a
stub.

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
    tag page, `ContactPage` on `/contact`, `ItemList` of `VideoObject` on
    `/recipes`
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
on items that are simply not done yet. It is not part of `npm run verify`, which
stays offline and hermetic on purpose.

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
- **There is no `frame-src` and no YouTube embed.** The recipe videos are linked, not
  embedded, so no third-party iframe or script is ever allowed on the page — see
  **Recipes** above.

### Verified Lighthouse results

A periodic manual measurement, not part of CI — see **Quality gates** above for
what is actually enforced. Run against the built `dist/` **with the real headers
applied**, so these are the numbers the deployed CSP produces, not a relaxed
local server:

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
npm ci → npm run check → npm run check:recipes → npm run build
       → npm run check:placeholders → npm run check:links → npm run check:a11y
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
