# Event photo booth (instructions for Codex)

An iPad photo booth for events: plain HTML + JavaScript in `public/`, small server functions in `netlify/functions/`, hosted on Netlify's free plan, photos stored in Netlify Blobs. The full playbook (setup, customising, going live, email, the day, after) is in `.claude/skills/photo-booth/SKILL.md`. Read it and follow it, whichever AI you are.

The user is usually not technical: do the work, explain in plain English, one step at a time.

## Making a frame (you can draw these yourself)

When the user asks for a new frame:
1. Get the look in a sentence, and a short lowercase name for the frame (e.g. `gold`, `beach-party`).
2. Read `prompts/frame-brief.md`, put the look where it says `{{VIBE}}`, and use your built-in image generation tool to make ONE portrait image (2:3) from that brief. If the user gives reference images (an invite, a logo, a brand board), use them to match the colours and style.
3. Save it as `public/frames/<name>/background.png` (or .jpg). Under 1.5 MB is best for venue wi-fi.
4. Check it: decoration round the edges and corners, calm middle, NO words or letters, no faces, no empty boxes. If it fails one, make it again with the problem named.
5. Make `public/frames/<name>/frame.json` (copy `public/frames/garden/frame.json`), set `background` to the file name and set the colours to suit the art.
6. Add the name to the `frames` list in `public/booth.config.json`, run `npm run check`, and tell the user to look at `/preview?frame=<name>` (with `npm run dev` running).

## Non-negotiables

- Never print or ask for keys in chat. Keys live in `.env` and in Netlify. Use `bash tools/links.sh` → `my-links.md` for links.
- Customising = `public/booth.config.json`, `public/frames/*`, `public/brand/logo.png`. Leave the code alone unless asked.
- Every `npm run deploy:live` uses 15 of the 300 free Netlify credits a month. Test with `npm run dev` first and say so before each live deploy.
- Frame art never contains words: the booth writes the event name, line 2 and logo itself.
