#!/usr/bin/env bash
# Check that the production-shaped wrapper inherits the exact original flock fd
# to its child; the child is a harmless stand-in for pnpm/tsx.
set -euo pipefail
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
BASE="$ROOT/.local/share/binrat-rescue/20261011/replacement-proof/collector-data"
mkdir -p "$BASE" "$ROOT/bin"
LOCK="$BASE/binrat.sqlite.collector.lock"
: > "$LOCK"
cat > "$ROOT/bin/pnpm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
test "$BINRAT_SOURCE_LOCK_FD" = 9
test -r /proc/self/fd/9
test "$(stat -Lc '%i' /proc/self/fd/9)" = "$(stat -Lc '%i' "$HOME/.local/share/binrat-rescue/20261011/replacement-proof/collector-data/binrat.sqlite.collector.lock")"
test "$1" = exec && test "$2" = tsx
test "$3" = scripts/qualifyPonsHistoricalLocal.ts
test "$4" = --execute
MOCK
chmod +x "$ROOT/bin/pnpm"
HOME="$ROOT" PATH="$ROOT/bin:$PATH" bash scripts/runPonsQualificationOnce.sh --execute
# The *same* original lock prevents another execution.
exec 8<>"$LOCK"
/usr/bin/flock --nonblock 8
if HOME="$ROOT" PATH="$ROOT/bin:$PATH" bash scripts/runPonsQualificationOnce.sh --execute; then
  echo 'FAIL: concurrent lock admitted'; exit 1
fi
echo 'PASS: inherited collector lock and concurrent refusal'
