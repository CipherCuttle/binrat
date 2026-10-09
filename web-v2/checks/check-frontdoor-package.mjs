import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const staging = join(root, ".artifacts/v3-frontdoor");
const site = join(staging, "site");
rmSync(join(staging, "package-results.json"), { force: true });
const manifest = JSON.parse(readFileSync(join(staging, "manifest.json"), "utf8"));
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceDirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
assert.equal(manifest.sourceSha, sourceSha, "Staged package is not the current HEAD");
assert.equal(manifest.sourceDirty, sourceDirty, "Staged provenance does not match the working tree");
if (process.env.CI) assert.equal(sourceDirty, false, "Exact-head CI requires a clean source tree");
assert.equal(manifest.cloudflareRoutingProposal.not_found_handling, "single-page-application");
assert.deepEqual(manifest.cloudflareRoutingProposal.run_worker_first.slice().sort(),
  ["/api", "/api/*", "/health", "/telegram/*", "/__candidate/*"].sort(), "Universal Worker routing must have no API exceptions");
const actual = [];
function walk(dir, prefix = "") {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name), stat = lstatSync(file), path = prefix + name;
    assert.ok(!stat.isSymbolicLink(), "Symlink in package: " + path);
    if (stat.isDirectory()) walk(file, path + "/");
    else { assert.ok(stat.isFile()); actual.push(path); }
  }
}
walk(site);
assert.deepEqual(actual.sort(), manifest.files.map(f => f.path).sort(), "Manifest must cover exactly the staged files");
assert.equal(new Set(manifest.files.map(f => f.path)).size, manifest.files.length);
assert.equal(manifest.productionAuthorized, false);
const referenced = new Set();
for (const item of manifest.files) {
  assert.equal(resolve(site, item.path), join(site, item.path));
  assert.ok(!item.path.startsWith("../") && !item.path.startsWith("/"));
  const raw = readFileSync(join(site, item.path));
  assert.equal(raw.length, item.bytes, item.path + " size");
  assert.equal(createHash("sha256").update(raw).digest("hex"), item.sha256, item.path + " hash");
  if (/\.(js|css|html)$/.test(item.path)) {
    const text = raw.toString("utf8");
    assert.doesNotMatch(text, /https?:\/\/[^\s"'<>]*workers\.dev|localhost:3000|binrat-product-surface-v2-demo/, item.path);
    // Vite emits local resources in JS strings, CSS urls and HTML attributes.
    for (const match of text.matchAll(/["'(](\/(?:assets|fonts|crew)\/[^"'()\s?#]+|\/favicon\.png)/g)) referenced.add(match[1].slice(1));
  }
}
for (const file of referenced) assert.ok(actual.includes(file), "Missing compiled resource: " + file);
for (const file of ["index.html", "fonts/geist-sans.woff2", "fonts/geist-mono.woff2", "crew/rat-avatar-48.png"]) assert.ok(actual.includes(file));
assert.ok(actual.some(p => /assets\/ratzero-dumpster-desktop-[\w-]+\.webp$/.test(p)));
assert.ok(actual.some(p => /assets\/ratzero-dumpster-mobile-[\w-]+\.webp$/.test(p)));
assert.ok(actual.filter(p => p.endsWith(".html")).length === 1, "Only the V3 HTML entry belongs in this package");
assert.ok(actual.filter(p => p.endsWith(".js")).every(p => /^assets\/frontdoor-candidate-[\w-]+\.js$/.test(p)), "Unexpected JS entry/chunk");
const report = { verdict: "PASS", sourceSha: manifest.sourceSha, sourceDirty: manifest.sourceDirty, files: actual.length,
  referenced: [...referenced].sort(), productionAuthorization: false };
writeFileSync(join(staging, "package-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log("STATIC_PACKAGE_PASS " + actual.length + " files; " + referenced.size + " compiled resource paths");
