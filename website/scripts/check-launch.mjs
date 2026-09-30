/**
 * HealThaali — launch-state probe
 * -------------------------------
 *   npm run check:launch
 *
 * [`LAUNCH.md`](../../LAUNCH.md) records everything about this deployment that
 * lives in a dashboard: the registrar's verification state, the zone's
 * delegation, the Pages project, the certificate, the mail records. That file is
 * checked off by hand, so it drifts the moment someone changes a setting.
 *
 * This script re-derives those same items from the outside, using nothing but
 * public DNS, RDAP and HTTPS — no credentials, no dashboard, no dependencies.
 * It answers the only two questions a maintainer actually has:
 *
 *   1. Which launch items are still outstanding? (`○` — expected before launch)
 *   2. Has something that was working regressed? (`✗` — never acceptable)
 *
 * The distinction is the whole point. "No Pages project yet" is a legitimate
 * state for an unlaunched site and must not read as a failure; "the registrar
 * has suspended the domain" or "the parking A records are back" are failures at
 * any time, including before launch. Only the second kind exits non-zero, so
 * this can be run on any morning without crying wolf.
 *
 * What each check is really asserting:
 *
 *   1. Delegation      the domain publishes Cloudflare's nameservers, not
 *                      GoDaddy's and not nothing
 *   2. Registrar       RDAP does not report `client hold`; a held domain
 *                      resolves nowhere regardless of what DNS is configured
 *   3. Parking records the apex has no `A` record, and `www` does not point back
 *                      at the apex — both block Pages from claiming the names
 *   4. Site            the hostname answers 200 *and* the response is this
 *                      site's HTML, not a parking page wearing its name
 *   5. Headers         the deployed response carries the CSP from `_headers`,
 *                      which is the only way to know the host is reading it
 *   6. Certificate     enough validity left that an unnoticed renewal failure
 *                      is caught weeks early, not by a browser warning
 *   7. Mail            MX records exist, so the published `info@` address is
 *                      not a black hole
 *   8. Pages project   the `*.pages.dev` project exists and serves something,
 *                      which is true independently of the custom domain
 *   9. Cloudflare      *only when a read-only token is in the environment*:
 *                      the dashboard state itself, which has no public
 *                      footprint at all — the zone's status and nameservers
 *                      against what DNS publishes, every record in the zone,
 *                      the Pages build settings, its custom domains, and which
 *                      environment variables exist (names only, never values)
 *
 * Exit code 0 = no problems (outstanding items are reported, not fatal),
 *             1 = at least one ✗.
 *
 * Deliberately not part of `npm run verify`: that gate is offline and hermetic,
 * so it can never be blamed on the network. This one depends on the internet and
 * on DNS pointing at the deployment, which is the entire point of it.
 */

import dns from "node:dns/promises";
import tls from "node:tls";

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SITE = option("--site", process.env.PUBLIC_SITE_URL || "https://healthaali.in");
const HOST = new URL(SITE).hostname;

/** The Pages project named in LAUNCH.md. `*.pages.dev` is the free hostname. */
const PAGES_PROJECT = option("--pages-project", "healthaali");
const PAGES_HOST = `${PAGES_PROJECT}.pages.dev`;

/** Values that mean the launch has regressed, whatever else is true. */
const CLOUDFLARE_NAMESERVERS = ["amber.ns.cloudflare.com", "remy.ns.cloudflare.com"];
const PARKED_NAMESERVERS = ["domaincontrol.com"];
const PARKED_ADDRESSES = ["3.33.130.190", "15.197.148.33"];
const PARKED_CNAME = HOST;

/** Days of certificate validity below which something has stopped renewing. */
const CERTIFICATE_FLOOR_DAYS = 14;

const TIMEOUT_MS = 15_000;

/**
 * Where to ask for registration status, in order.
 *
 * The bootstrap service is registry-agnostic; the second entry is the `.in`
 * registry itself, as a fallback when the bootstrap is down. Both answer 403 to
 * a request that carries no `User-Agent`, which is exactly how the first run of
 * this script reported a phantom "registrar problem" — so the headers below are
 * load-bearing, not decoration.
 */
