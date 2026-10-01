/**
 * Regression tests for the deep mode of `check-launch.mjs`.
 *
 * The deep mode is the half of that script which only runs when
 * `CLOUDFLARE_API_TOKEN` is set — so in CI, where no token is configured, it
 * never executes at all. It was written against a local stub by hand and then
 * committed unexercised. This file is that exercise, kept.
 *
 * Why a stub server is the right harness
 * --------------------------------------
 * The hook already exists and exists for exactly this: `CLOUDFLARE_API`
 * replaces `https://api.cloudflare.com/client/v4`. Every case below runs the
 * real script, as a child process, against a throwaway server on an ephemeral
 * port that answers both the fake Cloudflare API and a fake site. Nothing is
 * mocked inside the script, and no token or account is involved.
 *
 * Every case starts from a healthy install and breaks exactly one thing, so a
 * failure names its own cause. Where one change genuinely trips two rules — a
 * parked A record at the apex is both a parking entry and a hand-made record —
 * the case says so and asserts both, rather than hiding half of the behaviour.
 *
 * What is deliberately not asserted
 * ---------------------------------
 * `--site` points at loopback, so three of the script's checks cannot pass and
 * are not supposed to: Delegation and Registrar Status ask a public resolver
 * (and RDAP) about a hostname with no delegation, and Certificate wants port
 * 443. They read as problems in every case below, which is why this file
 * asserts on the *labelled* deep-mode results rather than on the exit code —
 * that is what keeps it a test of the deep mode instead of a test of the
 * internet. `deepProblems()` below is the whole assertion surface that matters.
 *
 * Three real lookups do still happen, because they are the script's own
 * behaviour and no option turns them off: `checkPagesProject` probes
 * `<project>.pages.dev` over HTTPS before the API is ever consulted, and the
 * Registrar check asks two RDAP endpoints about a hostname with no TLD. All
 * three fail immediately — the project name cannot exist and "127.0.0.1" is not
 * a domain — so they cost a few hundred milliseconds and decide nothing.
 * Everything the assertions below are about is answered locally.
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const SCRIPT = path.join(HERE, "check-launch.mjs");

/** The three states the script records, as it prints them. */
const OK = "✓";
const OUTSTANDING = "○";
const PROBLEM = "✗";

/**
 * Every label the deep mode can record. Anything outside this list came from
 * the public checks, which cannot be made to pass from loopback.
 */
const DEEP_LABELS = [
  "Cloudflare API",
  "Cloudflare zone",
  "Zone nameservers",
  "Zone records",
  "Zone record (apex)",
  "Zone record (www)",
  "Pages project (API)",
  "Pages build settings",
  "Pages source",
  "Pages environment variables",
  "Pages custom domains",
  "Pages deployments",
  "Pages hostname",
];

const SITE_HOST = "127.0.0.1";
const PROJECT = "healthaali-stub-that-cannot-exist";
const PAGES_HOST = `${PROJECT}.pages.dev`;
const ZONE_ID = "0".repeat(32);
const ACCOUNT_ID = "1".repeat(32);

/** The commit the fake site claims to have been built from. */
const HEAD_SHORT = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
}).trim();

/**
 * A line that can only appear in the output by having been read from the build
 * log endpoint and printed, so the assertion cannot pass by accident.
 */
const BUILD_FAILURE_MARKER = "STUB_BUILD_FAILURE_MARKER";

/* ── reading the script's own report ──────────────────────────────────────── */

/**
 * The report is shaped for a person, but its indentation is regular: two spaces
 * before a verdict, six before the sentence under it, eight before each line of
 * a build-log tail. Parsing it back is what lets each assertion below name the
 * label it is about instead of matching the whole output as one string.
 */
function parseReport(stdout) {
  const records = new Map();
  let current = null;

  for (const line of stdout.split("\n")) {
    const verdict = line.match(/^ {2}([✓○✗]) (.+)$/);

    if (verdict) {
      current = { state: verdict[1], label: verdict[2], detail: "", tail: [] };
      records.set(verdict[2], current);
      continue;
    }

    if (!current) continue;

    // Eight spaces first: a six-space pattern would not match an eight-space
    // line, but relying on that is how this silently breaks later.
    const tail = line.match(/^ {8}(\S.*)$/);
    if (tail) {
      current.tail.push(tail[1]);
      continue;
    }

    const detail = line.match(/^ {6}(\S.*)$/);
    if (detail) current.detail += (current.detail ? "\n" : "") + detail[1];
  }

  return records;
}

