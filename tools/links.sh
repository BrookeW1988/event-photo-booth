#!/bin/bash
# Writes my-links.md: your booth, wall, slideshow and admin links, with your keys in them.
# The file stays on your computer (it's in .gitignore), so your keys never go in a chat.
#
#   bash tools/links.sh                                  links for testing on this computer
#   bash tools/links.sh https://your-booth.netlify.app   adds your live links (remembered)
cd "$(dirname "$0")/.." || exit 1
[ -f .env ] || { echo "No .env yet: run 'npm run setup' first."; exit 1; }
get() { grep "^$1=" .env | head -n 1 | cut -d= -f2-; }

# Remember the live address in .env so the next run still includes it.
if [ -n "$1" ]; then
  live="${1%/}"
  if grep -q '^SITE_URL=' .env; then
    sed -i.bak "s#^SITE_URL=.*#SITE_URL=$live#" .env && rm -f .env.bak
  else
    echo "SITE_URL=$live" >> .env
  fi
fi
live=$(get SITE_URL)
booth=$(get BOOTH_KEY)
admin=$(get ADMIN_KEY)

{
  echo "# My photo booth links"
  echo
  echo "Private: anyone with these links can see the photos. Don't share the admin link at all."
  for base in $live http://localhost:8888; do
    echo
    if [ "$base" = "http://localhost:8888" ]; then
      echo "## Testing on this computer (run \`npm run dev\` first)"
    else
      echo "## Live"
    fi
    echo
    echo "- Admin (you only): $base/admin#key=$admin"
    echo "- Booth (the iPad): $base/booth#key=$booth"
    echo "- Photo wall (a TV): $base/wall#key=$booth"
    echo "- Slideshow (the projector, at the end): $base/slideshow#key=$booth"
    echo "- Frame preview: $base/preview"
  done
} > my-links.md
echo "Saved your links in my-links.md (open it from the file list)."
