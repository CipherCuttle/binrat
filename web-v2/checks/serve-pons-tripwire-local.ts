/** LOCAL ONLY: real captured identities, simulated source clock, mock Telegram.
 * No production endpoint, RPC or Telegram network request is permitted. */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, extname } from "node:path";
import { createHmac } from "node:crypto";
import { handleWorkerRequest, type BinratWorkerEnv } from "../../src/cloudflare/worker.js";
import { handleSyncQueueBatch } from "../../src/cloudflare/syncQueue.js";
import { capturedProduction, fixtureNow, createPonsTripwireFixtureDatabase, seedProductionRow, publishFixture } from "../../test/support/ponsTripwireFixture.js";
import type { WatchSource } from "../../src/autonomous/source.js";
import type { Hex } from "../../src/core/types.js";

const origin = "http://127.0.0.1:4194";
const site = resolve(".artifacts/v3-frontdoor/site");
const artifact = resolve(".artifacts/pons-tripwire-browser");
mkdirSync(artifact, { recursive: true });
const dbPath = resolve(artifact, "offline.sqlite");
if (existsSync(dbPath)) unlinkSync(dbPath);
let db = await createPonsTripwireFixtureDatabase(dbPath);
let now = fixtureNow, later = false;
const token = "12345:LOCAL-TEST-NOT-A-TELEGRAM-TOKEN", ownerId = 424242;
const params = new URLSearchParams({ auth_date: String(fixtureNow / 1000), user: JSON.stringify({ id: ownerId, first_name: "Offline owner" }) });
const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
const secret = createHmac("sha256", "WebAppData").update(token).digest();
params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
const initData = params.toString();
const deliveries: unknown[] = [];
const source: WatchSource = {
  async head() {
    const row = capturedProduction.launches[later ? 1 : 0]!;
    return { chainId: 4663, block: BigInt(row.block_number), hash: row.block_hash, timestampMs: now - 1000 };
  },
  async point(block) {
    const row = capturedProduction.launches.find((value) => BigInt(value.block_number) === block);
    if (!row) throw Error("OFFLINE_POINT_UNKNOWN");
    return { hash: row.block_hash, timestampMs: fixtureNow + (row === capturedProduction.launches[0] ? -1000 : 1000) };
  },
};
const externalFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url !== `https://api.telegram.org/bot${token}/sendMessage` || init?.method !== "POST") throw Error("OFFLINE_EXTERNAL_IO_FORBIDDEN");
  deliveries.push(JSON.parse(String(init.body)));
  return new Response(JSON.stringify({ ok: true, result: { message_id: deliveries.length } }), { headers: { "content-type": "application/json" } });
};
function env(): BinratWorkerEnv {
  return {
    DB: db, BINRAT_PONS_READ_ONLY: "true", BINRAT_PONS_TRIPWIRE_ENABLED: "true",
    BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED: "true", BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID: String(ownerId),
    TELEGRAM_BOT_TOKEN: token,
  } as BinratWorkerEnv;
}
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", origin);
    if (url.pathname.startsWith("/__offline/")) {
      let result: unknown;
      if (url.pathname === "/__offline/meta") result = { initData, now, caseId: capturedProduction.openedCaseLaunchId, laterCaseId: capturedProduction.laterMatchingLaunchId, deployer: capturedProduction.deployer };
      else if (request.method !== "POST") { response.writeHead(405).end(); return; }
      else if (url.pathname === "/__offline/restart") { db.close(); db = await createPonsTripwireFixtureDatabase(dbPath); result = { restarted: true }; }
      else if (url.pathname === "/__offline/advance") {
        const row = capturedProduction.launches[1]!;
        now = fixtureNow + 2000; later = true;
        await seedProductionRow(db, row); await publishFixture(db, BigInt(row.block_number), row.block_hash as Hex, now);
        result = { advanced: true, caseId: capturedProduction.laterMatchingLaunchId };
      } else if (url.pathname === "/__offline/cycle") {
        const acks: string[] = [];
        await handleSyncQueueBatch({ messages: [{ body: { kind: "PONS_TRIPWIRE_CYCLE", cycleId: "offline-tripwire", enqueuedAtMs: now }, ack() { acks.push("ACK"); }, retry() { acks.push("RETRY"); } }] }, env(), { now: () => now, ponsTripwireSource: source, externalFetch });
        result = { deliveries, acks };
      } else if (url.pathname === "/__offline/deliveries") result = { deliveries };
      else { response.writeHead(404).end(); return; }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(result)); return;
    }
    if (url.pathname.startsWith("/api/")) {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const reply = await handleWorkerRequest(new Request(url, { method: request.method, headers: request.headers as Record<string, string>, ...(body.length ? { body } : {}) }), env(), { now: () => now, externalFetch, ponsTripwireSource: source });
      response.writeHead(reply.status, Object.fromEntries(reply.headers)); response.end(Buffer.from(await reply.arrayBuffer())); return;
    }
    const file = resolve(site, "." + url.pathname);
    if (file !== site && !file.startsWith(site + "/")) { response.writeHead(400).end(); return; }
    const target = existsSync(file) && extname(file) ? file : resolve(site, "index.html");
    response.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream" }); createReadStream(target).pipe(response);
  } catch (error) { console.error(error); response.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: "OFFLINE_SERVER_FAILED" })); }
});
server.listen(4194, "127.0.0.1", () => console.log("LOCAL_PONS_TRIPWIRE_READY " + origin));
process.on("SIGTERM", () => server.close(() => { db.close(); process.exit(0); }));
