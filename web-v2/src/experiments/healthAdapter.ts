import { publicApiUrl } from "../previewRuntime";

export interface PublicHealth {
  ok: boolean;
  chainId: 5042;
  indexReady: boolean;
  checkpointBlock: string | null;
  launchCount: number;
  runtimeFresh: boolean;
  runtimeUpdatedAtMs: number | null;
  historyBackfillComplete: boolean;
  observationReady: boolean;
  lastSyncError: string | null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PUBLIC_HEALTH_SCHEMA_INVALID");
  return value as Record<string, unknown>;
}
function natural(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("PUBLIC_HEALTH_SCHEMA_INVALID");
  return value as number;
}
function block(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error("PUBLIC_HEALTH_SCHEMA_INVALID");
  return value;
}

/** Transport/schema validation only. A 200 or structural pass does not prove index readiness. */
export function adaptPublicHealth(value: unknown): PublicHealth {
  const raw = record(value);
  if (raw.chainId !== 5042 || typeof raw.ok !== "boolean" ||
      typeof raw.indexReady !== "boolean" || typeof raw.runtimeFresh !== "boolean" ||
      typeof raw.historyBackfillComplete !== "boolean" || typeof raw.observationReady !== "boolean" ||
      !(raw.lastSyncError === null || typeof raw.lastSyncError === "string"))
    throw new Error("PUBLIC_HEALTH_SCHEMA_INVALID");
  const checkpointBlock = block(raw.checkpointBlock);
  const launchCount = natural(raw.launchCount);
  const runtimeUpdatedAtMs = raw.runtimeUpdatedAtMs === null ? null : natural(raw.runtimeUpdatedAtMs);
  if (runtimeUpdatedAtMs !== null && runtimeUpdatedAtMs > Date.now() + 5 * 60_000)
    throw new Error("PUBLIC_HEALTH_TIMESTAMP_INVALID");
  if (raw.runtimeFresh && runtimeUpdatedAtMs === null)
    throw new Error("PUBLIC_HEALTH_CONTRADICTORY");
  if (raw.ok === true && (!raw.indexReady || !raw.runtimeFresh ||
      checkpointBlock === null || runtimeUpdatedAtMs === null || raw.lastSyncError !== null))
    throw new Error("PUBLIC_HEALTH_CONTRADICTORY");
  return {
    ok: raw.ok, chainId: 5042, indexReady: raw.indexReady,
    checkpointBlock, launchCount, runtimeFresh: raw.runtimeFresh,
    runtimeUpdatedAtMs, historyBackfillComplete: raw.historyBackfillComplete,
    observationReady: raw.observationReady, lastSyncError: raw.lastSyncError,
  };
}

export async function readPublicHealth(signal: AbortSignal): Promise<PublicHealth> {
  const response = await fetch(publicApiUrl("/api/health"), {
    method: "GET", headers: { accept: "application/json" },
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error("PUBLIC_HEALTH_UNAVAILABLE");
  return adaptPublicHealth(await response.json() as unknown);
}
