/**
 * Regression tests for the feed fetch's retry contract.
 *
 * The contract is the line between "transient, try again" and "wrong, say
 * so": a thrown fetch and a short list of statuses earn another attempt with
 * a doubling wait, while anything else is returned on the first try — and
 * when the attempts run out, the caller gets the last answer (or the last
 * error), never a swallowed one.
 *
 * Every case here runs against a stub fetch and a recording sleep, because a
 * test that waits out a real backoff or reaches the real network is a test
 * that fails on somebody else's bad morning — which is exactly the failure
 * this module exists to absorb.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RETRYABLE_STATUS, fetchWithRetry } from "./fetch-retry.mjs";

/** A stub fetch Response: only what the module reads — status, arrayBuffer. */
const answer = (status) => ({
  status,
  ok: status >= 200 && status < 300,
  arrayBuffer: async () => new ArrayBuffer(0),
});

/** A harness: queued answers or throws, with sleeps and retries recorded. */
function harness(queue) {
  const calls = [];
  const sleeps = [];
  const retries = [];
  const fetchOne = async () => {
    calls.push(calls.length + 1);
    const next = queue[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  };
  const run = (options = {}) =>
    fetchWithRetry(fetchOne, {
      baseDelayMs: 1000,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      onRetry: (info) => {
        retries.push(info);
      },
      ...options,
    });
  return { calls, sleeps, retries, run };
}

describe("fetchWithRetry", () => {
  it("returns a good answer on the first attempt, with no wait and no report", async () => {
    const h = harness([answer(200)]);
    const response = await h.run();
    assert.equal(response.status, 200);
    assert.deepEqual(h.sleeps, []);
    assert.deepEqual(h.retries, []);
  });

  it("retries a retryable status, then returns the recovery", async () => {
    const h = harness([answer(500), answer(200)]);
    const response = await h.run();
    assert.equal(response.status, 200);
    assert.deepEqual(h.sleeps, [1000]);
    assert.equal(h.retries.length, 1);
    assert.equal(h.retries[0].status, 500);
    assert.equal(h.retries[0].error, null);
  });

  it("doubles the wait between attempts", async () => {
    const h = harness([answer(503), answer(502), answer(500), answer(200)]);
    const response = await h.run();
    assert.equal(response.status, 200);
    assert.deepEqual(h.sleeps, [1000, 2000, 4000]);
  });

  it("returns the last retryable answer once the attempts are spent", async () => {
    const h = harness([answer(500), answer(500), answer(500), answer(500)]);
    const response = await h.run({ attempts: 4 });
    assert.equal(response.status, 500);
    assert.deepEqual(h.sleeps, [1000, 2000, 4000]);
  });

  it("returns a non-retryable status at once, however wrong it is", async () => {
    for (const status of [400, 403, 404]) {
      const h = harness([answer(status), answer(200)]);
      const response = await h.run();
      assert.equal(response.status, status, `HTTP ${status} must not be retried by default`);
      assert.deepEqual(h.sleeps, [], `HTTP ${status} must not wait`);
    }
  });

  it("retries a status the caller opts into, like the feed's flapping 404", async () => {
    const h = harness([answer(404), answer(200)]);
    const response = await h.run({ retryStatuses: new Set([...RETRYABLE_STATUS, 404]) });
    assert.equal(response.status, 200);
    assert.deepEqual(h.sleeps, [1000]);
  });

  it("retries a thrown fetch — timeout, DNS, reset connection — then recovers", async () => {
    const h = harness([new Error("fetch failed"), answer(200)]);
    const response = await h.run();
    assert.equal(response.status, 200);
    assert.equal(h.retries.length, 1);
    assert.equal(h.retries[0].status, null);
    assert.match(h.retries[0].error.message, /fetch failed/);
  });

  it("throws the last error when every attempt throws, so the cause survives", async () => {
    const h = harness([new Error("first"), new Error("second")]);
    await assert.rejects(h.run({ attempts: 2 }), /second/);
    assert.deepEqual(h.sleeps, [1000]);
  });

  it("reports each retry with the attempt count and the wait, for the run log", async () => {
    const h = harness([answer(429), answer(200)]);
    await h.run({ attempts: 3 });
    assert.deepEqual(h.retries, [
      { attempt: 1, attempts: 3, status: 429, error: null, delayMs: 1000 },
    ]);
  });
});
