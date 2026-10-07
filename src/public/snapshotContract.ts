// The public status contract supplies freshness, never a health-check boolean.
export function verifiedStatusContract(value: Record<string, unknown>): boolean {
  return value.schemaVersion === 'binrat.public-status/0.1' && value.chainId === 4663 &&
    ['FRESH_VERIFIED', 'STALE_VERIFIED'].includes(String(value.state)) &&
    typeof value.checkpointBlock === 'string' && /^(0|[1-9][0-9]*)$/.test(value.checkpointBlock) &&
    typeof value.checkpointBlockHash === 'string' && /^0x[0-9a-f]{64}$/.test(value.checkpointBlockHash) &&
    typeof value.feedDigest === 'string' && /^[0-9a-f]{64}$/.test(value.feedDigest) &&
    Number.isSafeInteger(value.verifiedAtMs) && Number(value.verifiedAtMs) >= 0 &&
    Number.isSafeInteger(value.publicationVersion) && Number(value.publicationVersion) >= 1 &&
    (value.runtimeUpdatedAtMs === null || (Number.isSafeInteger(value.runtimeUpdatedAtMs) && Number(value.runtimeUpdatedAtMs) >= 0)) &&
    (value.freshnessValidUntilMs === null || (Number.isSafeInteger(value.freshnessValidUntilMs) && Number(value.freshnessValidUntilMs) >= 0)) &&
    (value.lastSyncError === null || typeof value.lastSyncError === 'string') &&
    (value.state !== 'FRESH_VERIFIED' || (value.runtimeUpdatedAtMs !== null && value.freshnessValidUntilMs !== null && value.lastSyncError === null));
}
