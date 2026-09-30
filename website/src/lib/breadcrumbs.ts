/**
 * Breadcrumbs, decided once.
 *
 * A breadcrumb trail is two things at the same time: the row of links a visitor
 * can see and the `BreadcrumbList` a crawler reads. Written separately they
 * drift — a page gets renamed, one of the two is updated, and search results
 * start showing a path the site no longer serves. So there is one array here,
 * and both the component and the JSON-LD are built from it.
 *
 * Every crumb carries its own `href`, including the last one (the page you are
 * on). That is deliberate: the schema wants a URL for every step, and rendering
 * the last step as a self-link is the one thing a breadcrumb must not do. The
 * component decides: the final crumb becomes plain text with
 * `aria-current="page"`; the schema gets the URL.
 *
 * Every href is a site-absolute path (`/blog`, `/recipes`) rather than a full
 * URL, so nothing here has to know the deploy's hostname. `absoluteUrl` adds it
 * at the point of use.
 */
import { absoluteUrl } from "../data/site";

export interface Crumb {
  /** The visible label. Short — it is a trail, not a title. */
  name: string;
  /** Site-absolute path (`/blog`) or absolute URL. */
  href: string;
}

/** The `BreadcrumbList` node for a trail. Positions are 1-based, in order. */
export const breadcrumbSchema = (crumbs: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.href),
  })),
});