const RDAP_ENDPOINTS = [
  `https://rdap.org/domain/${HOST}`,
  `https://rdap.nixiregistry.in/rdap/domain/${HOST}`,
];

const RDAP_HEADERS = {
  Accept: "application/rdap+json",
  "User-Agent": `healthaali-launch-check/1.0 (+${SITE})`,
};

/* ── result plumbing ──────────────────────────────────────────────────────── */

/** @type {{ label: string, state: "ok"|"pending"|"problem", detail: string }[]} */
const results = [];

const record = (state, label, detail) => results.push({ label, state, detail });

const ok = (label, detail) => record("ok", label, detail);
const pending = (label, detail) => record("pending", label, detail);
const problem = (label, detail) => record("problem", label, detail);

const SYMBOL = { ok: "✓", pending: "○", problem: "✗" };

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** `dns` rejects for NODATA as well as NXDOMAIN; both mean "no answer". */
async function resolve(fn, ...args) {
  try {
    return { values: await fn(...args) };
  } catch (error) {
    return { error: error.code || error.message };
  }
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/** The peer certificate, or the reason there is none. */
function inspectCertificate(host, servername = host) {
  return new Promise((resolve_) => {
    const settle = (value) => {
      socket.destroy();
      resolve_(value);
    };

    const socket = tls.connect({ host, servername, port: 443, timeout: TIMEOUT_MS }, () => {
      const certificate = socket.getPeerCertificate();
      settle({
        certificate,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError,
        protocol: socket.getProtocol(),
      });
    });

    socket.on("timeout", () => settle({ error: "connection timed out" }));
    socket.on("error", (error) => settle({ error: error.message }));
  });
}

const daysUntil = (date) => Math.floor((date.getTime() - Date.now()) / 86_400_000);

/* ── 1. delegation ────────────────────────────────────────────────────────── */

async function checkDelegation() {
  const { values, error } = await resolve(dns.resolveNs, HOST);

  if (error) {
    problem(
      "Delegation",
      `the domain publishes no nameservers (${error}) — a suspended or ` +
        `unregistered domain looks exactly like this`
    );
    return;
  }

  const lower = values.map((name) => name.toLowerCase());
  const onCloudflare = lower.some((name) => name.endsWith(".ns.cloudflare.com"));

  if (onCloudflare) {
    ok("Delegation", `answered by ${values.join(", ")}`);
    return;
  }

  if (lower.some((name) => PARKED_NAMESERVERS.some((parked) => name.endsWith(parked)))) {
    pending(
      "Delegation",
      `still on the registrar's nameservers (${values.join(", ")}) — the switch ` +
        `to Cloudflare has not taken effect, or was reverted`
    );
    return;
  }

  problem("Delegation", `unexpected nameservers: ${values.join(", ")}`);
}

/* ── 2. registrar status ──────────────────────────────────────────────────── */

async function checkRegistrar() {
  let rdap;
  let lastError = "no endpoint tried";

  for (const endpoint of RDAP_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, { headers: RDAP_HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rdap = await response.json();
      break;
    } catch (error) {
      lastError = `${new URL(endpoint).hostname} → ${error.message}`;
    }
  }

  if (!rdap) {
    problem("Registrar status", `RDAP could not be read (${lastError})`);
    return;
  }

  const statuses = (rdap.status || []).map((value) => value.toLowerCase());
  const expiration = (rdap.events || []).find((event) => event.eventAction === "expiration");
  const expiryNote = expiration
    ? `, expires ${expiration.eventDate.slice(0, 10)} (${daysUntil(
        new Date(expiration.eventDate)
      )} days)`
    : "";

  if (statuses.includes("client hold") || statuses.includes("clienthold")) {
    problem(
      "Registrar status",
      `the registrar has the domain on hold${expiryNote} — nothing resolves ` +
        `while this is true, whatever DNS says`
    );
    return;
  }

  // A lifted hold leaves no status at all in the registry's answer, so an empty
  // list is the healthy case rather than missing data.
  const statusNote = statuses.length ? ` (registry status: ${statuses.join(", ")})` : "";
  ok("Registrar status", `no hold${statusNote}${expiryNote}`);
}

/* ── 3. parking records ───────────────────────────────────────────────────── */

async function checkParkingRecords() {
  const apex = await resolve(dns.resolve4, HOST);

  if (apex.error) {
    ok("Apex A record", `none (${apex.error}) — free for the Pages custom domain`);
  } else {
    const parked = apex.values.filter((address) => PARKED_ADDRESSES.includes(address));
    if (parked.length > 0) {
      problem(
        "Apex A record",
        `the registrar's parking addresses are back (${parked.join(", ")}) — ` +
          `they block Pages from claiming the apex`
      );
    } else {
      ok("Apex A record", `served by ${apex.values.join(", ")}`);
    }
  }

  const www = await resolve(dns.resolveCname, `www.${HOST}`);
  if (www.error) {
    ok("www CNAME", `none (${www.error})`);
    return;
  }

  if (www.values.some((target) => target.toLowerCase().replace(/\.$/, "") === PARKED_CNAME)) {
    problem(
      "www CNAME",
      `points back at the apex (${www.values.join(", ")}) — the parking entry ` +
        `must be removed so the project can own the name`
    );
    return;
  }

  ok("www CNAME", `→ ${www.values.join(", ")}`);
}

/* ── 4–6. what the hostname actually serves ───────────────────────────────── */

/**
 * Fetched once and reused: whether the live site answers, what it answers with,
 * and the certificate behind it are three views of the same request.
 */
async function fetchHomepage() {
  try {
    const response = await fetchWithTimeout(`${SITE}/`, { redirect: "follow" });
    const body = await response.text();
    return { response, body };
  } catch (error) {
    return { error: error.message };
  }
}

function checkSite(homepage) {
  if (homepage.error) {
    pending(
      "Live site",
      `${SITE} does not answer yet (${homepage.error}) — expected until the ` +
        `Pages project exists and the custom domain is attached`
    );
    return false;
  }

  const { response, body } = homepage;

  if (response.status !== 200) {
    problem("Live site", `${SITE} returned HTTP ${response.status}`);
    return false;
  }

  // Answering is not the same as answering with *this* site: a parked page, a
  // stale host or a mis-attached domain all return 200 happily.
  const looksLikeTheSite =
    body.includes("HealThaali") && body.includes(`rel="canonical" href="${SITE}`);

  if (!looksLikeTheSite) {
    problem(
      "Live site",
      `${SITE} answers 200 but the HTML is not this site's — no HealThaali ` +
        `branding or canonical link was found`
    );
    return false;
  }

  ok("Live site", `200, canonical points at ${SITE}`);
  return true;
}

function checkHeaders(homepage) {
  if (homepage.error || homepage.response.status !== 200) {
    pending("Security headers", "cannot be read until the site answers");
    return;
  }

  const csp = homepage.response.headers.get("content-security-policy");
  const hsts = homepage.response.headers.get("strict-transport-security");
  const server = homepage.response.headers.get("server") || "unknown server";

  if (!csp) {
    problem(
      "Security headers",
      `no Content-Security-Policy in the response (${server}) — the host is not ` +
        `reading \`_headers\` from the build output`
    );
    return;
  }

  ok("Security headers", `CSP and ${hsts ? "HSTS" : "no HSTS"} present (${server})`);
}

async function checkCertificate(homepage) {
  if (homepage.error) {
    pending("Certificate", "cannot be read until the site answers");
    return;
  }

  const result = await inspectCertificate(HOST);
  if (result.error) {
    problem("Certificate", `could not be read from ${HOST}:443 (${result.error})`);
    return;
  }

  const validTo = new Date(result.certificate.valid_to);
  const days = daysUntil(validTo);

  if (!result.authorized) {
    problem(
      "Certificate",
      `not trusted (${result.authorizationError}) — valid_to ${validTo
        .toISOString()
        .slice(0, 10)}`
    );
    return;
  }

  if (days < CERTIFICATE_FLOOR_DAYS) {
    problem(
      "Certificate",
      `expires in ${days} days (${validTo.toISOString().slice(0, 10)}) — renewal ` +
        `has stopped working`
    );
    return;
  }

  ok(
    "Certificate",
    `valid until ${validTo.toISOString().slice(0, 10)} (${days} days), ${result.protocol}`
  );
}

/* ── 7. mail ──────────────────────────────────────────────────────────────── */

async function checkMail() {
  const { values, error } = await resolve(dns.resolveMx, HOST);

  if (error || values.length === 0) {
    pending(
      "Mail records",
      `no MX records (${error || "empty"}) — the published info@${HOST} address ` +
        `cannot receive mail`
    );
    return;
  }

  const sorted = values.sort((a, b) => a.priority - b.priority);

  // RFC 7505: a single "." target is a *null MX*, which means "this domain
  // accepts no mail". Counting records would call that healthy, when it is the
  // opposite of healthy for an address the site publishes.
  if (sorted.every((mx) => mx.exchange === "." || mx.exchange === "")) {
    pending(
      "Mail records",
      `publishes a null MX — the domain states outright that it accepts no ` +
        `mail, so info@${HOST} cannot receive any`
    );
    return;
  }

  ok("Mail records", sorted.map((mx) => mx.exchange).join(", "));
}

/* ── 8. the Pages project itself ──────────────────────────────────────────── */

async function checkPagesProject() {
  try {
    const response = await fetchWithTimeout(`https://${PAGES_HOST}/`, { redirect: "follow" });
    ok(
      "Pages project",
      `${PAGES_HOST} answers HTTP ${response.status} — note that a project ` +
        `serving its placeholder still counts here`
    );
  } catch (error) {
    pending("Pages project", `${PAGES_HOST} does not exist (${error.message})`);
  }
}

/* ── 9. the dashboard state itself, via the Cloudflare API ─────────────────── */

/**
 * Everything above infers the deployment from what the internet can see.
 * Everything below asks Cloudflare directly, which is the only way to check the
 * settings that have no public footprint: the Pages build command, the root
 * directory, whether a custom domain finished validating, which environment
 * variables exist.
 *
 * A token scoped to exactly three read permissions turns this on. Nothing else
 * is needed, and the script never writes anything:
 *
 *   Zone    → Zone            → Read
 *   Zone    → DNS             → Read
 *   Account → Cloudflare Pages → Read
 *
 * Environment variable *names* are listed; their values are never printed, and
 * secret values cannot be read back from the API at all.
 */
const CLOUDFLARE_TOKEN = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

/**
 * The API's `pages_domain.status` values that mean the hostname is not serving.
 * The others (`initializing`, `pending`) are just early, so they read as
 * outstanding rather than broken.
 */
const FAILED_DOMAIN_STATUSES = ["error", "blocked", "deactivated"];

/** The build settings the project must have, from LAUNCH.md. */
const EXPECTED_BUILD_CONFIG = {
  root_dir: "website",
  build_command: "npm run build",
  destination_dir: "dist",
};

async function cloudflare(path) {
  const response = await fetchWithTimeout(`${CLOUDFLARE_API}${path}`, {
    headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, Accept: "application/json" },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const detail =
      (payload?.errors || []).map((error) => `${error.code} ${error.message}`).join("; ") ||
      `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload.result;
}

/** How a record reads in a message: `CNAME healthaali.pages.dev`. */
const describeRecord = (record) => `${record.type} ${record.content}`;

async function checkCloudflare() {
  if (!CLOUDFLARE_TOKEN) {
    pending(
      "Cloudflare API",
      "skipped — set CLOUDFLARE_API_TOKEN (Zone:Read, DNS:Read, Pages:Read) to " +
        "check the dashboard settings themselves, not only their effects"
    );
    return;
  }

  let zone;
  try {
    const zones = await cloudflare(`/zones?name=${HOST}`);
    zone = Array.isArray(zones) ? zones[0] : undefined;
    if (!zone) throw new Error(`no zone named ${HOST} is visible to this token`);
  } catch (error) {
    problem(
      "Cloudflare API",
      `the zone could not be read (${error.message}) — a token with Zone:Read, ` +
        `DNS:Read and Pages:Read is required`
    );
    return;
  }

  /* the zone */
  const plan = zone.plan?.name || "unknown plan";
  if (zone.paused || zone.status === "paused") {
    problem("Cloudflare zone", `paused (${plan}) — Cloudflare is serving nothing`);
  } else if (zone.status !== "active") {
    pending("Cloudflare zone", `status "${zone.status}" (${plan}) — must be Active to serve`);
  } else {
    ok("Cloudflare zone", `active, ${plan}`);
  }

  /* the zone's own idea of its nameservers, against what the domain publishes */
  const expectedNameservers = zone.name_servers || [];
  const publishedNameservers = (await resolve(dns.resolveNs, HOST)).values || [];
  const unpublished = expectedNameservers.filter((name) => !publishedNameservers.includes(name));

  if (expectedNameservers.length === 0) {
    pending("Zone nameservers", "the API returned none — unexpected for a full zone");
  } else if (unpublished.length > 0) {
    problem(
      "Zone nameservers",
      `the zone expects ${expectedNameservers.join(", ")} but the domain publishes ` +
        `${publishedNameservers.join(", ") || "nothing"}`
    );
  } else {
    ok("Zone nameservers", `${expectedNameservers.join(", ")} — matches what DNS publishes`);
  }

  /* every record in the zone */
  let records;
  try {
    records = await cloudflare(`/zones/${zone.id}/dns_records?per_page=100`);
  } catch (error) {
    problem("Zone records", `could not be listed (${error.message})`);
  }

  if (Array.isArray(records)) {
    const parked = records.filter((record) => PARKED_ADDRESSES.includes(record.content));
    if (parked.length > 0) {
      problem(
        "Zone records",
        `the registrar's parking entries are present (${parked.map(describeRecord).join(", ")}) — ` +
          `they block the Pages custom domain`
      );
    } else {
      ok("Zone records", `${records.length} in total, no parking entries`);
    }

    for (const [label, name] of [
      ["apex", HOST],
      ["www", `www.${HOST}`],
    ]) {
      const owned = records.filter((record) => record.name === name);

      if (owned.length === 0) {
        pending(`Zone record (${label})`, "none yet — the Pages custom domain creates it");
      } else if (owned.some((record) => record.type === "A" || record.type === "AAAA")) {
        problem(
          `Zone record (${label})`,
          `a hand-made ${owned.map(describeRecord).join(", ")} exists; Pages has to own this name`
        );
      } else if (!owned.some((record) => String(record.content).includes(PAGES_HOST))) {
        problem(
          `Zone record (${label})`,
          `${owned.map(describeRecord).join(", ")} does not point at ${PAGES_HOST}`
        );
      } else if (owned.some((record) => !record.proxied)) {
        problem(
          `Zone record (${label})`,
          `points at ${PAGES_HOST} but proxying is off — Pages is only served through Cloudflare's edge`
        );
      } else {
        ok(`Zone record (${label})`, `${owned.map(describeRecord).join(", ")}, proxied`);
      }
    }
  }

  /* the Pages project, its build settings, domains and variables */
  const accountId = zone.account?.id;
  if (!accountId) {
    problem("Pages project (API)", "the zone response carried no account id");
    return;
  }

  let project;
  try {
    project = await cloudflare(`/accounts/${accountId}/pages/projects/${PAGES_PROJECT}`);
  } catch (error) {
    pending(
      "Pages project (API)",
      `not readable (${error.message}) — the project most likely does not exist yet`
    );
  }

  if (project) {
    const config = project.build_config || {};
    const mismatched = Object.entries(EXPECTED_BUILD_CONFIG).filter(
      ([key, expected]) => (config[key] || "") !== expected
    );

    if (mismatched.length > 0) {
      problem(
        "Pages build settings",
        mismatched
          .map(([key, expected]) => `${key} is "${config[key] || "(empty)"}", should be "${expected}"`)
          .join("; ")
      );
    } else {
      ok(
        "Pages build settings",
        `root_dir website, npm run build → dist (subdomain ${project.subdomain || PAGES_HOST})`
      );
    }

    const source = project.source?.config;
    ok(
      "Pages source",
      source
        ? `${source.owner}/${source.repo_name} on branch ${source.production_branch}`
        : "no git source attached"
    );

    const envVars = project.deployment_configs?.production?.env_vars || {};
    const names = Object.keys(envVars).sort();
    ok(
      "Pages environment variables",
      names.length > 0
        ? `${names.join(", ")} (names only, never values)`
        : 'none set — the honest "coming soon" build'
    );

    let domains;
    try {
      domains = await cloudflare(`/accounts/${accountId}/pages/projects/${PAGES_PROJECT}/domains`);
    } catch (error) {
      problem("Pages custom domains", `could not be listed (${error.message})`);
    }

    if (Array.isArray(domains)) {
      const attached = domains.map((domain) => domain.name);
      const failed = domains.filter((domain) => FAILED_DOMAIN_STATUSES.includes(domain.status));
      const waiting = domains.filter(
        (domain) => domain.status !== "active" && !FAILED_DOMAIN_STATUSES.includes(domain.status)
      );
      const notAttached = [HOST, `www.${HOST}`].filter((name) => !attached.includes(name));

      if (failed.length > 0) {
        problem(
          "Pages custom domains",
          failed
            .map((domain) => {
              const reason = domain.validation_data?.error_message;
              return `${domain.name} is ${domain.status}${reason ? ` — ${reason}` : ""}`;
            })
            .join("; ")
        );
      } else if (domains.length === 0) {
        pending("Pages custom domains", "none attached — the site only answers on its *.pages.dev address");
      } else {
        const note = waiting.length > 0 ? ` (still validating: ${waiting.map((d) => d.name).join(", ")})` : "";
        const missing = notAttached.length > 0 ? `; not attached: ${notAttached.join(", ")}` : "";
        (waiting.length > 0 || notAttached.length > 0 ? pending : ok)(
          "Pages custom domains",
          `${attached.join(", ")}${note}${missing}`
        );
      }
    }
  }
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const homepage = await fetchHomepage();

  await checkDelegation();
  await checkRegistrar();
  await checkParkingRecords();
  checkSite(homepage);
  checkHeaders(homepage);
  await checkCertificate(homepage);
  await checkMail();
  await checkPagesProject();
  await checkCloudflare();

  const ok_ = results.filter((r) => r.state === "ok");
  const outstanding = results.filter((r) => r.state === "pending");
  const problems = results.filter((r) => r.state === "problem");

  console.log(`\nHealThaali launch state — ${SITE}\n`);

  for (const { state, label, detail } of results) {
    console.log(`  ${SYMBOL[state]} ${label}`);
    console.log(`      ${detail}`);
  }

  console.log(
    `\n  ${ok_.length} satisfied, ${outstanding.length} outstanding, ` +
      `${problems.length} problem(s) — see LAUNCH.md for the settings behind each.\n`
  );

  if (outstanding.length > 0) {
    console.log("  Still outstanding (expected before launch):");
    for (const { label } of outstanding) console.log(`    ○ ${label}`);
    console.log("");
  }

  if (problems.length > 0) {
    console.error("  Problems — these are wrong at any point in the launch:\n");
    for (const { label, detail } of problems) console.error(`    ✗ ${label}\n      ${detail}`);
    console.error(
      `\n✗ Launch check failed — ${problems.length} problem(s).\n` +
        `  None of these are fixed by hiding them in a dashboard the code cannot see.\n`
    );
    process.exit(1);
  }

  console.log(
    `✓ Launch check passed — no problems.\n` +
      (outstanding.length > 0
        ? `  Nothing is broken; ${outstanding.length} item(s) are simply not done yet.\n`
        : `  Every launch item is satisfied.\n`)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
