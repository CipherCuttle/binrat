// Local workerd routing proof. No Cloudflare account, bindings or remote requests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../../", import.meta.url));
const staging = join(root, ".artifacts/v3-frontdoor");
const output = join(staging, "routing");
mkdirSync(output, { recursive: true });
rmSync(join(output, "results.json"), { force: true });
// Revalidate source/manifest/policy before accepting local runtime evidence.
await import("./check-frontdoor-package.mjs");
const require = createRequire(process.env.BINRAT_FRONTDOOR_TOOLS ? join(process.env.BINRAT_FRONTDOOR_TOOLS, "runner.cjs") : import.meta.url);
const wranglerPackage = require.resolve("wrangler/package.json");
assert.equal(require(wranglerPackage).version, "4.135.0");
const manifest = JSON.parse(readFileSync(join(staging, "manifest.json"), "utf8"));
const temp = mkdtempSync(join(staging, "routing-local-"));
cpSync(join(staging, "site"), join(temp, "site"), { recursive: true });
// Static collisions must never mask APIs/webhooks, even for navigation or HEAD.
for (const path of ["api/status", "api/future-route", "telegram/webhook", "health"]) {
  const target = join(temp, "site", path); mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "STATIC_COLLISION_MUST_NOT_BE_SERVED");
}
const workerSource = readFileSync(join(root, "src/cloudflare/worker.ts"), "utf8");
const webhook = /request\.method === 'POST' && pathname === '(\/[^']*webhook[^']*)'/.exec(workerSource)?.[1];
assert.ok(webhook, "Find the actual webhook route in Worker source");
assert.doesNotMatch(workerSource, /env\.ASSETS|__STATIC_CONTENT/, "Re-review Worker/static binding integration");
// Exercise the real fetch handler with all IO disabled. Known API handlers can
// fail for missing local data/secrets; reaching them, rather than SPA, is the gate.
writeFileSync(join(temp, "probe.ts"), `import { handleWorkerRequest } from ${JSON.stringify(join(root, "src/cloudflare/worker.ts"))};
export default { async fetch(request) {
  const noIO = () => { throw new Error("LOCAL_PROBE_IO_DISABLED"); };
  let response;
  try { response = await handleWorkerRequest(request, { DB: { prepare: noIO } }, { now: Date.now, externalFetch: noIO }); }
  catch { response = Response.json({ error: "LOCAL_PROBE_HANDLER_REACHED" }, { status: 500 }); }
  response = new Response(response.body, response);
  response.headers.set("x-binrat-local-worker", "reached"); return response;
} };\n`);
writeFileSync(join(temp, "wrangler.json"), JSON.stringify({ name: "binrat-v3-local-route-probe", main: "probe.ts",
  compatibility_date: "2026-09-18", compatibility_flags: ["nodejs_compat"],
  assets: { ...manifest.cloudflareRoutingProposal, directory: "./site" } }, null, 2));
const child = spawn(process.execPath, [join(dirname(wranglerPackage), "bin/wrangler.js"), "dev", "--local",
  "--config", join(temp, "wrangler.json"), "--ip", "127.0.0.1", "--port", "4192", "--inspector-port", "0", "--log-level", "error"],
{ cwd: temp, detached: true, env: { PATH: process.env.PATH, WRANGLER_SEND_METRICS: "false", XDG_CONFIG_HOME: join(temp, "config") }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
child.stdout.on("data", b => { logs += b; }); child.stderr.on("data", b => { logs += b; });
const exited = new Promise(resolve => child.once("exit", resolve));
const report = { sourceSha: manifest.sourceSha, sourceDirty: manifest.sourceDirty, provenance: "LOCAL_WORKERD_REAL_HANDLER_NO_IO",
  wrangler: "4.135.0", providerVerified: false, productionAuthorization: false, webhook, checks: [], verdict: "FAIL" };
const base = "http://127.0.0.1:4192";
try {
  let ready = false;
  for (let n = 0; n < 40; n++) {
    assert.equal(child.exitCode, null, "Wrangler exited: " + logs);
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break; await delay(250);
  }
  assert.ok(ready, "Local router did not start: " + logs);
  for (const path of ["/", "/bag/" + "a".repeat(64), "/visual-lab", "/radar", "/watch", "/replay"]) {
    for (const navigate of [false, true]) {
      const r = await fetch(base + path, { headers: navigate ? { "sec-fetch-mode": "navigate" } : {}, signal: AbortSignal.timeout(5000) });
      assert.equal(r.status, 200, path); assert.match(r.headers.get("content-type"), /text\/html/);
      assert.equal(r.headers.get("x-binrat-local-worker"), null);
      assert.match(await r.text(), /\/assets\/frontdoor-candidate-[\w-]+\.js/);
      report.checks.push({ path, method: "GET", navigate, destination: "V3_HTML", status: r.status });
    }
  }
  const paths = ["/api", "/api/status", "/api/launches/latest", "/api/miniapp/bootstrap", "/api/miniapp/case",
    "/api/miniapp/case-intelligence", "/api/holder/challenge", "/api/holder/session", "/api/future-route",
    "/health", webhook, "/__candidate/rat-smoke", "/__candidate/pons-bootstrap"];
  for (const path of paths) for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    for (const navigate of [false, true]) {
      const r = await fetch(base + path, { method, headers: navigate ? { "sec-fetch-mode": "navigate" } : {}, signal: AbortSignal.timeout(5000) });
      assert.equal(r.headers.get("x-binrat-local-worker"), "reached", method + " " + path);
      assert.match(r.headers.get("content-type"), /application\/json/);
      assert.doesNotMatch(await r.text(), /STATIC_COLLISION|<html/i);
      report.checks.push({ path, method, navigate, destination: "WORKER", status: r.status });
    }
  }
  // Byte equality/MIME checks include all files used by the compiled browser.
  for (const item of manifest.files.filter(f => /\.(js|css|webp|woff2)$/.test(f.path))) {
    const r = await fetch(base + "/" + item.path, { signal: AbortSignal.timeout(5000) });
    assert.equal(r.status, 200); assert.equal(r.headers.get("x-binrat-local-worker"), null);
    assert.doesNotMatch(r.headers.get("content-type"), /text\/html/);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), readFileSync(join(staging, "site", item.path)));
    report.checks.push({ path: "/" + item.path, method: "GET", destination: "STATIC_ASSET", status: 200 });
  }
  const missing = await fetch(base + "/assets/missing-old-chunk.js", { signal: AbortSignal.timeout(5000) });
  report.missingAssetBehavior = { status: missing.status, contentType: missing.headers.get("content-type"),
    limitation: "SPA fallback returns HTML for absent chunks. Retain a complete prior release for cutover/rollback; never claim unknown old chunks load." };
  report.verdict = "LOCAL_PASS";
  console.log("SPA_WORKER_ROUTING_LOCAL_PASS " + report.checks.length + " checks; provider readback still blocked");
} finally {
  process.kill(-child.pid, "SIGTERM");
  await Promise.race([exited, delay(5000).then(() => { if (child.exitCode === null) process.kill(-child.pid, "SIGKILL"); })]);
  writeFileSync(join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(output, "local-wrangler.log"), logs);
}
