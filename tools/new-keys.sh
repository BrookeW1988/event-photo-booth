#!/bin/bash
# Makes your two secret keys and saves them in .env (only if you don't have them yet).
# BOOTH_KEY unlocks the booth + big screens. ADMIN_KEY unlocks the admin page.
cd "$(dirname "$0")/.." || exit 1
[ -f .env ] || cp .env.example .env
for name in BOOTH_KEY ADMIN_KEY; do
  if grep -q "^$name=.\+" .env; then
    echo "$name: already set, leaving it alone"
  else
    key=$(openssl rand -hex 12)
    # Replace the empty line if it's there, otherwise add one.
    if grep -q "^$name=" .env; then
      sed -i.bak "s/^$name=.*/$name=$key/" .env && rm -f .env.bak
    else
      echo "$name=$key" >> .env
    fi
    echo "$name: made a new one"
  fi
done
echo "Saved in .env (that file stays on your computer)."
