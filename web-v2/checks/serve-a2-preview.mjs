// Compiled replay of captured production D1. Never falls back to LIVE data.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { a2Capture, a2Database } from "../../test/support/a2Specimen.ts";
import { handleWorkerRequest as candidate } from "../../dist/src/cloudflare/worker.js";
const baselineRoot = process.env.BINRAT_A1_WORKTREE;
if (!baselineRoot) throw Error("BINRAT_A1_WORKTREE_REQUIRED");
const baselineSite = resolve(
  process.env.BINRAT_A1_SITE ||
    resolve(baselineRoot, ".artifacts/v3-frontdoor/site"),
);
for (const [worktree, site, expected] of [
  [baselineRoot, baselineSite, "30564864f5d406414f0c09c4d2ba2be5d1e79ab8"],
  [
    ".",
    ".artifacts/v3-frontdoor/site",
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  ],
]) {
  const head = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const manifest = JSON.parse(
    readFileSync(resolve(site, "../manifest.json"), "utf8"),
  );
  if (
    head !== expected ||
    manifest.sourceSha !== head ||
    manifest.sourceDirty === true ||
    manifest.sourceClean === false ||
    execFileSync("git", ["-C", worktree, "status", "--porcelain"], {
      encoding: "utf8",
    }).trim()
  )
    throw Error("EXACT_CLEAN_PREVIEW_REQUIRED");
  for (const file of manifest.files) {
    const bytes = readFileSync(resolve(site, file.path));
    if (
      bytes.length !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      throw Error("PREVIEW_ASSET_MISMATCH");
  }
}
const { handleWorkerRequest: baseline } = await import(
  pathToFileURL(resolve(baselineRoot, "dist/src/cloudflare/worker.js"))
);
const db = await a2Database(),
  stamp = Date.parse(a2Capture.capturedAt);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};
const allowed = (p) =>
  ["/health", "/api/status", "/api/launches/latest"].includes(p) ||
  /^\/api\/bag\/[0-9a-f]{64}(\/evidence)?$/.test(p) ||
  /^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(p);
const servers = [];
for (const [port, handler, root] of [
  [4204, baseline, baselineSite],
  [4205, candidate, resolve(".artifacts/v3-frontdoor/site")],
]) {
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://127.0.0.1:" + port);
      res.setHeader(
        "x-binrat-preview-source",
        "CAPTURED_PRODUCTION_REPLAY_AT_" + a2Capture.capturedAt,
      );
      res.setHeader("x-robots-tag", "noindex,nofollow,noarchive");
      if (req.method !== "GET") {
        res.writeHead(405).end();
        return;
      }
      if (u.pathname.startsWith("/api/") || u.pathname === "/health") {
        if (!allowed(u.pathname)) {
          res.writeHead(404).end("{}");
          return;
        }
        const r = await handler(
          new Request(u),
          { DB: db, BINRAT_PONS_READ_ONLY: "true" },
          { now: () => stamp },
        );
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      const file = resolve(root, "." + u.pathname);
      if (!file.startsWith(root + "/") && file !== root) {
        res.writeHead(400).end();
        return;
      }
      const target =
        existsSync(file) && statSync(file).isFile()
          ? file
          : extname(file)
            ? null
            : resolve(root, "index.html");
      if (!target) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": mime[extname(target)] || "application/octet-stream",
      });
      createReadStream(target).pipe(res);
    } catch (e) {
      res
        .writeHead(503, { "content-type": "application/json" })
        .end(JSON.stringify({ error: String(e.message) }));
    }
  }).listen(port, "127.0.0.1", () =>
    console.log("CAPTURED_PRODUCTION_REPLAY http://127.0.0.1:" + port),
  );
  servers.push(server);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const s of servers) s.close();
    db.close();
    process.exit(0);
  });
