#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/docs/design/brand-v1/proofs/social-v1"
OUT="$ROOT/docs/design/brand-v1/proofs/motion-v1"

RAT="$SRC/rat-found-wide-1200x675.png"
RECEIPT="$SRC/receipt-wide-1200x675.png"
MOTION="$OUT/found-something-v1.mp4"
REDUCED="$OUT/found-something-v1-reduced.mp4"

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
test -s "$RAT"
test -s "$RECEIPT"
mkdir -p "$OUT"

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 30 -t 6.4 -i "$RAT" \
  -loop 1 -framerate 30 -t 6.4 -i "$RECEIPT" \
  -filter_complex "
    color=c=0x060606:s=1200x675:r=30:d=6.4[bg];
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
    [scene]pad=1200:676:0:0:color=0x060606[out]
  " \
  -map "[out]" -an -r 30 -t 6.4 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -threads 1 -x264-params "keyint=192:min-keyint=192:scenecut=0" \
  -movflags +faststart "$MOTION"

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 30 -t 4.8 -i "$RAT" \
  -vf "pad=1200:676:0:0:color=0x060606" \
  -an -r 30 -t 4.8 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -threads 1 -x264-params "keyint=144:min-keyint=144:scenecut=0" \
  -movflags +faststart "$REDUCED"

python - "$OUT" <<'PY'
from __future__ import annotations
import hashlib, json, pathlib, subprocess, sys

out = pathlib.Path(sys.argv[1])
files = ["found-something-v1.mp4", "found-something-v1-reduced.mp4"]

def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def probe(path: pathlib.Path) -> dict:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,avg_frame_rate,codec_name,pix_fmt",
        "-show_entries", "format=duration",
        "-of", "json", str(path),
    ], text=True)
    return json.loads(raw)

manifest = {
    "schemaVersion": "binrat.motion-proof/1",
    "status": "PROTOTYPE_NOT_CANON",
    "fixture": "DEMO / NON-LIVE",
    "sources": [
        "docs/design/brand-v1/proofs/social-v1/rat-found-wide-1200x675.png",
        "docs/design/brand-v1/proofs/social-v1/receipt-wide-1200x675.png",
    ],
    "render": "bash tools/brand/render-motion-proof.sh",
    "verify": "bash tools/brand/verify-motion-proof.sh",
    "ffmpeg": subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0],
    "outputs": {},
}
for name in files:
    p = out / name
    manifest["outputs"][name] = {
        "bytes": p.stat().st_size,
        "sha256": sha256(p),
        "probe": probe(p),
    }

(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
PY

printf 'Rendered %s\nRendered %s\n' "$MOTION" "$REDUCED"
