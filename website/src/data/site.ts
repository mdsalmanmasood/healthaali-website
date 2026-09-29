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

/** Canonical origin (no trailing slash). */
export const siteUrl = clean(import.meta.env.PUBLIC_SITE_URL, "https://healthaali.in") || "https://healthaali.in";

/** The real web application, if it exists yet. */
export const webAppUrl = clean(import.meta.env.PUBLIC_WEBAPP_URL);

/** Google Play listing, if it exists yet. */
export const androidUrl = clean(import.meta.env.PUBLIC_ANDROID_URL);

/** Support address, if one has been set up. */
export const contactEmail = clean(import.meta.env.PUBLIC_CONTACT_EMAIL);

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

  /** Clearly-marked legal placeholders. Replace with verified details. */
  placeholders: {
    legalEntity: "[legal entity name — to be confirmed]",
    jurisdiction: "[jurisdiction — to be confirmed]",
    address: "[registered address — to be confirmed]",
    effectiveDate: "[effective date — to be confirmed]",
  },
} as const;

/** True when a real destination exists (so the UI can render "Coming soon"). */
export const hasWebApp = webAppUrl.length > 0;
export const hasAndroidApp = androidUrl.length > 0;

/** Absolute URL helper for canonical/OG tags. */
export const absoluteUrl = (path = "/") =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
