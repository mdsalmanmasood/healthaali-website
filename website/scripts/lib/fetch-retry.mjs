/**
 * Retry with exponential backoff for one networked read.
 *
 * The recipe sync's only networked step is the YouTube feed fetch, and the
 * feed endpoint flaps: on 1 October 2026 the first scheduled run died on a
 * transient HTTP 404, and on 13 October the same endpoint answered 200, 500
 * and 404 to successive identical requests minutes apart. Either failure
 * reds the whole scheduled run, on a morning when there may be nothing wrong
 * with anything this repository controls.
 *
 * The policy here is deliberately narrow. It retries what is plausibly
 * transient — a thrown fetch (timeout, DNS, reset connection) and a short
 * list of statuses — and returns anything else untouched, so a genuinely
 * wrong answer still fails exactly the way it does today. How many attempts
 * and how long the waits are is the caller's decision; the sleeps between
 * attempts double from the base, so `baseDelayMs: 5000` waits 5s, 10s, 20s.
 *
 * Deliberately not included: 404 is NOT in the default set. A missing page
 * is usually a wrong URL, and retrying every wrong URL would turn typos into
 * slow typos. The feed fetch opts back in explicitly (see sync-recipes.mjs),
 * because that endpoint has twice now 404'd a URL that answers 200 a minute
 * later — the call site documents why, so this default never has to.
 */

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Statuses worth trying again: rate limiting, and the server-side failures.
 * Everything else — including a 404 by default — is returned as-is on the
 * first attempt, because the caller's diagnosis of a wrong answer is more
 * useful than three more copies of it.
 */
export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Attempt `fetchOne()` until it answers or the attempts run out.
 *
 * `fetchOne` is a thunk returning a fetch `Response`, so the caller keeps
 * owning the request itself — its URL, headers and timeout — and this module
 * only decides whether a failure deserves another try. Returns the first
 * non-retryable response, or the last response once the attempts are spent.
 * Throws only when every attempt threw without answering at all, and then it
 * throws the last error, so the caller's existing failure message still names
 * the real cause.
 *
 * `onRetry` is called before each wait with `{ attempt, attempts, status,
 * error, delayMs }` — `status` for a retryable answer, `error` for a throw —
 * so the run log shows what flapped rather than silently absorbing it.
 */
export async function fetchWithRetry(fetchOne, options = {}) {
  const {
    attempts = 4,
    baseDelayMs = 5000,
    retryStatuses = RETRYABLE_STATUS,
    sleep = realSleep,
    onRetry = null,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await fetchOne();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const delayMs = baseDelayMs * 2 ** (attempt - 1);
        onRetry?.({ attempt, attempts, status: null, error, delayMs });
        // eslint-disable-next-line no-await-in-loop
        await sleep(delayMs);
      }
      continue;
    }

    if (!retryStatuses.has(response.status) || attempt === attempts) return response;

    // Drain the error page before trying again: an unread body holds its
    // socket, and a retry loop that leaks one connection per attempt is a
    // slower, quieter version of the outage it is riding out.
    try {
      // eslint-disable-next-line no-await-in-loop
      await response.arrayBuffer();
    } catch {
      /* the status is what matters; an unreadable error page is not a second failure */
    }
    const delayMs = baseDelayMs * 2 ** (attempt - 1);
    onRetry?.({ attempt, attempts, status: response.status, error: null, delayMs });
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
  }
  throw lastError;
}
