/**
 * Single source of truth for site-wide facts.
 *
 * Everything here is either (a) taken from the supplied HealThaali brand
 * assets and product design board, or (b) read from a PUBLIC_ environment
 * variable. Nothing is invented — where a fact is missing it stays empty and
 * the UI renders an honest "coming soon"/placeholder state instead of a fake
 * link or claim.
 */

const clean = (value: string | undefined, fallback = "") =>
  (value ?? fallback).trim().replace(/\/+$/, "");

/**
 * A value that has a real default: an unset *or blank* environment variable
 * falls back rather than silently removing the fact.
 *
 * `clean()` strips a trailing slash, which is exactly right for URLs and
 * actively wrong for an email address — a blank PUBLIC_CONTACT_EMAIL used to
 * hide the address from every page. For facts that are known (the support inbox
 * exists) the useful default is the fact itself.
 */
const nonEmpty = (value: string | undefined, fallback: string) => {
  const cleaned = (value ?? "").trim();
  return cleaned.length > 0 ? cleaned : fallback;
};

/**
 * Where the business is based, as structured parts.
 *
 * Held apart from the display string so one fact feeds both the prose on
 * `/privacy` and `/terms` and the `address` on the site-wide `Organization`
 * node. A street address is not stored, because none is published.
 */
export const legalAddress = {
  locality: "Bengaluru",
  region: "Karnataka",
  country: "India",
  /** ISO 3166-1 alpha-2, which is the form schema.org wants for `addressCountry`. */
  countryCode: "IN",
} as const;

/** The same location as it reads in prose: “Bengaluru, Karnataka, India”. */
export const legalLocationLabel = `${legalAddress.locality}, ${legalAddress.region}, ${legalAddress.country}`;

/**
 * The revision this build was produced from, short, or `"unknown"`.
 *
 * Read at build time and stamped into every page as
 * `<meta name="build-commit">`, so a deployed artefact can be traced back to a
 * commit without opening a dashboard. Every documented host names it
 * differently — `CF_PAGES_COMMIT_SHA` on Cloudflare Pages, `GITHUB_SHA` in
 * Actions, `COMMIT_REF` on Netlify, `VERCEL_GIT_COMMIT_SHA` on Vercel — so all
 * four are read, and a build with none of them says `unknown` rather than
 * guessing. Deliberately not a `PUBLIC_` variable: nothing in the browser needs
 * to read it, only the head does.
 */
const buildCommitFromEnvironment = (
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  ""
).trim();

export const buildCommit = buildCommitFromEnvironment
  ? buildCommitFromEnvironment.slice(0, 7)
  : "unknown";

/** Canonical origin (no trailing slash). */
export const siteUrl = clean(import.meta.env.PUBLIC_SITE_URL, "https://healthaali.in") || "https://healthaali.in";

/** The real web application, if it exists yet. */
export const webAppUrl = clean(import.meta.env.PUBLIC_WEBAPP_URL);

/** Google Play listing, if it exists yet. */
export const androidUrl = clean(import.meta.env.PUBLIC_ANDROID_URL);

/**
 * Support address.
 *
 * `info@healthaali.in` is the real, confirmed inbox — it is the published
 * contact point, so it is the default rather than a placeholder. Override it
 * with PUBLIC_CONTACT_EMAIL if a different address should be published; leaving
 * that variable blank keeps this one.
 */
export const contactEmail = nonEmpty(import.meta.env.PUBLIC_CONTACT_EMAIL, "info@healthaali.in");

/** Always true today. Kept so pages that branch on it stay explicit and typed. */
export const hasContactEmail = contactEmail.length > 0;

/** Contact form endpoint (Formspree / Basin / a Worker). Empty = not wired up. */
export const contactEndpoint = clean(import.meta.env.PUBLIC_CONTACT_ENDPOINT);

/** Privacy-friendly analytics token. Empty = ship no analytics at all. */
export const analyticsId = clean(import.meta.env.PUBLIC_ANALYTICS_ID);