/** The deep-mode labels that came back as problems, in report order. */
const deepProblems = (records) =>
  [...records.values()]
    .filter((record) => record.state === PROBLEM && DEEP_LABELS.includes(record.label))
    .map((record) => record.label);

const verdictOf = (records, label) => {
  const record = records.get(label);
  assert.ok(record, `the report has no "${label}" verdict at all`);
  return record;
};

/* ── the stub ─────────────────────────────────────────────────────────────── */

const ZONE = {
  id: ZONE_ID,
  name: "healthaali.in",
  status: "active",
  plan: { name: "Free Website" },
  // Loopback publishes no delegation, so the script's cross-check between the
  // zone and DNS has nothing to compare. An empty list reads as outstanding;
  // a populated one would read as a problem and be this file's fault, not the
  // script's.
  name_servers: [],
  account: { id: ACCOUNT_ID },
};

const RECORDS = [
  { name: SITE_HOST, type: "CNAME", content: PAGES_HOST, proxied: true },
  { name: `www.${SITE_HOST}`, type: "CNAME", content: PAGES_HOST, proxied: true },
];

/**
 * One of the addresses a registrar's parking page resolves to. The script has
 * its own copy; it cannot be imported from there without running the whole
 * check, so the value is repeated here on purpose.
 */
const PARKED_ADDRESS = "3.33.130.190";

const PROJECT_FIXTURE = {
  name: PROJECT,
  subdomain: PAGES_HOST,
  build_config: {
    root_dir: "website",
    build_command: "npm run build",
    destination_dir: "dist",
  },
  source: {
    type: "github",
    config: {
      owner: "mdsalmanmasood",
      repo_name: "healthaali-website",
      production_branch: "main",
    },
  },
  deployment_configs: { production: { env_vars: {} } },
};

const ACTIVE_DOMAINS = [
  { name: SITE_HOST, status: "active" },
  { name: `www.${SITE_HOST}`, status: "active" },
];

/**
 * A production deployment that succeeded.
 *
 * The aliases deliberately carry the per-deployment hostname and the custom
 * domains, but not the bare `<project>.pages.dev` string. That string is the
 * trigger for the separate "Pages hostname" check, which is about DNS
 * provisioning and cannot be exercised or satisfied from loopback.
 */
const SUCCESSFUL_DEPLOYMENT = {
  id: "dep-0001",
  environment: "production",
  created_on: new Date(Date.now() - 3 * 60_000).toISOString(),
  is_skipped: false,
  aliases: [`https://dep0001.${PAGES_HOST}`, "https://healthaali.in"],
  latest_stage: { name: "deploy", status: "success" },
  deployment_trigger: { metadata: { commit_hash: HEAD_SHORT } },
};

const BUILD_LOG = [
  "2026-10-01T01:00:00Z  Cloning repository...",
  "2026-10-01T01:00:12Z  Detected the following tools from environment: nodejs@22.22.0",
  "2026-10-01T01:00:20Z  Executing user command: npm run build",
  `2026-10-01T01:00:44Z  error: ${BUILD_FAILURE_MARKER} — Cannot find module 'astro'`,
];

const okay = (result) => ({ status: 200, body: { success: true, result } });

const refused = (status, code, message) => ({
  status,
  body: { success: false, errors: [{ code, message }] },
});

/**
 * A healthy install, with any single endpoint replaceable. Each test below
 * supplies exactly one override.
 */
