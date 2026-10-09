/** Offline Worker adapter hydrated only from captured production authorities.
 * All schema/seed writes are to an in-memory local test database. No remote I/O. */
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import worker from "../../src/cloudflare/worker.js";
import { capturedCaseDatabase } from "../../test/support/caseProductionCapture.js";
const db = await capturedCaseDatabase();
const site = resolve(".artifacts/v3-frontdoor/site");
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
};
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? "/", "http://127.0.0.1:4192");
    if (u.pathname.startsWith("/api/")) {
      const response = await worker.fetch(
        new Request(u, { method: req.method }),
        { DB: db, BINRAT_PONS_READ_ONLY: "true" },
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const file = resolve(site, "." + u.pathname);
    if (file !== site && !file.startsWith(site + "/")) {
      res.writeHead(400).end();
      return;
    }
    const target =
      existsSync(file) && extname(file) ? file : resolve(site, "index.html");
    res.writeHead(200, {
      "content-type": types[extname(target)] ?? "application/octet-stream",
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(503).end("{}");
  }
});
server.listen(4192, "127.0.0.1", () =>
  console.log("LOCAL_CAPTURED_PRODUCTION_WORKER_READY http://127.0.0.1:4192"),
);
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