export const site = {
  /**
   * Display name used in copy and titles.
   *
   * HealThaali = Heal + Thaali, matching the wordmark in the supplied logo
   * lockup. The domain (healthaali.in) and the social handles (@healthaali)
   * keep their existing spelling.
   */
  name: "HealThaali",

  /** Tagline taken verbatim from the supplied logo lockup. */
  tagline: "Healthy Food. Happier You.",

  /** Secondary line from the supplied banner artwork. */
  positioning: "Personalized food for a healthier you",

  description:
    "HealThaali is a personalized nutrition companion for home-cooked Indian food — plan meals, track protein, carbs, fat and fibre, log what you eat and turn everyday cooking into steady progress.",

  /** Promises printed on the supplied brand banner. */
  promises: ["Zero-oil recipes", "Weight loss", "Healthy lifestyle", "Better you"],

  /**
   * Social accounts confirmed by the supplied asset kit (INSTAGRAM-OPTIMIZATION-KIT.md
   * and the app design board). Add/remove here — the footer follows this list.
   * Facebook is intentionally absent: no verified page URL was supplied.
   */
  socials: [
    { name: "YouTube", href: "https://www.youtube.com/@healthaali", icon: "youtube" as const },
    { name: "Instagram", href: "https://www.instagram.com/healthaali", icon: "instagram" as const },
  ],

  /** Set the launch year in one place. */
  copyrightFrom: 2026,

  /**
   * Legal identity published on `/privacy` and `/terms`.
   *
   * HealThaali is run by an individual, not a registered company, so there is no
   * corporate suffix and no registered office to publish — `location` names the
   * city, not a street address, because none is published anywhere. Every value
   * here was supplied by the operator; none is inferred from the brand assets.
   */
  legal: {
    /** Name that appears as the service provider / data controller. */
    entity: "HealThaali",
    /** How the business is run, in the operator's own words. */
    entityType: "an independent business operated by an individual",
    /**
     * Where it is based. Deliberately no street address — none is published.
     *
     * Derived from `legalAddress` rather than typed again, so the sentence a
     * visitor reads and the `address` on the site-wide `Organization` node can
     * never disagree. Use `legalAddress` for structured data.
     */
    location: legalLocationLabel,
    /** Structured form of `location`, for the Organization node's postal address. */
    address: legalAddress,
    /** Governing law for the terms. */
    law: "India",
    /** Forum with exclusive jurisdiction. */
    forum: "the courts at Bengaluru, Karnataka",
    // No effective date here on purpose: the date shown at the top of a legal
    // document is its most recent version, so it lives with the version history
    // in `legal-history.ts`. Two copies would eventually disagree.
  },

  /**
   * The published contact inbox, usable before any form endpoint exists.
   * Declared here as well as exported above so `site` stays a single readable
   * description of the organisation.
   */
  contactEmail,
} as const;

/**
 * Google Search Console verification token, or empty.
 *
 * The site is on Cloudflare Pages and its build has no secret of its own, so
 * the token is read from a PUBLIC_ variable set in the dashboard (Pages →
 * Settings → Variables and secrets → Production) and emitted as
 * `<meta name="google-site-verification">` on every page. Unset, no tag is
 * emitted at all rather than an empty one.
 *
 * Search Console also offers a DNS TXT record, which needs no deploy — on this
 * domain, with the zone already in Cloudflare, that is the faster route and the
 * tag is the one that survives a lost dashboard.
 */
const googleSiteVerification = (process.env.PUBLIC_GOOGLE_SITE_VERIFICATION || "").trim();
export const hasSiteVerification = googleSiteVerification.length > 0;
export { googleSiteVerification };

/** True when a real destination exists (so the UI can render "Coming soon"). */
export const hasWebApp = webAppUrl.length > 0;
export const hasAndroidApp = androidUrl.length > 0;

/** Absolute URL helper for canonical/OG tags. */
export const absoluteUrl = (path = "/") =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
