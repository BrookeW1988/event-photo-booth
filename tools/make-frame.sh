#!/bin/bash
# make-frame.sh: get Codex to draw the background art for a new booth frame.
#
#   bash tools/make-frame.sh <frame-name> "<the look you want>" [reference images...]
#
# Examples:
#   bash tools/make-frame.sh garden "soft watercolour florals, blush pink and sage green"
#   bash tools/make-frame.sh gold "black and gold art deco, like a 1920s party" invite.png
#
# What it does:
#   1. writes the brief (the rules are in prompts/frame-brief.md: decoration round
#      the edges, calm middle, no words) and hands it to Codex
#   2. saves the art as public/frames/<frame-name>/background.jpg
#   3. makes a frame.json for it (if there isn't one) and adds it to booth.config.json
# Then open /preview?frame=<frame-name> to see it with sample photos.
#
# Runs on your ChatGPT plan through the Codex app: no API key, no pay-per-image.

cd "$(dirname "$0")/.." || exit 1
id="$1"
vibe="$2"
if [ -z "$id" ] || [ -z "$vibe" ]; then
  echo 'Usage: bash tools/make-frame.sh <frame-name> "<the look you want>" [reference images...]'
  exit 1
fi
shift 2
if ! [[ "$id" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]]; then
  echo "Frame names are lowercase letters, numbers and dashes only (like garden or gold-party)."
  exit 1
fi

dir="public/frames/$id"
mkdir -p "$dir"
# Drop the look into the brief. (Done in Node, not sed, so characters like & or / are safe.)
brief=$(node -e 'process.stdout.write(require("fs").readFileSync("prompts/frame-brief.md","utf8").replace("{{VIBE}}", process.argv[1]))' "$vibe")

bash tools/codex-image.sh "$dir/background.png" "$brief" "$@" || exit 1

# Shrink it to a JPEG: much faster to load on venue wi-fi. (sips comes with every Mac.)
if command -v sips >/dev/null 2>&1; then
  # Only ever shrink (never stretch) to 1920px tall: that's the story's full height.
  tall=$(sips -g pixelHeight "$dir/background.png" | awk '/pixelHeight/ {print $2}')
  shrink=(); [ "${tall:-0}" -gt 1920 ] && shrink=(-Z 1920)
  sips -s format jpeg -s formatOptions 82 "${shrink[@]}" "$dir/background.png" --out "$dir/background.jpg" >/dev/null && rm "$dir/background.png"
  art="background.jpg"
else
  art="background.png"
fi

# A starter frame.json (only if this frame doesn't have one yet: never overwrites your tweaks).
if [ ! -f "$dir/frame.json" ]; then
  cat > "$dir/frame.json" <<JSON
{
  "label": "$id",
  "accent": "#ff4fa3",
  "background": "$art",
  "backgroundColour": "#ffffff",
  "photos": { "border": "print", "colour": "#ffffff", "tilt": false },
  "title": { "colour": "#222222", "plate": "#ffffffcc" },
  "card": { "colour": "#ffffffee", "textColour": "#222222" }
}
JSON
fi

# Add it to the list of frames in booth.config.json (if it's not there already).
node -e '
const fs = require("fs");
const file = "public/booth.config.json";
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
cfg.frames = cfg.frames || [];
if (!cfg.frames.includes(process.argv[1])) {
  cfg.frames.push(process.argv[1]);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log("Added \"" + process.argv[1] + "\" to the frames list in booth.config.json");
}' "$id"

echo
echo "Done: $dir/$art"
echo "Next: look at it on http://localhost:8888/preview?frame=$id (run 'npm run dev' first),"
echo "then set the colours in $dir/frame.json so the words and borders suit the art."
