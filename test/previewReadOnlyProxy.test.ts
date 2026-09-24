import assert from "node:assert/strict";
import { test } from "node:test";
import proxy from "../src/preview/readOnlyProxy.js";

test("read-only preview proxy blocks credentialed and mutation endpoints", async () => {
  for (const [path,method,status] of [
    ["/api/holder/challenge","GET",404], ["/api/feed","POST",405],
    ["/api/rat-radar/watchlist?depth=full","GET",400],
    ["/telegram/webhook","POST",405],
    ["/api/feed?arbitrary=1","GET",400],
  ] as const) {
    const response = await proxy.fetch(new Request("https://binrat-journey-preview.test" + path,
      { method, headers: { origin: "https://raw.githack.com" } }));
    assert.equal(response.status, status, method + " " + path);
  }
});
test("public preview limits CORS to the GitHack origin", async () => {
  const blocked = await proxy.fetch(new Request("https://binrat-journey-preview.test/api/feed", {
    headers: { origin: "https://attacker.invalid" },
  }));
  assert.equal(blocked.status, 403);
  const allowed = await proxy.fetch(new Request("https://binrat-journey-preview.test/api/feed", {
    method: "OPTIONS", headers: { origin: "https://raw.githack.com", "access-control-request-method": "GET" },
  }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://raw.githack.com");
});
test("public proxy strips credentials, preserves real JSON and upstream errors", async () => {
  const original = globalThis.fetch;
  try {
    let forwarded: RequestInit | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      forwarded = init;
      return new Response(JSON.stringify({ schemaVersion: "binrat.public-feed/0.1" }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const response = await proxy.fetch(new Request("https://binrat-journey-preview.test/api/feed", {
      headers: { origin: "https://raw.githack.com", authorization: "Bearer MUST_NOT_LEAK" },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://raw.githack.com");
    assert.equal(forwarded?.method, "GET");
    assert.deepEqual(forwarded?.headers, { accept: "application/json" });
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "INDEX_NOT_READY" }), {
      status: 503, headers: { "content-type": "application/json" },
    })) as typeof fetch;
    const unavailable = await proxy.fetch(new Request("https://binrat-journey-preview.test/api/feed"));
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: "INDEX_NOT_READY" });
  } finally { globalThis.fetch = original; }
});