function routesFor(overrides = {}) {
  const zones = "zones" in overrides ? overrides.zones : [ZONE];
  const project = "project" in overrides ? overrides.project : PROJECT_FIXTURE;
  const records = overrides.records ?? RECORDS;
  const domains = overrides.domains ?? ACTIVE_DOMAINS;
  const deployments = overrides.deployments ?? [SUCCESSFUL_DEPLOYMENT];
  const logs = overrides.logs ?? [];
  const otherProjects = overrides.otherProjects ?? [];

  const pages = `/accounts/${ACCOUNT_ID}/pages/projects`;

  return (route) => {
    // `zones: null` stands in for a token that cannot see the zone at all.
    if (route === "/zones") {
      return zones ? okay(zones) : refused(403, 9109, "Unauthorized to access requested resource");
    }
    if (route === `/zones/${ZONE_ID}/dns_records`) return okay(records);
    if (route === pages) return okay(otherProjects);

    if (route === `${pages}/${PROJECT}`) {
      return project
        ? okay(project)
        : refused(404, 8000007, "Project not found.");
    }

    if (route.startsWith(`${pages}/${PROJECT}/deployments/`) && route.endsWith("/history/logs")) {
      return okay(logs);
    }

    if (route === `${pages}/${PROJECT}/deployments`) return okay(deployments);
    if (route === `${pages}/${PROJECT}/domains`) return okay(domains);

    return refused(404, 7003, `the stub has no route for ${route}`);
  };
}

/**
 * The site itself, so the checks that read it pass and stay out of the way.
 * `--site` cannot be a hostname with real DNS here, and a page the script does
 * not recognise would add three more problems to every case.
 */
