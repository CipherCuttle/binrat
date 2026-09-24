/** Repair root-absolute public asset URLs when the Vite bundle is hosted under a GitHack branch path. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = new URL("../dist/", import.meta.url);
const dir = new URL("./assets/", root);
if (!existsSync(root) || !existsSync(dir)) throw Error("STATIC_DIST_MISSING");
const index = new URL("./index.html", root);
let html = readFileSync(index, "utf8");
if (!html.includes("./assets/")) throw Error("VITE_RELATIVE_ASSET_BASE_MISSING");
html = html.replace(/href="\/favicon\.png"/g, 'href="./favicon.png"');
if (/\s(?:src|href)="\/(?:assets|fonts|favicon)/.test(html)) throw Error("STATIC_HTML_ROOT_ASSET");
writeFileSync(index, html);
let cssCount = 0;
for (const filename of readdirSync(dir)) {
  if (!filename.endsWith(".css")) continue;
  const path = join(dir.pathname, filename);
  let css = readFileSync(path, "utf8");
  css = css.replace(/url\(\s*(["']?)\/(fonts\/[^)"']+|binrat-world-background\.png)\1\s*\)/g,
    (_match, _q, asset) => 'url("../' + asset + '")');
  if (/url\(\s*["']?\/(fonts\/|binrat-world-background\.png)/.test(css))
    throw Error("STATIC_CSS_ROOT_ASSET:" + filename);
  writeFileSync(path, css);
  cssCount++;
}
if (cssCount === 0) throw Error("STATIC_CSS_MISSING");
for (const path of ["binrat-character-master.png", "binrat-world-background.png", "favicon.png"]) {
  if (!existsSync(new URL("./" + path, root))) throw Error("STATIC_SOURCE_ASSET_MISSING:" + path);
}
const js = readdirSync(dir).filter(name => name.endsWith(".js"));
if (!js.length) throw Error("STATIC_JS_MISSING");
const bundles = js.map(name => readFileSync(join(dir.pathname, name), "utf8")).join("\n");
if (!bundles.includes("binrat-githack-proxy-v2.onrender.com"))
  throw Error("STATIC_PREVIEW_API_ORIGIN_MISSING");
console.log("GITHACK_STATIC_ASSETS_READY", { cssCount, jsCount: js.length });
