#!/usr/bin/env bash
# BINRAT — existing collector lock, no Pons Paper action, no ledger reset.
set -euo pipefail
BASE="$HOME/.local/share/binrat-rescue/20261011/replacement-proof/collector-data"
LOCK="$BASE/binrat.sqlite.collector.lock"
[[ -f "$LOCK" && ! -L "$LOCK" ]] || {
  printf '%s\n' 'BLOCKED: existing BINRAT collector lock is missing or unsafe'; exit 1;
}
[[ "$#" -eq 0 || ( "$#" -eq 1 && "$1" = '--execute' ) ]] || {
  printf '%s\n' 'Usage: bash scripts/runPonsQualificationOnce.sh [--execute]'; exit 2;
}
# The very same kernel lock used by the BINRAT collector is held for the
# full Node operation; no separate lock can accidentally admit concurrency.
exec 9<>"$LOCK"
/usr/bin/flock --nonblock 9 || {
  printf '%s\n' 'BLOCKED: another BINRAT collector owns the original lock'; exit 1;
}
export BINRAT_SOURCE_LOCK_FD=9
exec pnpm exec tsx scripts/qualifyPonsHistoricalLocal.ts "$@"
