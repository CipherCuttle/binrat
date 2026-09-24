/** Isolated public GET-only preview proxy. NEVER import the production Worker or its secrets. */
const UPSTREAM = "https://binrat-edge-v0.pettevik.workers.dev";
const ALLOWED_ORIGIN = "https://raw.githack.com";
const MATCHERS = [
  /^\/api\/(feed|health|capabilities|dumpster-ledger)$/,
  /^\/api\/rat-radar\/watchlist$/,
  /^\/api\/rat-radar\/activity\/[0-9a-f]{64}$/,
  /^\/api\/rat-radar\/address\/0x[0-9a-f]{40}\/activity$/,
  /^\/api\/creator\/0x[0-9a-f]{40}$/,
  /^\/api\/bag\/[0-9a-f]{64}\/replay$/,
] as const;
function json(status: number, error: string, origin: string | null): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(origin === ALLOWED_ORIGIN ? { "access-control-allow-origin": ALLOWED_ORIGIN, "vary": "Origin" } : {}),
    },
  });
}
export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    if (origin && origin !== ALLOWED_ORIGIN) return json(403, "PREVIEW_ORIGIN_NOT_ALLOWED", null);
    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN || request.headers.get("access-control-request-method") !== "GET")
        return json(403, "PREVIEW_CORS_REJECTED", null);
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": ALLOWED_ORIGIN,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "accept",
        "access-control-max-age": "600",
        "vary": "Origin",
      } });
    }
    if (request.method !== "GET") return json(405, "READ_ONLY_PREVIEW", origin);
    const url = new URL(request.url);
    // No generic URL proxy, arbitrary query parameters, depth=full, cookies or credentials.
    if (!MATCHERS.some((rule) => rule.test(url.pathname)))
      return json(404, "PREVIEW_ROUTE_NOT_ALLOWED", origin);
    if (url.searchParams.size > 0 &&
        !(url.pathname === "/api/rat-radar/watchlist" && url.search === "?depth=free"))
      return json(400, "PREVIEW_QUERY_NOT_ALLOWED", origin);
    const upstreamUrl = UPSTREAM + url.pathname + url.search;
    try {
      const result = await fetch(upstreamUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      // Do not turn HTML errors or an upstream outage into apparently valid evidence.
      if (!(result.headers.get("content-type") || "").includes("application/json"))
        return json(502, "UPSTREAM_NON_JSON", origin);
      const bytes = await result.arrayBuffer();
      if (bytes.byteLength > 4 * 1024 * 1024)
        return json(502, "UPSTREAM_RESPONSE_TOO_LARGE", origin);
      return new Response(bytes, {
        status: result.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          ...(origin === ALLOWED_ORIGIN ? { "access-control-allow-origin": ALLOWED_ORIGIN, "vary": "Origin" } : {}),
        },
      });
    } catch {
      return json(503, "PREVIEW_PUBLIC_UPSTREAM_UNAVAILABLE", origin);
    }
  },
};
