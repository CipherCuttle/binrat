#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/docs/design/brand-v1/proofs/motion-v1"
MOTION="$OUT/found-something-v1.mp4"
MANIFEST="$OUT/manifest.json"
LOCK="$ROOT/docs/design/brand-v1/motion-v1/SOURCE_LOCK.json"
SOCIAL_MANIFEST="$ROOT/docs/design/brand-v1/proofs/social-v1/manifest.json"
RAT="$ROOT/docs/design/brand-v1/proofs/social-v1/rat-found-wide-1200x675.png"
RECEIPT="$ROOT/docs/design/brand-v1/proofs/social-v1/receipt-wide-1200x675.png"

for f in "$MOTION" "$MANIFEST" "$LOCK" "$SOCIAL_MANIFEST" "$RAT" "$RECEIPT"; do
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

python3 - "$ROOT" "$MANIFEST" "$LOCK" "$SOCIAL_MANIFEST" "$MOTION" <<'PY'
from __future__ import annotations
import hashlib, json, pathlib, struct, subprocess, sys

root = pathlib.Path(sys.argv[1])
manifest_path = pathlib.Path(sys.argv[2])
lock_path = pathlib.Path(sys.argv[3])
social_manifest_path = pathlib.Path(sys.argv[4])
motion = pathlib.Path(sys.argv[5])

manifest = json.loads(manifest_path.read_text())
lock = json.loads(lock_path.read_text())
social = json.loads(social_manifest_path.read_text())

def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def png_dimensions(path: pathlib.Path) -> list[int]:
    header = path.read_bytes()[:24]
    assert header[:8] == b"\x89PNG\r\n\x1a\n"
    assert header[12:16] == b"IHDR"
    return list(struct.unpack(">II", header[16:24]))

def package_version(name: str) -> str:
    return subprocess.check_output(
        ["dpkg-query", "-W", "-f=${Version}", name], text=True
    ).strip()

def probe(path: pathlib.Path) -> dict:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,avg_frame_rate,codec_name,pix_fmt",
        "-show_entries", "format=duration",
        "-of", "json", str(path),
    ], text=True)
    return json.loads(raw)

assert lock["schemaVersion"] == "binrat.motion-source-lock/1"
assert manifest["schemaVersion"] == "binrat.motion-proof/1"
assert manifest["status"] == "PROTOTYPE_NOT_CANON"
assert manifest["fixture"] == "DEMO / NON-LIVE"
assert manifest["sourceLock"] == "docs/design/brand-v1/motion-v1/SOURCE_LOCK.json"
assert manifest["sourceLockSha256"] == sha256(lock_path)
assert manifest["sources"] == lock["sources"]
assert list(manifest["outputs"]) == ["found-something-v1.mp4"]

for source in lock["sources"]:
    path = root / source["path"]
    actual_hash = sha256(path)
    observed = png_dimensions(path)
    social_meta = social["outputs"][path.name]
    declared = [social_meta["width"], social_meta["height"]]
    assert actual_hash == source["sha256"]
    assert actual_hash == social_meta["sha256"]
    assert observed == source["observedPngDimensions"]
    assert declared == source["declaredSocialManifestDimensions"]

tool = lock["toolchain"]
actual_tool = {
    "runner": tool["runner"],
    "ffmpegAptVersion": package_version("ffmpeg"),
    "ffmpegVersionLine": subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0],
    "libx264AptVersion": package_version("libx264-164"),
}
assert actual_tool == tool
assert manifest["toolchain"] == actual_tool
assert manifest["ffmpeg"] == actual_tool["ffmpegVersionLine"]

rat = next(source for source in lock["sources"] if source["path"].endswith("/rat-found-wide-1200x675.png"))
assert manifest["reducedMotion"]["mode"] == "static-source"
assert manifest["reducedMotion"]["path"] == rat["path"]
assert manifest["reducedMotion"]["sha256"] == rat["sha256"]
assert manifest["reducedMotion"]["observedPngDimensions"] == rat["observedPngDimensions"]
assert manifest["reducedMotion"]["declaredSocialManifestDimensions"] == rat["declaredSocialManifestDimensions"]

out = manifest["outputs"]["found-something-v1.mp4"]
assert out["bytes"] == motion.stat().st_size
assert out["sha256"] == sha256(motion)
assert out["probe"] == probe(motion)
PY

printf 'PASS motion proof: %s unique decoded frames\n' "$MOTION_UNIQUE"
printf 'PASS source lock: both raster inputs and pinned ffmpeg/libx264 toolchain match\n'
printf 'PASS reduced motion: canonical static composition hash matches approved social proof (dimension metadata recorded separately)\n'
