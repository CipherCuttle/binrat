import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { ponsReadMiddleware, PONS_PREVIEW_ORIGIN } from "./pons-preview-proxy.mjs";

test("local routing permits only two exact public GETs and forwards no credentials", async () => {
  const calls = [];
  const middleware = ponsReadMiddleware(async (url, init) => {
    calls.push({ url, init });
    return new Response('{"public":true}', { headers: { "x-binrat-build-id": "public-build", "set-cookie": "must-not-forward" } });
  });
  const server = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 418; res.end(); }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const path of ["/api/status", "/api/launches/latest"]) {
      const response = await fetch(base + path, { headers: { authorization: "test-not-a-secret", cookie: "test-cookie" } });
      assert.equal(response.status, 200); assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("x-binrat-preview-source"), PONS_PREVIEW_ORIGIN);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      assert.equal((await fetch(base + "/api/status", { method })).status, 405);
    }
    for (const path of ["/api/feed", "/api/bag/abc", "/api/status?url=https://example.com", "/api/status/", "/api/launches/latest?limit=1"]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    assert.equal((await fetch(base + "/visual-lab")).status, 418);
    assert.equal(calls.length, 2);
    for (const { url, init } of calls) {
      assert.ok(url.startsWith(PONS_PREVIEW_ORIGIN + "/api/"));
      assert.equal(init.method, "GET"); assert.equal(init.redirect, "error");
      assert.deepEqual(init.headers, { accept: "application/json" });
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("transport errors and oversized upstream bodies fail closed", async () => {
  for (const upstream of [async () => { throw new Error("unavailable"); }, async () => new Response("x".repeat(100001))]) {
    const middleware = ponsReadMiddleware(upstream);
    const headers = {}, response = { setHeader: (key, value) => { headers[key] = value; }, end: body => { response.body = body; } };
    await middleware({ method: "GET", url: "/api/status" }, response, () => assert.fail("unexpected fallback"));
    assert.equal(response.statusCode, 503);
    assert.equal(JSON.parse(response.body).error, "PONS_PREVIEW_UPSTREAM_UNAVAILABLE");
  }
});
