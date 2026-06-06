#!/usr/bin/env bash
#
# build-demo.sh — regenerate the README hero demo from the source recording.
#
# Produces an animated WebP (full color, autoplays + loops on GitHub) that
# replaces the legacy 256-color GIF. WebP is the default because the demo is a
# text- and gradient-heavy UI screencast, where GIF's 256-color palette is the
# quality ceiling regardless of file size. APNG and GIF outputs are available
# as fallbacks.
#
# Usage:
#   scripts/build-demo.sh                  # WebP from the in-repo MP4
#   scripts/build-demo.sh path/to/src.mov  # WebP from a custom source
#   FORMAT=apng scripts/build-demo.sh      # APNG instead of WebP
#   FORMAT=gif  scripts/build-demo.sh      # higher-quality GIF (per-frame palette)
#   FPS=30 WIDTH=1920 QUALITY=90 scripts/build-demo.sh
#
# Env knobs (with defaults):
#   FORMAT   webp | apng | gif        (default: webp)
#   FPS      frames per second        (default: 24)
#   WIDTH    output width in px       (default: 1760, i.e. 2x the 880px README display)
#   QUALITY  WebP lossy quality 0-100 (default: 85)
#
set -euo pipefail

SRC="${1:-docs/assets/demos/polymorph-demo.mp4}"
FORMAT="${FORMAT:-webp}"
FPS="${FPS:-24}"
WIDTH="${WIDTH:-1760}"
QUALITY="${QUALITY:-85}"
OUT_DIR="docs/assets/demos"

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$0")")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found. Install it (apt-get install -y ffmpeg) or run a" >&2
  echo "       Claude Code web session, where .claude/hooks/session-start.sh installs it." >&2
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "error: source video not found: $SRC" >&2
  exit 1
fi

# Even dimensions keep encoders happy; -2 lets ffmpeg pick a valid height.
SCALE="fps=${FPS},scale=${WIDTH}:-2:flags=lanczos"

case "$FORMAT" in
  webp)
    OUT="${OUT_DIR}/polymorph-demo.webp"
    echo "Encoding animated WebP -> ${OUT} (fps=${FPS}, width=${WIDTH}, quality=${QUALITY})"
    ffmpeg -y -i "$SRC" -vf "$SCALE" \
      -c:v libwebp_anim -lossless 0 -quality "$QUALITY" -compression_level 6 \
      -loop 0 -an "$OUT"
    ;;
  apng)
    OUT="${OUT_DIR}/polymorph-demo.apng"
    echo "Encoding APNG -> ${OUT} (fps=${FPS}, width=${WIDTH})"
    ffmpeg -y -i "$SRC" -vf "$SCALE" -plays 0 -an "$OUT"
    ;;
  gif)
    OUT="${OUT_DIR}/polymorph-demo-preview.gif"
    PALETTE_DIR="$(mktemp -d)"
    PALETTE="${PALETTE_DIR}/palette.png"
    trap 'rm -rf "$PALETTE_DIR"' EXIT
    echo "Encoding GIF (per-frame palette) -> ${OUT} (fps=${FPS}, width=${WIDTH})"
    ffmpeg -y -i "$SRC" -vf "${SCALE},palettegen=stats_mode=diff" "$PALETTE"
    ffmpeg -y -i "$SRC" -i "$PALETTE" -lavfi \
      "${SCALE}[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
      -loop 0 "$OUT"
    ;;
  *)
    echo "error: unknown FORMAT '$FORMAT' (expected webp | apng | gif)" >&2
    exit 1
    ;;
esac

SIZE_MB="$(du -m "$OUT" | cut -f1)"
echo "Done: ${OUT} (~${SIZE_MB} MB)"
echo "Preview a frame: ffmpeg -i \"$OUT\" -frames:v 1 /tmp/demo-frame.png"
