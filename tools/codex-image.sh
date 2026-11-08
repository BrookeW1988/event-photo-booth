#!/bin/bash
# codex-image.sh: lets Claude Code hand an image job to Codex.
#
# Claude Code can't make images. Codex can, and Codex image generation is included in your
# ChatGPT plan (it comes out of your Codex usage limits, so no API key and no pay-per-image).
# This script is the bridge: Claude runs it, Codex draws the image, the file lands where you asked.
#
# Usage:
#   bash codex-image.sh <where-to-save.png> "<what you want>" [reference images...]
#
# Examples:
#   bash codex-image.sh images/hero.png "A cosy flat-lay of a laptop, coffee and a planner, soft pink tones"
#   bash codex-image.sh images/wave.png "The same character waving hello" my-character.png
#
# Reference images are optional. Pass them when you want Codex to keep a character, product or
# style the same across images, instead of redesigning it every time.

out="$1"
prompt="$2"
if [ -z "$out" ] || [ -z "$prompt" ]; then
  echo 'Usage: bash codex-image.sh <where-to-save.png> "<what you want>" [reference images...]'
  exit 1
fi
shift 2

# 1. Find Codex. The Codex desktop app (and the ChatGPT desktop app) ship their own copy of the
#    Codex command line inside the app, already signed in with your ChatGPT account.
#    The app copies come first because an old `codex` installed separately can be out of date.
CODEX=""
for c in "$CODEX_BIN" \
         /Applications/Codex.app/Contents/Resources/codex-cli/bin/codex \
         /Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex \
         "$(command -v codex)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CODEX="$c"; break; fi
done
if [ -z "$CODEX" ]; then
  echo "Can't find Codex. Install the Codex desktop app, open it once and sign in with ChatGPT."
  exit 1
fi

# 2. Give Codex its own empty folder, so it can only write there and can't touch your project.
work=$(mktemp -d)

# 3. Reference images need full paths, because Codex works from that other folder.
refs=()
for r in "$@"; do
  if [ ! -f "$r" ]; then echo "Reference image not found: $r"; exit 1; fi
  refs+=(-i "$(cd "$(dirname "$r")" && pwd)/$(basename "$r")")
done

# 4. The brief for Codex. "Use your built-in image generation tool" is what stops it writing code instead.
{
  echo "Use your built-in image generation tool to make exactly ONE image and save it in this folder as image.png."
  echo "Do nothing else: no code, no other files."
  if [ ${#refs[@]} -gt 0 ]; then
    echo "The attached image(s) are references. Keep what's in them the same (characters, products, style) rather than redesigning them."
  fi
  echo
  echo "What to make: $prompt"
} > "$work/PROMPT.md"

echo "Codex is drawing (usually about a minute)..."
"$CODEX" exec --sandbox workspace-write --skip-git-repo-check -C "$work" "${refs[@]}" - < "$work/PROMPT.md" > "$work/codex.log" 2>&1

# 5. Move the finished image to where you asked for it. (If Codex used a different name or
#    format, take the newest image it made.)
made=$(ls -t "$work"/*.png "$work"/*.jpg "$work"/*.jpeg "$work"/*.webp 2>/dev/null | head -n 1)
if [ -z "$made" ]; then
  echo "Codex didn't make an image. The last thing it said:"
  tail -n 20 "$work/codex.log"
  exit 1
fi
mkdir -p "$(dirname "$out")"
mv "$made" "$out"
rm -rf "$work"
echo "Saved: $out"
