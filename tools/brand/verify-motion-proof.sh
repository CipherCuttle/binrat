#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/docs/design/brand-v1/proofs/motion-v1"
MOTION="$OUT/found-something-v1.mp4"
REDUCED="$OUT/found-something-v1-reduced.mp4"
MANIFEST="$OUT/manifest.json"

for f in "$MOTION" "$REDUCED" "$MANIFEST"; do
  test -s "$f"
done

probe() {
  ffprobe -v error "$@"
}

assert_eq() {
  local got="$1" expected="$2" label="$3"
  if [[ "$got" != "$expected" ]]; then
    printf 'FAIL %s: got=%s expected=%s\n' "$label" "$got" "$expected" >&2
    exit 1
  fi
}

for f in "$MOTION" "$REDUCED"; do
  assert_eq "$(probe -select_streams v:0 -show_entries stream=width -of csv=p=0 "$f")" "1200" "$f width"
  assert_eq "$(probe -select_streams v:0 -show_entries stream=height -of csv=p=0 "$f")" "676" "$f height"
  assert_eq "$(probe -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$f")" "30/1" "$f fps"
  assert_eq "$(probe -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l | tr -d ' ')" "0" "$f audio streams"
done

MOTION_FRAMES="$(probe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$MOTION")"
REDUCED_FRAMES="$(probe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$REDUCED")"
assert_eq "$MOTION_FRAMES" "192" "motion frame count"
assert_eq "$REDUCED_FRAMES" "144" "reduced frame count"

unique_hashes() {
  ffmpeg -hide_banner -loglevel error -i "$1" -f framemd5 - 2>/dev/null \
    | awk -F',' '/^[0-9]/ {gsub(/[[:space:]]/, "", $6); print $6}' \
    | sort -u | wc -l | tr -d ' '
}

MOTION_UNIQUE="$(unique_hashes "$MOTION")"
REDUCED_UNIQUE="$(unique_hashes "$REDUCED")"

if (( MOTION_UNIQUE < 30 )); then
  printf 'FAIL motion proof has too little visible change: %s unique decoded frames\n' "$MOTION_UNIQUE" >&2
  exit 1
fi

assert_eq "$REDUCED_UNIQUE" "1" "reduced-motion unique decoded frames"

python - "$MANIFEST" <<'PY'
import json, pathlib, sys
m = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert m["schemaVersion"] == "binrat.motion-proof/1"
assert m["status"] == "PROTOTYPE_NOT_CANON"
assert m["fixture"] == "DEMO / NON-LIVE"
assert len(m["outputs"]) == 2
PY

printf 'PASS motion proof: %s unique decoded frames\n' "$MOTION_UNIQUE"
printf 'PASS reduced motion: static semantic composition (%s unique frame)\n' "$REDUCED_UNIQUE"
