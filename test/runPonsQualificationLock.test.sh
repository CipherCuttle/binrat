#!/usr/bin/env bash
# Real Node 22 + installed TSX loader integration test.
# The original mock-pnpm test did not exercise child-process fd inheritance.
set -euo pipefail
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
BASE="$ROOT/.local/share/binrat-rescue/20261011/replacement-proof/collector-data"
mkdir -p "$BASE"
LOCK="$BASE/binrat.sqlite.collector.lock"
: > "$LOCK"

# Make a valid, intentionally unqualified evidence store, so the real
# TypeScript executable must pass fd9 validation before failing safely.
python3 - "$BASE/binrat.sqlite" "$BASE/budget.sqlite" <<'PY'
import sqlite3,sys
for path in sys.argv[1:]:
    db=sqlite3.connect(path)
    db.execute("CREATE TABLE unrelated_test_fixture (id INTEGER)")
    db.commit()
    db.close()
PY

set +e
output="$(HOME="$ROOT" bash scripts/runPonsQualificationOnce.sh --execute 2>&1)"
status=$?
set -e
if [[ "$status" -eq 0 ]] || [[ "$output" != *'LOCAL_CASE_STORE_NOT_READY'* ]]; then
  echo "FAIL: actual Node/TSX did not reach source preflight with inherited fd9"
  # No raw exception text: avoid accidentally copying environment details.
  exit 1
fi

# The exact original lock must prevent another collector invocation.
exec 8<>"$LOCK"
/usr/bin/flock --nonblock 8
set +e
output="$(HOME="$ROOT" bash scripts/runPonsQualificationOnce.sh --execute 2>&1)"
status=$?
set -e
if [[ "$status" -eq 0 ]] || [[ "$output" != *'another BINRAT collector owns the original lock'* ]]; then
  echo "FAIL: concurrent original-lock writer was not refused"
  exit 1
fi
echo 'PASS: real TSX inherits fd9 and separate original-ledger writer is excluded'
