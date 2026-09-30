// Bounded recovery observation is deliberately separate from deployment readiness.
// A progressing backlog is safe to leave active, but only two fully healthy samples
// qualify a candidate for follow-on feature activation.
export function classifyPonsRecovery(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return 'FAIL';
  const complete = sample =>
    sample.chainId === 4663 &&
    sample.sourceVerified === true &&
    sample.lastSyncError === null &&
    sample.indexReady === true &&
    sample.liveCaughtUp === true &&
    sample.runtimeFresh === true &&
    sample.checkpoint >= sample.target;

  const latest = samples.at(-1);
  const previous = samples.at(-2);
  if (complete(latest) && complete(previous)) return 'PASS';

  const first = samples[0];
  const operational = latest.chainId === 4663 &&
    latest.sourceVerified === true &&
    latest.lastSyncError === null &&
    latest.runtimeFresh === true;
  if (operational && latest.checkpoint > first.checkpoint && latest.backlog < first.backlog) {
    return 'RECOVERY_PROGRESSING';
  }
  return 'FAIL';
}
