// Local Vite tooling only. No browser credentials or configurable external proxy.
export const PONS_PREVIEW_ORIGIN = "https://binrat-read-plane-stability-candidate.pettevik.workers.dev";
const paths = new Set(["/api/status", "/api/launches/latest"]);

export function ponsReadMiddleware(fetchImpl = globalThis.fetch) {
  return async (request, response, next) => {
    if (!request.url?.startsWith("/api")) return next();
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "application/json");
    const reject = (status, error) => { response.statusCode = status; response.end(JSON.stringify({ error })); };
    if (request.method !== "GET") return reject(405, "PONS_PREVIEW_GET_ONLY");
    if (!paths.has(request.url)) return reject(404, "PONS_PREVIEW_PATH_NOT_ALLOWED");
    try {
      const upstream = await fetchImpl(PONS_PREVIEW_ORIGIN + request.url, {
        method: "GET", redirect: "error", cache: "no-store",
        headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000),
      });
      const reader = upstream.body.getReader(), chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 100000) { await reader.cancel(); throw new Error("BODY_LIMIT"); }
        chunks.push(value);
      }
      for (const name of ["x-binrat-build-id", "x-binrat-source-sha", "cf-ray"]) {
        const value = upstream.headers.get(name);
        if (value) response.setHeader(name, value);
      }
      response.setHeader("x-binrat-preview-source", PONS_PREVIEW_ORIGIN);
      response.statusCode = upstream.status;
      response.end(Buffer.concat(chunks));
    } catch { reject(503, "PONS_PREVIEW_UPSTREAM_UNAVAILABLE"); }
  };
}

/** @returns {import('vite').Plugin} */
export function ponsPreviewProxy() {
  const install = (server) => { server.middlewares.use(ponsReadMiddleware()); };
  return { name: "isolated-pons-readonly", apply: "serve", configureServer: install, configurePreviewServer: install };
}
