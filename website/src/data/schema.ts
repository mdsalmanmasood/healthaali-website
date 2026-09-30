/**
 * Site-wide structured data: exactly one `Organization` node and one `WebSite`
 * node for the whole site.
 *
 * Emitted from `BaseLayout`, so every page carries the same block and the brand
 * is described once rather than re-declared per page. Other nodes reference
 * these by `@id` — the contact page points at this organisation instead of
 * declaring a second, competing one.
 *
 * Only confirmed facts are here: the real 512×512 app icon as the logo, the
 * support inbox that is actually published, the two social profiles from the
 * supplied asset kit, and the legal identity the policies name. There is no
 * site search, so `WebSite` carries no `potentialAction`/`SearchAction`:
 * advertising a search URL the site does not serve would be an invented
 * destination.
 *
 * The legal values come from `site.legal` in `./site`, the same object the
 * `/privacy` and `/terms` pages render, so the brand node a crawler reads and
 * the policies a visitor reads cannot drift apart. Deliberately absent, because
 * no such fact exists: a street address, a company registration number, a
 * `vatID`/`taxID`, a `founder` or a `foundingDate`.
 */
import { absoluteUrl, contactEmail, site, siteUrl } from "./site";

/** Stable identifiers, so other JSON-LD nodes can reference these by `@id`. */
export const organizationId = `${siteUrl}/#organization`;
export const websiteId = `${siteUrl}/#website`;

const organization = {
  "@type": "Organization",
  "@id": organizationId,
  name: site.name,
  // The name the policies publish as the service provider / data controller.
  // Equal to `name` today — the brand is not a registered company — but kept
  // separate so a future registered entity does not silently rename the brand.
  legalName: site.legal.entity,
  url: absoluteUrl("/"),
  description: site.description,
  logo: {
    "@type": "ImageObject",
    url: absoluteUrl("/icon-512.png"),
    width: 512,
    height: 512,
    contentType: "image/png",
  },
  // Locality, region and country only — exactly what the policies disclose.
  // A `streetAddress` is never emitted, because none has been supplied.
  address: {
    "@type": "PostalAddress",
    addressLocality: site.legal.address.locality,
    addressRegion: site.legal.address.region,
    addressCountry: site.legal.address.countryCode,
  },
  email: contactEmail,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: contactEmail,
  },
  // Verified profiles only (currently YouTube + Instagram). Facebook is absent
  // on purpose — no page URL was supplied, and a guessed profile would point
  // crawlers at an account that may not be the brand's.
  sameAs: site.socials.map((social) => social.href),
};

const website = {
  "@type": "WebSite",
  "@id": websiteId,
  name: site.name,
  url: absoluteUrl("/"),
  inLanguage: "en",
  // Links the site to the brand node above, so the two are read as one entity.
  publisher: { "@id": organizationId },
};

/**
 * One `@graph` in one `<script>`, which is how every page ends up with a single
 * copy of each node instead of a pile of near-duplicates.
 */
export const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [organization, website],
};
