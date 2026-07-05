#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
FF="${FFMPEG:-/c/ffmpeg/bin/ffmpeg}"
SRC="authoring-ui/test-results/gifsrc"
OUT="docs/demo"
mkdir -p "$OUT"
shopt -s nullglob
for webm in "$SRC"/*.webm; do
  base=$(basename "$webm" .webm)
  pal="$SRC/$base.png"
  # 03-failsafe: full arc; tune fps/scale to ≲5 MB — NO time-trim (keeps the "not fired" highlight outro).
  if [[ "$base" == "03-failsafe" ]]; then
    "$FF" -y -i "$webm" -vf "fps=10,scale=800:-1:flags=lanczos,palettegen" "$pal"
    "$FF" -y -i "$webm" -i "$pal" -lavfi "fps=10,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse" "$OUT/$base.gif"
  # 02-run: keep the FULL journey to completion (Done + applyPLC DONE).
  # Hit the ≲1.8 MB target via fps/scale only — NO time-trim (a -t cut truncated the payoff).
  elif [[ "$base" == "02-run" ]]; then
    "$FF" -y -i "$webm" -vf "fps=7,scale=720:-1:flags=lanczos,palettegen" "$pal"
    "$FF" -y -i "$webm" -i "$pal" -lavfi "fps=7,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse" "$OUT/$base.gif"
  # 05-engine-neutral: full ~20s arc with intro/outro cards — tune like the hero, NO time-trim (keeps the outro).
  elif [[ "$base" == "05-engine-neutral" ]]; then
    "$FF" -y -i "$webm" -vf "fps=10,scale=800:-1:flags=lanczos,palettegen" "$pal"
    "$FF" -y -i "$webm" -i "$pal" -lavfi "fps=10,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse" "$OUT/$base.gif"
  else
    "$FF" -y -i "$webm" -vf "fps=12,scale=960:-1:flags=lanczos,palettegen" "$pal"
    "$FF" -y -i "$webm" -i "$pal" -lavfi "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse" "$OUT/$base.gif"
  fi
  echo "[gifs] $OUT/$base.gif"
done
