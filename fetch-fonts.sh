#!/bin/bash
# Fetch the Neon Bars skin fonts from Google Fonts into ./fonts (woff2, subset where possible).
# All four families are SIL Open Font License 1.1. Run once; the files are then served locally.
set -e
cd "$(dirname "$0")"
mkdir -p fonts
UA="Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
JP="左右低音電脳薬酒ラーメンホテル寿司ネオン・·ドリームオフワールドベイビー0123456789"
CAPS="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .·-+%:/"

fetch() {  # fetch NAME "FAMILY_QUERY" [TEXT]
  local name=$1 q=$2 text=$3 url css
  url="https://fonts.googleapis.com/css2?family=${q}&display=swap"
  [[ -n "$text" ]] && url="${url}&text=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$text")"
  css=$(curl -fsSL -A "$UA" "$url")
  # Google serves one variable-weight file covering all requested weights, so keep the first
  # face (the latin block when the API returns several subsets)
  python3 - "$name" <<EOF
import re, subprocess, sys
css = """$css"""
name = sys.argv[1]
faces = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*{([^}]*)}", css) or [("all", b) for b in re.findall(r"@font-face\s*{([^}]*)}", css)]
body = next(b for s, b in faces if s in ("all", "latin"))
src = re.search(r"url\((https://[^)]+)\)\s*format\('woff2'\)", body).group(1)
out = f"fonts/{name}.woff2"
subprocess.run(["curl", "-fsSL", "-o", out, src], check=True)
print(out)
EOF
}

fetch TiltNeon     "Tilt+Neon"                  "DONKEY"
fetch Orbitron     "Orbitron:wght@500;700"      "$CAPS"
fetch ShareTechMono "Share+Tech+Mono"
fetch NotoSansJP   "Noto+Sans+JP:wght@500;700"  "$JP"

curl -fsSL -o fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/orbitron/OFL.txt
ls -l fonts
