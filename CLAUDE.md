# Event photo booth

An iPad photo booth for events: plain HTML + JavaScript in `public/`, a few small server functions in `netlify/functions/`, hosted on Netlify's free plan. No database: photos are stored in Netlify Blobs.

**For anything to do with this booth, use the `photo-booth` skill** (`.claude/skills/photo-booth/SKILL.md`). It covers setup, customising, frames, going live, email, the day itself and after.

The user is usually not technical: do the work, explain in plain English, one step at a time.

Non-negotiables:
- Never print or ask for keys in chat. Keys live in `.env` and in Netlify. Use `bash tools/links.sh` → `my-links.md` for links.
- Customising = `public/booth.config.json`, `public/frames/*`, `public/brand/logo.png`. Leave the code alone unless asked.
- Every `npm run deploy:live` uses 15 of the 300 free Netlify credits a month. Test with `npm run dev` first and say so before each live deploy.
- Frame art never contains words (the booth writes them). Frame art comes from Codex via `bash tools/make-frame.sh`.
- Run `npm run check` after changes.
