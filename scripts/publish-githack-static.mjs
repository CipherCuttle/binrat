/** Create/update only the isolated generated preview branch, never merge or push PR source. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const SOURCE_SHA = process.env.GITHUB_SHA;
const BRANCH = "preview-binrat-g2";
if (!TOKEN || REPO !== "CipherCuttle/binrat" || !/^[a-f0-9]{40}$/.test(SOURCE_SHA ?? ""))
  throw Error("PREVIEW_PUBLISH_AUTHORITY_INVALID");
const dist = new URL("../web-v2/dist/", import.meta.url).pathname;
const base = "https://api.github.com/repos/" + REPO;
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "x-github-api-version": "2022-11-28",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    const error = new Error("GITHUB_PREVIEW_API_" + response.status + ":" + detail);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  });
}
let prior = null;
try {
  prior = await api("/git/ref/heads/" + BRANCH);
} catch (error) {
  if (error.status !== 404) throw error;
}
const paths = walk(dist);
if (paths.length === 0) throw Error("PREVIEW_BUNDLE_EMPTY");
const tree = [];
for (const full of paths) {
  const path = relative(dist, full).replaceAll("\\", "/");
  if (path.startsWith(".") || path.includes("..") || !statSync(full).isFile())
    throw Error("PREVIEW_PATH_INVALID:" + path);
  const buffer = readFileSync(full);
  if (buffer.byteLength > 8 * 1024 * 1024) throw Error("PREVIEW_FILE_TOO_LARGE:" + path);
  const blob = await api("/git/blobs", "POST", { content: buffer.toString("base64"), encoding: "base64" });
  tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
}
const metadata = JSON.stringify({ sourceCommit: SOURCE_SHA, sourceBranch: "feat/binrat-north-star-slice-g0-g2",
  preview: true, upstream: "https://binrat-edge-v0.pettevik.workers.dev",
  apiProxy: "https://binrat-githack-proxy-v2.onrender.com",
  backendMode: "GET_ONLY_PUBLIC_PROXY", tokenLaunch: "NOT_AUTHORIZED" }, null, 2);
const marker = await api("/git/blobs", "POST", { content: metadata, encoding: "utf-8" });
tree.push({ path: "preview-build.json", mode: "100644", type: "blob", sha: marker.sha });
const newTree = await api("/git/trees", "POST", { tree });
const commit = await api("/git/commits", "POST", {
  message: "preview: publish isolated G2 static bundle from " + SOURCE_SHA.slice(0, 12),
  tree: newTree.sha, parents: prior ? [prior.object.sha] : [],
});
if (prior) {
  await api("/git/refs/heads/" + BRANCH, "PATCH", { sha: commit.sha, force: false });
} else {
  await api("/git/refs", "POST", { ref: "refs/heads/" + BRANCH, sha: commit.sha });
}
console.log("GITHACK_PREVIEW_PUBLISHED", { branch: BRANCH, commit: commit.sha, count: tree.length,
  url: "https://raw.githack.com/" + REPO + "/" + BRANCH + "/index.html" });
