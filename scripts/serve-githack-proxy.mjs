/** Isolated Render free-tier fallback for the GitHack GET-only public JSON proxy. */
import { createServer } from "node:http";
import proxy from "../dist/src/preview/readOnlyProxy.js";

const port = Number(process.env.PORT ?? "10000");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("PREVIEW_PORT_INVALID");
const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/") || req.url.startsWith("//")) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "PREVIEW_REQUEST_PATH_INVALID" }));
    return;
  }
  try {
    const headers = new Headers();
    for (const key of ["origin", "accept", "access-control-request-method", "access-control-request-headers"]) {
      const value = req.headers[key];
      if (typeof value === "string") headers.set(key, value);
    }
    // Bodyless by design: only public GET/OPTIONS are forwarded. POST is denied.
    const incoming = new Request("https://binrat-githack-proxy-v2.onrender.com" + req.url, {
      method: req.method, headers,
    });
    const outgoing = await proxy.fetch(incoming);
    res.writeHead(outgoing.status, Object.fromEntries(outgoing.headers.entries()));
    res.end(Buffer.from(await outgoing.arrayBuffer()));
  } catch {
    res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "PREVIEW_PROXY_INTERNAL_FAILURE" }));
  }
});
server.listen(port, "0.0.0.0", () => {
  console.log("BINRAT_ISOLATED_READ_ONLY_PREVIEW_LISTENING", { port });
});
process.on("SIGTERM", () => server.close());
