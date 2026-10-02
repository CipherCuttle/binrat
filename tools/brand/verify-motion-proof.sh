#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/docs/design/brand-v1/proofs/motion-v1"
MOTION="$OUT/found-something-v1.mp4"
MANIFEST="$OUT/manifest.json"
REDUCED_SOURCE="$ROOT/docs/design/brand-v1/proofs/social-v1/rat-found-wide-1200x675.png"
SOCIAL_MANIFEST="$ROOT/docs/design/brand-v1/proofs/social-v1/manifest.json"

for f in "$MOTION" "$MANIFEST" "$REDUCED_SOURCE" "$SOCIAL_MANIFEST"; do
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

assert_eq "$(probe -select_streams v:0 -show_entries stream=width -of csv=p=0 "$MOTION")" "1200" "motion width"
assert_eq "$(probe -select_streams v:0 -show_entries stream=height -of csv=p=0 "$MOTION")" "676" "motion height"
assert_eq "$(probe -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$MOTION")" "30/1" "motion fps"
assert_eq "$(probe -select_streams a -show_entries stream=index -of csv=p=0 "$MOTION" | wc -l | tr -d ' ')" "0" "motion audio streams"
assert_eq "$(probe -select_streams v:0 -show_entries stream=width -of csv=p=0 "$REDUCED_SOURCE")" "1200" "reduced static width"
assert_eq "$(probe -select_streams v:0 -show_entries stream=height -of csv=p=0 "$REDUCED_SOURCE")" "675" "reduced static height"

MOTION_FRAMES="$(probe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$MOTION")"
assert_eq "$MOTION_FRAMES" "192" "motion frame count"

MOTION_UNIQUE="$(
  ffmpeg -hide_banner -loglevel error -i "$MOTION" -f framemd5 - 2>/dev/null \
    | awk -F',' '/^[0-9]/ {gsub(/[[:space:]]/, "", $6); print $6}' \
    | sort -u | wc -l | tr -d ' '
)"

if (( MOTION_UNIQUE < 30 )); then
  printf 'FAIL motion proof has too little visible change: %s unique decoded frames\n' "$MOTION_UNIQUE" >&2
  exit 1
fi

python - "$MANIFEST" "$REDUCED_SOURCE" "$SOCIAL_MANIFEST" <<'PY'
import hashlib, json, pathlib, sys

motion_manifest = json.loads(pathlib.Path(sys.argv[1]).read_text())
reduced = pathlib.Path(sys.argv[2])
social_manifest = json.loads(pathlib.Path(sys.argv[3]).read_text())

def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

expected = social_manifest["outputs"]["rat-found-wide-1200x675.png"]["sha256"]
actual = sha256(reduced)

assert motion_manifest["schemaVersion"] == "binrat.motion-proof/1"
assert motion_manifest["status"] == "PROTOTYPE_NOT_CANON"
assert motion_manifest["fixture"] == "DEMO / NON-LIVE"
assert list(motion_manifest["outputs"]) == ["found-something-v1.mp4"]
assert motion_manifest["reducedMotion"]["mode"] == "static-source"
assert motion_manifest["reducedMotion"]["path"] == "docs/design/brand-v1/proofs/social-v1/rat-found-wide-1200x675.png"
assert motion_manifest["reducedMotion"]["sha256"] == actual
assert actual == expected
PY

printf 'PASS motion proof: %s unique decoded frames\n' "$MOTION_UNIQUE"
printf 'PASS reduced motion: canonical static composition hash matches approved social proof\n'
