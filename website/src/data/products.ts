/**
 * What HealThaali offers, as data.
 *
 * Everything here is either read from a real environment variable or reused
 * from copy that is already published elsewhere on this site (`pillars` from
 * features.ts, the recipe snapshot from recipes.json). Nothing is written by
 * hand describing a capability that has not been confirmed, and there is no
 * price field at all: no price, plan or purchase option has been supplied, so
 * none is claimed.
 *
 * The point of keeping this in one module rather than inline in the page is
 * that the availability states stay in step with the rest of the site — the
 * moment PUBLIC_ANDROID_URL is set, /products, /android and the header CTA all
 * change together.
 */
import { pillars } from "./features";
import { hasRecipes, recipes } from "./recipes";
import { androidUrl, hasAndroidApp, hasWebApp, webAppUrl } from "./site";

export type OfferingStatus = "available" | "in-progress";

export interface PlatformRow {
  id: string;
  name: string;
  status: OfferingStatus;
  statusLabel: string;
  /** Internal page that explains it. Always exists. */
  href: string;
  /** A real destination, only when one has been configured. */
  externalUrl?: string;
  externalLabel?: string;
}

export interface Offering {
  id: string;
  name: string;
  tagline: string;
  status: OfferingStatus;
  statusLabel: string;
  /** Internal page to read next. */
  href: string;
  /** Short, verifiable points. Reused copy where possible to prevent drift. */
  includes: string[];
}

/** The two places the app runs. Availability comes from the env, not from copy. */
export const platforms: PlatformRow[] = [
  {
    id: "android",
    name: "Android",
    status: hasAndroidApp ? "available" : "in-progress",
    statusLabel: hasAndroidApp ? "Available on Google Play" : "Not listed on Google Play yet",
    href: "/android",
    externalUrl: hasAndroidApp ? androidUrl : undefined,
    externalLabel: "Open the Google Play listing",
  },
  {
    id: "web",
    name: "Browser",
    status: hasWebApp ? "available" : "in-progress",
    statusLabel: hasWebApp ? "Live at its own address" : "In development",
    href: "/web-app",
    externalUrl: hasWebApp ? webAppUrl : undefined,
    externalLabel: "Open the web app",
  },
];

const appIsReachable = hasAndroidApp || hasWebApp;

export const offerings: Offering[] = [
  {
    id: "app",
    name: "The HealThaali app",
    tagline:
      "One app, two ways to open it. Plan the week, log what you actually ate, and watch protein, carbs, fat and fibre add up without a spreadsheet.",
    status: appIsReachable ? "available" : "in-progress",
    statusLabel: appIsReachable ? "Available" : "In development",
    href: "/features",
    /*
      The feature names come straight from the same `pillars` array the
      homepage and /features render, so a rename there cannot leave this page
      advertising something that no longer exists.
    */
    includes: pillars.map((pillar) => pillar.title),
  },
  {
    id: "recipes",
    name: "Recipes and cooking videos",
    tagline:
      "The dishes we cook on camera, listed newest first. Every listing links to the video itself — nothing is re-hosted and nothing sits behind a sign-up.",
    status: hasRecipes ? "available" : "in-progress",
    statusLabel: hasRecipes ? "Free to watch" : "Being filmed",
    href: "/recipes",
    includes: [
      hasRecipes
        ? `${recipes.length} ${recipes.length === 1 ? "dish" : "dishes"} listed, newest first`
        : "The list appears here as soon as the first video is published",
      "Every title links straight to the video on YouTube",
      "Titles and dates come from the channel's own feed, so they match YouTube",
    ],
  },
];
