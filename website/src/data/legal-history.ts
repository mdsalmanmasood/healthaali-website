/**
 * Version history for the two legal documents.
 *
 * The date at the top of `/privacy` and `/terms` is read from here rather than
 * typed into `site.legal`, so the header and the history list cannot disagree
 * about which version is in force.
 *
 * Entries are newest first, and that ordering is load-bearing: the first entry
 * is treated as the current version and labelled as such. Getting it wrong would
 * show an old date in the page header and call a superseded version "current",
 * so `assertNewestFirst` fails the build instead.
 *
 * **This history starts at first publication.** No earlier versions are listed,
 * because there were none and inventing a plausible-looking revision log would
 * be fabricating exactly the kind of record this file exists to keep straight.
 * To record a change: add an entry at the top, describe what changed, and leave
 * the previous entry exactly as it is.
 */

export interface PolicyVersion {
  /** Date this version took effect, in `YYYY-MM-DD` form. */
  effectiveDate: string;
  /** One line describing the version as a whole. */
  summary: string;
  /** What this version set out or changed, one statement per entry. */
  details: string[];
}

/**
 * `"2026-09-29"` → `"29 September 2026"`.
 *
 * Pinned to UTC and to a fixed locale on purpose: a date-only string is parsed
 * as UTC midnight, so formatting it in a negative-offset time zone would print
 * the day before. The build runs on whatever machine CI provides, and the date
 * must not depend on where that is.
 */
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatPolicyDate = (isoDate: string) => dateFormatter.format(new Date(isoDate));

/**
 * Guards the two mistakes that would quietly misreport the document: an empty
 * history, and entries that are not in descending date order. Throwing at build
 * time is the point — a wrong "current version" is not something a visitor can
 * detect.
 */
function assertNewestFirst(documentName: string, versions: PolicyVersion[]): PolicyVersion[] {
  if (versions.length === 0) {
    throw new Error(`${documentName}: the version history must contain at least one entry.`);
  }

  versions.forEach((version, index) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version.effectiveDate) || Number.isNaN(Date.parse(version.effectiveDate))) {
      throw new Error(
        `${documentName}: version ${index + 1} has an unusable date "${version.effectiveDate}" — use YYYY-MM-DD.`
      );
    }
    if (index > 0 && versions[index - 1].effectiveDate <= version.effectiveDate) {
      throw new Error(
        `${documentName}: entries must be newest first — "${versions[index - 1].effectiveDate}" must be later than "${version.effectiveDate}".`
      );
    }
  });

  return versions;
}

/** Versions of the privacy policy, newest first. The first is in force. */
export const privacyPolicyHistory = assertNewestFirst("Privacy Policy", [
  {
    effectiveDate: "2026-09-30",
    summary: "Added a note about the videos embedded on the blog.",
    details: [
      "Stated that an embedded video is not requested from Google until the visitor presses play, and that it is served from youtube-nocookie.com.",
      "Stated that Google's own privacy policy applies to the player from that point, including any cookies it sets.",
      "Pointed at the YouTube channel for anyone who would rather not load the player at all.",
    ],
  },
  {
    effectiveDate: "2026-09-29",
    summary: "First version.",
    details: [
      "Set out what the app collects, how it is used, where it is stored, and how long it is kept.",
      "Documented both routes for deleting an account and the data attached to it.",
      "Named the data controller, the contact address and the protections this policy does not promise.",
    ],
  },
]);

/** Versions of the terms of service, newest first. The first is in force. */
export const termsPolicyHistory = assertNewestFirst("Terms of Service", [
  {
    effectiveDate: "2026-09-29",
    summary: "First version — the text currently on this page.",
    details: [
      "Covered the medical disclaimer, accounts, acceptable use, content ownership and liability.",
      "Named the service provider and the law and courts that govern these terms.",
      "Pointed account deletion at the route described in the privacy policy.",
    ],
  },
]);

/** The date shown at the top of a document: its most recent version. */
export const policyEffectiveDate = (versions: PolicyVersion[]) =>
  formatPolicyDate(versions[0].effectiveDate);
