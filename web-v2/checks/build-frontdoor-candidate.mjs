import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const webV2 = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(webV2, "..");
const staging = resolve(root, ".artifacts/v3-frontdoor");
const site = join(staging, "site");
rmSync(site, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const env = { ...process.env, VITE_BINRAT_V3_CANDIDATE: "1" };
execFileSync("pnpm", ["exec", "tsc", "-b"], { cwd: webV2, env, stdio: "inherit" });
execFileSync("pnpm", ["exec", "vite", "build", "--outDir", site, "--emptyOutDir"], { cwd: webV2, env, stdio: "inherit" });
// Vite builds the dedicated entry as frontdoor-candidate.html; promote only
// inside the ignored offline staging directory to support SPA navigation.
renameSync(join(site, "frontdoor-candidate.html"), join(site, "index.html"));
const htmlFile = join(site, "index.html");
let html = readFileSync(htmlFile, "utf8");
if (!/type="module"[^>]*src="\/assets\//.test(html) || !/<div id="root"><\/div>/.test(html)) {
  throw new Error("FRONTDOOR_STATIC_ENTRY_INVALID");
}
html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>BINRAT — Rat Zero / Pons Cases (Candidate)</title>");
html = html.replace("</head>", '<meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>');
writeFileSync(htmlFile, html);
const files = [];
function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) collect(path);
    else if (e.isFile()) {
      const raw = readFileSync(path);
      files.push({ path: relative(site, path).split("\\").join("/"), bytes: statSync(path).size, sha256: createHash("sha256").update(raw).digest("hex") });
    }
  }
}
collect(site);
files.sort((a,b) => a.path.localeCompare(b.path));
// publicDir copies Crew/Geist verbatim; imported Visual Lab WebP artwork is
// emitted as hashed Vite assets instead of the original public/visual-lab path.
for (const path of ["index.html", "crew/rat-avatar-48.png", "fonts/geist-sans.woff2"]) {
  if (!files.some(item => item.path === path)) throw new Error("FRONTDOOR_BUILD_ASSET_MISSING:" + path);
}
if (!files.some(item => item.path.startsWith("assets/") && item.path.endsWith(".webp"))) {
  throw new Error("FRONTDOOR_HASHED_ARTWORK_MISSING");
}
if (!files.some(item => item.path.startsWith("assets/") && item.path.endsWith(".js")) ||
    !files.some(item => item.path.startsWith("assets/") && item.path.endsWith(".css"))) {
  throw new Error("FRONTDOOR_BUILD_BUNDLES_MISSING");
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const proposal = {
  directory: "./.artifacts/v3-frontdoor/site",
  not_found_handling: "single-page-application",
  run_worker_first: ["/api", "/api/*", "/health", "/telegram/*", "/__candidate/*"]
};
// Offline contract checks; Cloudflare routing must still be verified on an
// isolated non-production Worker, not inferred from this local path model.
const workerPaths = ["/api", "/api/status", "/api/launches/latest", "/api/miniapp/bootstrap", "/api/holder/session", "/health", "/telegram/webhook", "/__candidate/pons-bootstrap"];
for (const path of workerPaths) {
  if (!(path === "/api" || path.startsWith("/api/") || path === "/health" ||
    path.startsWith("/telegram/") || path.startsWith("/__candidate/"))) {
    throw new Error("FRONTDOOR_API_ROUTING_UNPROTECTED:" + path);
  }
}
const js = files.filter(item => item.path.startsWith("assets/") && item.path.endsWith(".js"))
  .map(item => readFileSync(join(site, item.path), "utf8")).join("\\n");
if (js.includes("binrat-product-surface-v2-demo")) throw new Error("LEGACY_V2_APP_BUNDLED");
const receipt = {
  schemaVersion: "binrat.frontdoor-staged-static/1",
  sourceSha: sha,
  artifactDirectory: ".artifacts/v3-frontdoor/site",
  mode: "V3_PONS_READONLY_CANDIDATE",
  apiRouting: "SAME_ORIGIN_ONLY",
  productionAuthorized: false,
  ownerVisualApproval: "APPROVED_LOCAL_CANDIDATE_ONLY_2026_10_08",
  cloudflareRoutingProposal: proposal,
  runtimeRoutingVerified: false,
  livePonsSourceHealthy: false,
  rollbackRequires: ["active deployed Worker version", "active asset release identity", "isolated rollback rehearsal"],
  files,
};
writeFileSync(join(staging, "manifest.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ verdict: "STAGED_ONLY", commit: sha, files: files.length, output: receipt.artifactDirectory, bytes: files.reduce((n,f)=>n+f.bytes,0), noDeploy: true }));
