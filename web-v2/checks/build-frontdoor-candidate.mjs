import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve, relative } from "node:path";

const webV2 = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(webV2, "..");
const staging = resolve(root, ".artifacts/v3-frontdoor");
const site = join(staging, "site");
const production = process.argv.includes("--production");
rmSync(site, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const env = { ...process.env, VITE_BINRAT_V3_CANDIDATE: "1", VITE_BINRAT_V3_PRODUCTION: production ? "1" : "0" };
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
html = html.replace(/<title>[\s\S]*?<\/title>/, production
  ? "<title>BINRAT — Real Pons finds. Check the receipts.</title>"
  : "<title>BINRAT — Rat Zero / Pons Cases (Candidate)</title>");
if (production) html = html.replace(/\s*<meta name="robots"[^>]*\/>/g, "");
else if (!html.includes('name="robots"')) html = html.replace("</head>", '<meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>');
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
const sourceDirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
const proposal = {
  directory: "./.artifacts/v3-frontdoor/site",
  not_found_handling: "single-page-application",
  run_worker_first: ["/api", "/api/*", "/health", "/telegram/*", "/__candidate/*"]
};
// check-frontdoor-routing.mjs exercises this exact proposal in local workerd.
// Provider routing and the active production configuration remain unverified.
const js = files.filter(item => item.path.startsWith("assets/") && item.path.endsWith(".js"))
  .map(item => readFileSync(join(site, item.path), "utf8")).join("\\n");
if (js.includes("binrat-product-surface-v2-demo")) throw new Error("LEGACY_V2_APP_BUNDLED");
const receipt = {
  schemaVersion: "binrat.frontdoor-staged-static/1",
  sourceSha: sha,
  sourceDirty,
  artifactDirectory: ".artifacts/v3-frontdoor/site",
  mode: production ? "V3_PONS_READONLY_PRODUCTION" : "V3_PONS_READONLY_CANDIDATE",
  apiRouting: "SAME_ORIGIN_ONLY",
  productionAuthorized: false,
  ownerVisualApproval: production ? "OWNER_APPROVED_FROZEN_V3_DIRECTION_2026_10_09" : "APPROVED_LOCAL_CANDIDATE_ONLY_2026_10_08",
  releaseAuthorization: production ? "CONDITIONAL_ON_P0_P2_ACCEPTANCE_2026_10_09" : "NONE",
  cloudflareRoutingProposal: proposal,
  runtimeRoutingVerified: false,
  livePonsSourceHealthy: false,
  rollbackRequires: ["active deployed Worker version", "active asset release identity", "isolated rollback rehearsal"],
  files,
};
writeFileSync(join(staging, "manifest.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ verdict: "STAGED_ONLY", commit: sha, files: files.length, output: receipt.artifactDirectory, bytes: files.reduce((n,f)=>n+f.bytes,0), noDeploy: true }));
execFileSync("node", ["checks/check-frontdoor-package.mjs"], { cwd: webV2, stdio: "inherit" });
