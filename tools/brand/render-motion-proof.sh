#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/docs/design/brand-v1/proofs/social-v1"
OUT="$ROOT/docs/design/brand-v1/proofs/motion-v1"
LOCK="$ROOT/docs/design/brand-v1/motion-v1/SOURCE_LOCK.json"
SOCIAL_MANIFEST="$SRC/manifest.json"

RAT="$SRC/rat-found-wide-1200x675.png"
RECEIPT="$SRC/receipt-wide-1200x675.png"
MOTION="$OUT/found-something-v1.mp4"

for cmd in ffmpeg ffprobe python3 dpkg-query; do
  command -v "$cmd" >/dev/null
done
for f in "$RAT" "$RECEIPT" "$LOCK" "$SOCIAL_MANIFEST"; do
  test -s "$f"
done
mkdir -p "$OUT"
rm -f "$OUT/found-something-v1-reduced.mp4"

python3 - "$ROOT" "$LOCK" "$SOCIAL_MANIFEST" <<'PY'
from __future__ import annotations
import hashlib, json, pathlib, struct, subprocess, sys

root = pathlib.Path(sys.argv[1])
lock_path = pathlib.Path(sys.argv[2])
social_manifest_path = pathlib.Path(sys.argv[3])
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
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise RuntimeError(f"not a PNG with IHDR: {path}")
    return list(struct.unpack(">II", header[16:24]))

def package_version(name: str) -> str:
    return subprocess.check_output(
        ["dpkg-query", "-W", "-f=${Version}", name], text=True
    ).strip()

assert lock["schemaVersion"] == "binrat.motion-source-lock/1"
assert lock["status"] == "PINNED_PROTOTYPE_INPUTS"
assert lock["socialManifest"] == "docs/design/brand-v1/proofs/social-v1/manifest.json"

for source in lock["sources"]:
    path = root / source["path"]
    assert path.is_file(), path
    actual_hash = sha256(path)
    actual_dims = png_dimensions(path)
    social_meta = social["outputs"][path.name]
    declared_dims = [social_meta["width"], social_meta["height"]]
    assert actual_hash == source["sha256"], (path, actual_hash, source["sha256"])
    assert actual_hash == social_meta["sha256"], (path, actual_hash, social_meta["sha256"])
    assert actual_dims == source["observedPngDimensions"], (path, actual_dims, source["observedPngDimensions"])
    assert declared_dims == source["declaredSocialManifestDimensions"], (path, declared_dims, source["declaredSocialManifestDimensions"])

tool = lock["toolchain"]
ffmpeg_line = subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0]
assert ffmpeg_line == tool["ffmpegVersionLine"], (ffmpeg_line, tool["ffmpegVersionLine"])
assert package_version("ffmpeg") == tool["ffmpegAptVersion"]
assert package_version("libx264-164") == tool["libx264AptVersion"]
PY

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 30 -t 6.4 -i "$RAT" \
  -loop 1 -framerate 30 -t 6.4 -i "$RECEIPT" \
  -filter_complex "
    color=c=0x101210:s=1200x675:r=30:d=6.4[bg];
    [0:v]split=3[leftsrc][rightsrc][endsrc];
    [leftsrc]crop=610:675:0:0,format=rgba,fade=t=in:st=0.15:d=0.55:alpha=1[left];
    [rightsrc]crop=590:675:610:0,format=rgba,fade=t=in:st=1.00:d=0.38:alpha=1[right];
    [1:v]format=rgba,scale=520:292,fade=t=in:st=3.10:d=0.18:alpha=1,fade=t=out:st=4.95:d=0.22:alpha=1[receipt];
    [bg][left]overlay=x=0:y=0:format=auto[a];
    [a][right]overlay=x=610:y=0:format=auto[b];
    [b][receipt]overlay=
      x=640:
      y='if(lt(t,3.10),675,if(lt(t,3.52),675-335*(t-3.10)/0.42,340+6*exp(-7*(t-3.52))*cos(34*(t-3.52))))':
      enable='between(t,3.10,5.17)':
      format=auto[c];
    [endsrc]format=rgba,fade=t=in:st=5.05:d=0.35:alpha=1[end];
    [c][end]overlay=x=0:y=0:enable='gte(t,5.05)':format=auto[scene];
    [scene]pad=1200:676:0:0:color=0x101210[out]
  " \
  -map "[out]" -an -r 30 -t 6.4 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -threads 1 -x264-params "keyint=192:min-keyint=192:scenecut=0" \
  -movflags +faststart "$MOTION"

python3 - "$OUT" "$LOCK" "$RAT" "$MOTION" <<'PY'
from __future__ import annotations
import hashlib, json, pathlib, struct, subprocess, sys

out = pathlib.Path(sys.argv[1])
lock_path = pathlib.Path(sys.argv[2])
reduced_source = pathlib.Path(sys.argv[3])
motion = pathlib.Path(sys.argv[4])
lock = json.loads(lock_path.read_text())

def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def png_dimensions(path: pathlib.Path) -> list[int]:
    header = path.read_bytes()[:24]
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise RuntimeError(f"not a PNG with IHDR: {path}")
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

rat_source = next(
    source for source in lock["sources"]
    if source["path"].endswith("/rat-found-wide-1200x675.png")
)
toolchain = {
    "runner": lock["toolchain"]["runner"],
    "ffmpegAptVersion": package_version("ffmpeg"),
    "ffmpegVersionLine": subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0],
    "libx264AptVersion": package_version("libx264-164"),
}

manifest = {
    "schemaVersion": "binrat.motion-proof/1",
    "status": "PROTOTYPE_NOT_CANON",
    "fixture": "DEMO / NON-LIVE",
    "sourceLock": "docs/design/brand-v1/motion-v1/SOURCE_LOCK.json",
    "sourceLockSha256": sha256(lock_path),
    "sources": lock["sources"],
    "toolchain": toolchain,
    "render": "bash tools/brand/render-motion-proof.sh",
    "verify": "bash tools/brand/verify-motion-proof.sh",
    "ffmpeg": toolchain["ffmpegVersionLine"],
    "reducedMotion": {
        "mode": "static-source",
        "path": rat_source["path"],
        "sha256": sha256(reduced_source),
        "observedPngDimensions": png_dimensions(reduced_source),
        "declaredSocialManifestDimensions": rat_source["declaredSocialManifestDimensions"],
        "note": "No duplicate video: reduced motion resolves immediately to the already-approved final static composition. Hash is authoritative if upstream declared dimensions disagree with the committed PNG.",
    },
    "outputs": {
        "found-something-v1.mp4": {
            "bytes": motion.stat().st_size,
            "sha256": sha256(motion),
            "probe": probe(motion),
        }
    },
}

(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
PY

printf 'Rendered %s\n' "$MOTION"
