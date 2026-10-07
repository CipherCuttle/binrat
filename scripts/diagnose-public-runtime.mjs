import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const origin = process.argv[2] ?? "https://binrat.tech";
if (!["https://binrat.tech", "https://binrat-edge-v0.pettevik.workers.dev"].includes(origin)) throw new Error("DIAGNOSTIC_ORIGIN_NOT_ALLOWED");
const observations = [];
let latest;
for (const path of ["/health", "/api/status", "/api/launches/latest", "CASE_FROM_LATEST"]) {
  const route = path === "CASE_FROM_LATEST" ? latest?.launches?.[0]?.launchId && `/api/bag/${latest.launches[0].launchId}` : path;
  if (!route) continue;
  const started = Date.now();
  try {
    const response = await fetch(origin + route, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 BINRAT public-read diagnostic" }, signal: AbortSignal.timeout(15_000) });
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 100_000) { await reader.cancel(); throw new Error("DIAGNOSTIC_BODY_LIMIT"); } chunks.push(value); }
    const bytes = Buffer.concat(chunks); const body = bytes.toString("utf8");
    let json; try { json = JSON.parse(body); } catch {}
    const nonretryable1102 = /\b1102\b/.test(body);
    observations.push({ route, observedAtMs: started, elapsedMs: Date.now() - started, httpStatus: response.status,
      responseSha256: createHash("sha256").update(bytes).digest("hex"), bytes: size,
      cfRay: response.headers.get("cf-ray"), cacheStatus: response.headers.get("cf-cache-status"),
      buildId: response.headers.get("x-binrat-build-id"), schemaVersion: json?.schemaVersion ?? null,
      releaseSha: json?.releaseSha ?? null, nonretryable1102,
      resourceError: nonretryable1102 ? "CLOUDFLARE_RESOURCE_EXHAUSTION_RESPONSE" : null });
    if (route === "/api/launches/latest") latest = json;
    if (nonretryable1102) break; // No retry, load testing, or requests after the resource error.
  } catch (error) { observations.push({ route, observedAtMs: started, elapsedMs: Date.now() - started, outcome: error.name === "TimeoutError" ? "TIMEOUT" : "READ_FAILED" }); }
}
const receipt = { schemaVersion: "binrat.public-runtime-diagnostic/1", origin, observations,
  verdict: "UNVERIFIED", limitation: "Public GET evidence alone cannot distinguish CPU from memory or prove active Worker routing. Use separately obtained read-only revision/error receipts." };
mkdirSync(".artifacts/public-truth", { recursive: true });
const name = origin.includes("workers.dev") ? "worker-runtime-diagnostic.json" : "site-runtime-diagnostic.json";
writeFileSync(`.artifacts/public-truth/${name}`, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