const page = (origin) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HealThaali — stub</title>
<meta name="build-commit" content="${HEAD_SHORT}">
<link rel="canonical" href="${origin}">
</head>
<body><h1>HealThaali</h1></body>
</html>`;

/**
 * Run the script and collect everything it says.
 *
 * Deliberately `spawn` and not `spawnSync`: the stub is a server inside *this*
 * process, so a synchronous wait would block the event loop that has to answer
 * the child, and every request would sit there until the script's own 15-second
 * timeout fired. The test would still fail, just for a reason that has nothing
 * to do with the code under test.
 */
function runScript(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

/**
 * Run the real script against a stub, and return its parsed report.
 *
 * The site and the API share one server, because the script is pointed at the
 * same origin for both and a second port would only be one more thing to leak.
 */
async function runCheck(overrides = {}) {
  const routes = routesFor(overrides);

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const origin = `http://127.0.0.1:${server.address().port}`;

    if (!url.pathname.startsWith("/client/v4")) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        // Read by the "Security headers" check; without it that check reports a
        // problem in every case, for a reason that has nothing to do with the
        // API.
        "content-security-policy": "default-src 'self'",
      });
      response.end(page(origin));
      return;
    }

    const route = url.pathname.slice("/client/v4".length);
    const { status, body } = routes(route);

    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  try {
    const result = await runScript(
      [SCRIPT, "--site", origin, "--pages-project", PROJECT],
      {
        ...process.env,
        CLOUDFLARE_API_TOKEN:
          "token" in overrides ? overrides.token : "stub-token-never-sent-anywhere-real",
        CLOUDFLARE_API: `${origin}/client/v4`,
      }
    );

    // A signal, or a run that produced no report at all, means the harness
    // broke rather than the script, and every assertion below would fail
    // confusingly. Say so here instead.
    assert.notEqual(result.signal, "SIGTERM", `the script was killed after ${result.status}`);
    assert.match(
      result.stdout,
      /HealThaali launch state — /,
      `the script produced no report.\n--- stderr ---\n${result.stderr}`
    );

    return { records: parseReport(result.stdout), stdout: result.stdout, stderr: result.stderr };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/* ── the cases ────────────────────────────────────────────────────────────── */

describe("check-launch deep mode", () => {
  it("reports a healthy project as satisfied, and nothing as a problem", async () => {
    const { records } = await runCheck();

    assert.equal(verdictOf(records, "Cloudflare zone").state, OK);
    assert.equal(verdictOf(records, "Zone records").state, OK);
    assert.equal(verdictOf(records, "Zone record (apex)").state, OK);
    assert.equal(verdictOf(records, "Zone record (www)").state, OK);

    // The four settings that have no public footprint — the reason the deep
    // mode exists at all.
    assert.equal(verdictOf(records, "Pages build settings").state, OK);
    assert.equal(verdictOf(records, "Pages source").state, OK);
    assert.equal(verdictOf(records, "Pages environment variables").state, OK);
    assert.equal(verdictOf(records, "Pages custom domains").state, OK);

    // The source verdict names the branch and, when it can tell, says that the
    // branch is the repository's default one — which is the condition the
    // mismatch case below negates.
    assert.match(verdictOf(records, "Pages source").detail, /the repository's default branch/);

    // An install with no variables is healthy, and says so in plain words
    // rather than pretending the list is unreadable.
    assert.equal(
      verdictOf(records, "Pages environment variables").detail,
      'none set — the honest "coming soon" build'
    );

    assert.equal(verdictOf(records, "Pages deployments").state, OK);
    assert.match(verdictOf(records, "Pages deployments").detail, /succeeded, serving/);

    assert.deepEqual(deepProblems(records), []);
  });

  it("calls a project that was never created outstanding, not broken", async () => {
    // The distinction is the whole point: work not yet done must not fail the
    // check, or the check becomes noise before launch and is ignored.
    const { records } = await runCheck({ project: null, otherProjects: [] });

    const project = verdictOf(records, "Pages project (API)");
    assert.equal(project.state, OUTSTANDING);
    assert.match(project.detail, new RegExp(`no Pages project named ${PROJECT}`));
    assert.match(project.detail, /this account has none at all/);
    assert.match(project.detail, /LAUNCH\.md §3/);

    assert.deepEqual(deepProblems(records), []);
  });

  it("calls a project that exists under another name a problem, and names it", async () => {
    const { records } = await runCheck({
      project: null,
      otherProjects: [{ name: "healthaali-website", subdomain: "healthaali-website.pages.dev" }],
    });

    const project = verdictOf(records, "Pages project (API)");
    assert.equal(project.state, PROBLEM);
    assert.match(project.detail, /this account has healthaali-website/);

    assert.deepEqual(deepProblems(records), ["Pages project (API)"]);
  });

  it("calls a failed build a problem, and prints the tail of its log", async () => {
    const { records } = await runCheck({
      deployments: [
        {
          ...SUCCESSFUL_DEPLOYMENT,
          latest_stage: { name: "build", status: "failure" },
        },
      ],
      logs: BUILD_LOG,
    });

    const deployments = verdictOf(records, "Pages deployments");
    assert.equal(deployments.state, PROBLEM);

    // The stage is named, and translated into what it means in practice.
    assert.match(deployments.detail, /failed at the "build" stage/);
    assert.match(deployments.detail, /the build command itself failed/);
    assert.match(deployments.detail, /dash\.cloudflare\.com\/\S+\/pages\/view\//);

    // The log is the part that makes a failed build fixable, and the marker
    // can only be here if the log endpoint was read and printed.
    assert.match(deployments.tail.join("\n"), new RegExp(BUILD_FAILURE_MARKER));

    assert.deepEqual(deepProblems(records), ["Pages deployments"]);
  });

  it("calls a custom domain Cloudflare marked error a problem, with its reason", async () => {
    const { records } = await runCheck({
      domains: [
        { name: SITE_HOST, status: "active" },
        {
          name: `www.${SITE_HOST}`,
          status: "error",
          validation_data: { error_message: "CNAME target does not match" },
        },
      ],
    });

    const domains = verdictOf(records, "Pages custom domains");
    assert.equal(domains.state, PROBLEM);
    assert.match(domains.detail, new RegExp(`www\\.${SITE_HOST} is error`));
    assert.match(domains.detail, /CNAME target does not match/);

    assert.deepEqual(deepProblems(records), ["Pages custom domains"]);
  });

  it("calls a build still in flight outstanding, not broken", async () => {
    const { records } = await runCheck({
      deployments: [
        {
          ...SUCCESSFUL_DEPLOYMENT,
          latest_stage: { name: "build", status: "active" },
        },
      ],
    });

    const deployments = verdictOf(records, "Pages deployments");
    assert.equal(deployments.state, OUTSTANDING);
    assert.match(deployments.detail, /a build in flight, not a failure/);

    assert.deepEqual(deepProblems(records), []);
  });

  it("calls a project whose build settings have drifted a problem, naming each one", async () => {
    const { records } = await runCheck({
      project: {
        ...PROJECT_FIXTURE,
        build_config: { root_dir: "", build_command: "npm run build", destination_dir: "build" },
      },
    });

    const settings = verdictOf(records, "Pages build settings");
    assert.equal(settings.state, PROBLEM);

    // Two fields drifted and both are named, in one sentence.
    assert.match(settings.detail, /root_dir is "\(empty\)", should be "website"/);
    assert.match(settings.detail, /destination_dir is "build", should be "dist"/);

    assert.deepEqual(deepProblems(records), ["Pages build settings"]);
  });

  it("fails loudly when the token cannot read the zone", async () => {
    // An expired or under-scoped token has to read as a problem rather than as
    // a healthy deployment — a dead token that passes quietly is worse than no
    // check at all. This is the path a real bad token takes.
    const { records } = await runCheck({ zones: null });

    const api = verdictOf(records, "Cloudflare API");
    assert.equal(api.state, PROBLEM);

    // The API's own words, so the fix (a missing scope) is visible in the
    // failure rather than guessed at.
    assert.match(api.detail, /9109 Unauthorized to access requested resource/);
    assert.match(api.detail, /Zone:Read/);

    assert.deepEqual(deepProblems(records), ["Cloudflare API"]);
  });

  it("does not claim a verdict for the API at all when no token is set", async () => {
    // The other half of the same contract: absent token, absent scope, no
    // complaint — reported as outstanding so the launch can still pass.
    const { records } = await runCheck({ token: "" });

    const api = verdictOf(records, "Cloudflare API");
    assert.equal(api.state, OUTSTANDING);
    assert.match(api.detail, /skipped/);

    assert.deepEqual(deepProblems(records), []);
  });

  it("calls a leftover parking address a problem, and says what it blocks", async () => {
    // The single most likely way a launch stalls: the registrar's parking
    // records stay behind and keep Pages from claiming the names. The deployed
    // zone has neither, so this branch had never been read by anything.
    //
    // The parked A sits at the apex because that is where registrars put it,
    // and that is why *two* rules fire: a parking entry is also a hand-made
    // record on a name Pages has to own. Both are asserted, and the second is
    // the honest consequence of the same one change rather than a hidden extra.
    const { records } = await runCheck({
      records: [
        { name: SITE_HOST, type: "A", content: PARKED_ADDRESS, proxied: false },
        { name: `www.${SITE_HOST}`, type: "CNAME", content: PAGES_HOST, proxied: true },
      ],
    });

    const all = verdictOf(records, "Zone records");
    assert.equal(all.state, PROBLEM);
    assert.match(all.detail, /parking entries are present \(A 3\.33\.130\.190\)/);
    assert.match(all.detail, /they block the Pages custom domain/);

    assert.equal(verdictOf(records, "Zone record (apex)").state, PROBLEM);
    assert.match(
      verdictOf(records, "Zone record (apex)").detail,
      /a hand-made A 3\.33\.130\.190 exists; Pages has to own this name/
    );

    // The www record is fine, so it stays out of the list.
    assert.equal(verdictOf(records, "Zone record (www)").state, OK);

    assert.deepEqual(deepProblems(records), ["Zone records", "Zone record (apex)"]);
  });

  it("calls a hand-made A record a problem, because Pages has to own the name", async () => {
    // 203.0.113.0/24 is reserved for documentation, so this address cannot be
    // mistaken for either the parking address or a live host.
    const { records } = await runCheck({
      records: [
        { name: SITE_HOST, type: "A", content: "203.0.113.10", proxied: false },
        { name: `www.${SITE_HOST}`, type: "CNAME", content: PAGES_HOST, proxied: true },
      ],
    });

    const apex = verdictOf(records, "Zone record (apex)");
    assert.equal(apex.state, PROBLEM);
    assert.match(apex.detail, /a hand-made A 203\.0\.113\.10 exists/);
    assert.match(apex.detail, /Pages has to own this name/);

    // Not a parking address, so the zone-wide rule stays quiet: the two
    // verdicts are about different things and do not echo each other.
    assert.equal(verdictOf(records, "Zone records").state, OK);

    assert.deepEqual(deepProblems(records), ["Zone record (apex)"]);
  });

  it("calls a record pointing somewhere else a problem, naming both ends", async () => {
    // Fully proxied, correct type, and still wrong: ownership means the target
    // is Pages, not merely that a record exists.
    const { records } = await runCheck({
      records: [
        {
          name: SITE_HOST,
          type: "CNAME",
          content: "cname.somewhere-else.example",
          proxied: true,
        },
        { name: `www.${SITE_HOST}`, type: "CNAME", content: PAGES_HOST, proxied: true },
      ],
    });

    const apex = verdictOf(records, "Zone record (apex)");
    assert.equal(apex.state, PROBLEM);
    assert.match(apex.detail, /CNAME cname\.somewhere-else\.example/);
    assert.match(apex.detail, new RegExp(`does not point at ${PAGES_HOST}`));

    assert.deepEqual(deepProblems(records), ["Zone record (apex)"]);
  });

  it("calls a record with the orange cloud switched off a problem", async () => {
    // A correct target is not enough on its own: Pages is only reachable
    // through Cloudflare's edge, so an unproxied record is a dark name.
    const { records } = await runCheck({
      records: [
        { name: SITE_HOST, type: "CNAME", content: PAGES_HOST, proxied: true },
        { name: `www.${SITE_HOST}`, type: "CNAME", content: PAGES_HOST, proxied: false },
      ],
    });

    const www = verdictOf(records, "Zone record (www)");
    assert.equal(www.state, PROBLEM);
    assert.match(www.detail, /proxying is off/);
    assert.match(www.detail, /Pages is only served through Cloudflare's edge/);

    assert.equal(verdictOf(records, "Zone record (apex)").state, OK);

    assert.deepEqual(deepProblems(records), ["Zone record (www)"]);
  });

  it("calls the names with no records yet outstanding, not broken", async () => {
    // Before the custom domains are attached the zone has no record for either
    // name, and the zone-wide count is zero. Neither is a failure — the Pages
    // custom domain is what creates them.
    const { records } = await runCheck({ records: [] });

    for (const label of ["Zone record (apex)", "Zone record (www)"]) {
      const record = verdictOf(records, label);
      assert.equal(record.state, OUTSTANDING);
      assert.match(record.detail, /none yet — the Pages custom domain creates it/);
    }

    assert.equal(verdictOf(records, "Zone records").state, OK);
    assert.match(verdictOf(records, "Zone records").detail, /0 in total, no parking entries/);

    assert.deepEqual(deepProblems(records), []);
  });

  it("lists environment variable names in order and never their values", async () => {
    // The branch that carries secrets has to be exercised without a secret
    // escaping into the report, which is exactly what this asserts: the names
    // are named, and the sentinel values are nowhere in the output at all.
    const { records, stdout } = await runCheck({
      project: {
        ...PROJECT_FIXTURE,
        deployment_configs: {
          production: {
            env_vars: {
              ZONE_SECRET: "value-must-never-be-printed",
              ANALYTICS_TOKEN: "also-must-never-be-printed",
            },
          },
        },
      },
    });

    const vars = verdictOf(records, "Pages environment variables");
    assert.equal(vars.state, OK);
    assert.equal(vars.detail, "ANALYTICS_TOKEN, ZONE_SECRET (names only, never values)");

    assert.doesNotMatch(stdout, /must-never-be-printed/);
    assert.deepEqual(deepProblems(records), []);
  });

  it("calls a production branch the repository does not have a problem", async () => {
    // "master" is the classic wrong answer, and a wrong answer here is a quiet
    // one: pushes build previews, production never publishes, and the site
    // simply never appears. This repository's only branch is "main", so the
    // configured name is rejected outright.
    //
    // The neighbouring arm — a branch that does exist but is not the default —
    // cannot be reached from here: `git()` in the script is pinned to this
    // repository's root, which has one branch, and the harness does not get to
    // rewrite the repository under test. It is left uncovered on purpose rather
    // than faked.
    const { records } = await runCheck({
      project: {
        ...PROJECT_FIXTURE,
        source: {
          ...PROJECT_FIXTURE.source,
          config: { ...PROJECT_FIXTURE.source.config, production_branch: "master" },
        },
      },
    });

    const source = verdictOf(records, "Pages source");
    assert.equal(source.state, PROBLEM);
    assert.match(source.detail, /mdsalmanmasood\/healthaali-website on branch master/);
    assert.match(source.detail, /this repository has no such branch/);
    assert.match(source.detail, /main/);
    assert.match(source.detail, /pushes build previews only/);

    assert.deepEqual(deepProblems(records), ["Pages source"]);
  });
});
