import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync } from "node:fs";
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
for (const path of ["index.html", "visual-lab/scene/alley-bg-desktop.webp", "visual-lab/foreground/ratzero-dumpster-desktop.webp", "crew/rat-avatar-48.png", "fonts/geist-sans.woff2"]) {
  if (!files.some(item => item.path === path)) throw new Error("FRONTDOOR_BUILD_ASSET_MISSING:" + path);
}
if (!files.some(item => item.path.startsWith("assets/") && item.path.endsWith(".js")) ||
    !files.some(item => item.path.startsWith("assets/") && item.path.endsWith(".css"))) {
  throw new Error("FRONTDOOR_BUILD_BUNDLES_MISSING");
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const receipt = {
  schemaVersion: "binrat.frontdoor-staged-static/1",
  sourceSha: sha,
  artifactDirectory: ".artifacts/v3-frontdoor/site",
  mode: "V3_PONS_READONLY_CANDIDATE",
  apiRouting: "SAME_ORIGIN_ONLY",
  productionAuthorized: false,
  files,
};
writeFileSync(join(staging, "manifest.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ verdict: "STAGED_ONLY", commit: sha, files: files.length, output: receipt.artifactDirectory, bytes: files.reduce((n,f)=>n+f.bytes,0), noDeploy: true }));
