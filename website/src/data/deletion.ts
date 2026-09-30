/**
 * The account-deletion request route, in one place.
 *
 * `/privacy`, `/terms` and the request page itself all link to `deletionPath`,
 * and the message a requester sends is built here too, so the instructions a
 * visitor copies and the link they click can never disagree.
 *
 * Only confirmed facts are encoded: the in-app route the privacy policy already
 * documents (Settings → Data & Privacy) and the published support inbox.
 * Deliberately absent:
 *
 *   - **No web form.** This site is static and has no submission backend
 *     (`PUBLIC_CONTACT_ENDPOINT` is unset), and a form that silently drops a
 *     deletion request would be far worse than an email link that works. If the
 *     endpoint is ever configured, the contact page's pattern is the one to
 *     copy here.
 *   - **No turnaround promise.** No response time has been supplied, so none is
 *     claimed; inventing "within 30 days" would be a commitment nobody made.
 *   - **No app deep link.** No custom URL scheme or store URL exists yet, so the
 *     in-app route is described in words rather than linked.
 */
import { contactEmail, site } from "./site";

/** The page a deletion request is made from. */
export const deletionPath = "/delete-account";

/** Subject line that keeps deletion requests easy to spot in a shared inbox. */
export const deletionEmailSubject = `${site.name} account deletion request`;

/**
 * The body a requester sends. Plain text on purpose, so it survives any mail
 * client, and it asks for no health information.
 */
export const deletionEmailTemplate = [
  `Hello ${site.name} team,`,
  ``,
  `I would like to delete my ${site.name} account and the personal data attached to it.`,
  ``,
  `Account email:`,
  ``,
  `Anything else that helps identify the account (optional):`,
  ``,
  `Please confirm by reply when the deletion is done.`,
  ``,
  `Thank you,`,
].join("\n");

/**
 * The same message as a ready-to-send link. Both parts are percent-encoded, so
 * the newlines and the spaces survive being put in an `href`.
 */
export const deletionMailto =
  `mailto:${contactEmail}` +
  `?subject=${encodeURIComponent(deletionEmailSubject)}` +
  `&body=${encodeURIComponent(deletionEmailTemplate)}`;
