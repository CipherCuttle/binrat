// Bounded recovery observation is deliberately separate from deployment readiness.
// A progressing backlog is safe to leave active, but only two fully healthy samples
// qualify a candidate for follow-on feature activation.
export const PONS_TRANSIENT_TRANSPORT_ERRORS = new Set([
  'SYNC_TIMEOUT_ERROR',
  'SYNC_ETIMEDOUT',
  'SYNC_HTTP_429',
  'SYNC_HTTP_502',
  'SYNC_HTTP_503',
  'SYNC_HTTP_504'
]);
export const PONS_RECOVERY_RETRY_WINDOW_MS = 90_000;

export function isTransientPonsTransportError(code) {
  return typeof code === 'string' && PONS_TRANSIENT_TRANSPORT_ERRORS.has(code);
}

function valueAsBigInt(value) {
  try { return typeof value === 'bigint' ? value : BigInt(value); } catch { return null; }
}

function checkpointRegressed(samples) {
  for (let index = 1; index < samples.length; index += 1) {
    const before = valueAsBigInt(samples[index - 1].checkpoint);
    const after = valueAsBigInt(samples[index].checkpoint);
    if (before === null || after === null || after < before) return true;
  }
  return false;
}

function hasPriorHealthyProgress(samples) {
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1];
    const after = samples[index];
    const beforeCheckpoint = valueAsBigInt(before.checkpoint);
    const afterCheckpoint = valueAsBigInt(after.checkpoint);
    const beforeBacklog = valueAsBigInt(before.backlog);
    const afterBacklog = valueAsBigInt(after.backlog);
    if (
      before.chainId === 4663 && after.chainId === 4663 &&
      before.candidateActive === true && after.candidateActive === true &&
      before.sourceVerified === true && after.sourceVerified === true &&
      before.lastSyncError === null && after.lastSyncError === null &&
      before.runtimeFresh === true && after.runtimeFresh === true &&
      beforeCheckpoint !== null && afterCheckpoint !== null &&
      beforeBacklog !== null && afterBacklog !== null &&
      afterCheckpoint > beforeCheckpoint && afterBacklog < beforeBacklog
    ) return true;
  }
  return false;
}

export function classifyPonsRecovery(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return 'FAIL';
  const complete = sample =>
    sample.chainId === 4663 &&
    sample.sourceVerified === true &&
    sample.lastSyncError === null &&
    sample.indexReady === true &&
    sample.liveCaughtUp === true &&
    sample.runtimeFresh === true &&
    sample.candidateActive === true &&
    valueAsBigInt(sample.checkpoint) !== null &&
    valueAsBigInt(sample.target) !== null &&
    valueAsBigInt(sample.checkpoint) >= valueAsBigInt(sample.target);

  const latest = samples.at(-1);
  const previous = samples.at(-2);
  if (complete(latest) && complete(previous)) return 'PASS';

  if (checkpointRegressed(samples) || samples.some(sample =>
    sample.chainId !== 4663 || sample.candidateActive !== true ||
    (sample.lastSyncError !== null && !isTransientPonsTransportError(sample.lastSyncError))
  )) return 'FAIL';

  if (latest.lastSyncError !== null) {
    const firstTransient = samples.find(sample => sample.lastSyncError !== null);
    const startedAtMs = valueAsBigInt(firstTransient?.atMs);
    const nowMs = valueAsBigInt(latest.atMs);
    if (
      isTransientPonsTransportError(latest.lastSyncError) &&
      hasPriorHealthyProgress(samples) &&
      latest.runtimeFresh === true &&
      startedAtMs !== null && nowMs !== null && nowMs >= startedAtMs &&
      nowMs - startedAtMs <= BigInt(PONS_RECOVERY_RETRY_WINDOW_MS)
    ) return 'RECOVERY_RETRYING';
    return 'FAIL';
  }

  const first = samples[0];
  let lastTransientIndex = -1;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index].lastSyncError !== null) { lastTransientIndex = index; break; }
  }
  if (lastTransientIndex >= 0 && !complete(latest)) {
    const beforeRetry = samples[lastTransientIndex];
    const beforeCheckpoint = valueAsBigInt(beforeRetry.checkpoint);
    const latestCheckpoint = valueAsBigInt(latest.checkpoint);
    const beforeBacklog = valueAsBigInt(beforeRetry.backlog);
    const latestBacklog = valueAsBigInt(latest.backlog);
    if (
      beforeCheckpoint === null || latestCheckpoint === null ||
      beforeBacklog === null || latestBacklog === null ||
      latestCheckpoint <= beforeCheckpoint || latestBacklog >= beforeBacklog
    ) return 'FAIL';
  }
  const operational = latest.chainId === 4663 &&
    latest.candidateActive === true &&
    latest.sourceVerified === true &&
    latest.lastSyncError === null &&
    latest.runtimeFresh === true &&
    valueAsBigInt(latest.checkpoint) !== null && valueAsBigInt(first.checkpoint) !== null &&
    valueAsBigInt(latest.backlog) !== null && valueAsBigInt(first.backlog) !== null;
  if (operational && valueAsBigInt(latest.checkpoint) > valueAsBigInt(first.checkpoint) && valueAsBigInt(latest.backlog) < valueAsBigInt(first.backlog)) {
    return 'RECOVERY_PROGRESSING';
  }
  return 'FAIL';
}
