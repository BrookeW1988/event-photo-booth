---
name: photo-booth
description: Set up, customise, test and run this event photo booth. Use when the user says "set up my photo booth", "make it mine", "change the colours / words / logo / fonts", "make a new frame", "get Codex to draw a frame", "use my Canva design as a frame", "test the booth", "go live", "put it on Netlify", "turn on email", "what do I do on the day", "get my guest list", "make a GIF of the photos", "GIF of the night", "delete the photos", or asks how any part of this booth works.
---

# Photo booth

This folder is a complete iPad photo booth for events. Guests take 3 photos, pick a frame, and take them home with a QR code (or by email). There's also a live photo wall, an end-of-night slideshow and an admin page. It runs on Netlify's free plan.

The user is usually not technical. Do the work yourself, explain in plain English, and give them one next step at a time. Talk to them as "you". Keep replies short.

## What to change (and what to leave alone)

Customising only ever means these files:
- `public/booth.config.json`: event name, line 2, logo, colours, fonts, every word on screen, email text, wall and slideshow settings
- `public/frames/<name>/frame.json` + its art: one folder per frame
- `public/brand/logo.png`: their logo (a PNG with a see-through background is best)

Don't edit `netlify/`, `public/js/` or `public/css/` unless they ask for something the settings can't do. If they do, keep it small and tell them what you changed.

## Golden rules

1. **Keys stay in files.** BOOTH_KEY, ADMIN_KEY and RESEND_API_KEY live in `.env` (and in Netlify). Never print them in chat and never ask the user to paste them in chat. To give them their links, run `bash tools/links.sh` and tell them to open `my-links.md`.
2. **Test on the computer first, deploy rarely.** Netlify's free plan has 300 credits a month and every live deploy uses 15. When the credits run out, Netlify pauses the site until next month, which would kill the booth mid-event. Before every `npm run deploy:live`, say so and count it ("that's live deploy number 3 this month, 45 of your 300 credits"). Batch changes into one deploy.
3. **Codex draws, code writes.** Frame art never contains words. The event name, line 2 and logo are added by the booth, so they're always spelled right. Never put text in a frame brief.
4. **After any change, run `npm run check`** and fix what it reports before you say it's done.
5. **Guests' photos and emails are personal information.** Never post, upload or share them anywhere. After the event, remind the user they can download the guest list and delete everything from the admin page.

## First-time setup ("set up my photo booth")

1. Run `npm run setup` (installs, makes their two secret keys in `.env`).
2. Ask these in ONE message (offer to keep the defaults for anything they don't know yet):
   - the event name
   - line 2: usually the date and a hashtag, or their website
   - their logo (drag the file in), or none
   - 2–3 colours, or "match my logo"
   - should guests get their photos by email? (Needs a Resend account and their own domain. Fine to start with QR only and add email later.)
3. Fill in `public/booth.config.json`: `event`, `look.colours`, `look.fonts` (two Google Fonts that suit the vibe: a fun headings font and a clean body font), `slideshow.subtitle`, and any `words` in their voice. Copy the logo to `public/brand/logo.png` (if it's a JPG with a white box around it, tell them a see-through PNG looks better).
   - **No logo yet? Set `"logo": ""`.** The file in `public/brand/logo.png` is a "YOUR LOGO" placeholder: leave it in and every guest's photos say YOUR LOGO. With no logo, line 2 shows bigger instead.
4. Frames: show them the three starters (Disco, Garden party, Simple). Offer to make new ones to match the event (below). Take unused frames out of the `frames` list. One frame is fine: the booth then skips the "pick your frame" step.
   - **Re-colour every frame they keep** to their colours: `accent`, `title.colour`, `card.colour`, `card.textColour` (and `backgroundColour` for Simple, which is all colour). The starters come in hot pink.
5. `npm run check`, then start `npm run dev` in the background and run `bash tools/links.sh`. Tell them to open `my-links.md`:
   - **Frame preview** to see every frame with sample photos
   - **Booth** in Chrome on their laptop to try the whole thing with their webcam (allow the camera)
   - **Admin** to see the photo they just took
6. When they're happy, go live (below).

## Make a new frame with Codex ("make a frame", "new frame")

1. Get the look in a sentence ("pink and gold art deco", "beachy, shells and sunshine"). If they're stuck, offer 3 ideas that suit their event. Reference images are optional and help a lot: their invite, brand board, a Pinterest screenshot.
2. Pick a short name: lowercase, no spaces (`gold`, `beach-party`).
3. Run, with a 5-minute timeout:
   `bash tools/make-frame.sh <name> "<the look>" [reference images...]`
   It hands the brief in `prompts/frame-brief.md` to Codex (runs on their ChatGPT plan: no API key), saves `public/frames/<name>/background.jpg`, makes a `frame.json` and adds the frame to the config.
4. Open the image and check it: decoration around the edges and corners, calm middle, NO words or letters, no faces, no empty boxes. If one fails, run it once more with the problem named ("... no lettering anywhere").
5. Set the colours in `frame.json` to suit the art (see the frame settings table below). Pick `backgroundColour` from the art's main colour. Make `title.colour` contrast with the top of the art. Use a `title.plate` (a colour + `cc` for see-through) when the top is busy.
6. Tell them to refresh the frame preview, and ask what they'd change. Colour or border changes = edit `frame.json`. A different look = run make-frame again with a new description (it replaces the art and keeps their `frame.json`).

If `tools/make-frame.sh` can't find Codex: tell them to install the Codex app (developers.openai.com/codex/app), open it once and sign in with ChatGPT. On Windows, or if they'd rather, they can make the frame inside Codex itself (see `docs/FRAMES-WITH-CODEX.md`). If Codex says they've hit a usage limit, stop and tell them: image jobs use Codex limits faster than chats.

## Frames from Canva or a designer

- **Just a background:** a 1080 × 1920 PNG or JPG with decoration round the edges. Save it as `public/frames/<name>/background.jpg` and make a `frame.json` (copy one of the starters).
- **An exact design with photo holes:** they design on top of `docs/guides/feed-guide.png` (1080 × 1350) and `docs/guides/story-guide.png` (1080 × 1920), delete the guide layer, and export see-through PNGs. Save as `overlay-feed.png` and `overlay-story.png` in the frame folder, and set `"overlayFeed"` and `"overlayStory"` in `frame.json`. Overlays sit on top of everything, so the holes must line up with the grey boxes in the guides.

## Frame settings (frame.json)

| Setting | What it does |
|---|---|
| `label` | the name guests see in the frame picker |
| `accent` | the glow round the camera + picker highlight |
| `background` | the art file in this folder (blank = plain colour) |
| `backgroundStory` | optional different art for the story |
| `backgroundColour` | shows behind the art (and instead of it if there's none) |
| `photos.border` | `print` (white edge), `polaroid` (thick bottom), `thin`, `rounded`, `none` |
| `photos.colour` | border colour |
| `photos.tilt` | `true` = scrapbook tilt |
| `title.colour` | event name colour (and line 2 on the story) |
| `title.plate` | colour behind the words so they read on busy art, e.g. `#ffffffcc`; `""` = none |
| `card.colour` / `card.textColour` | the 4th square on the feed post (logo + line 2) |
| `overlayFeed` / `overlayStory` | optional see-through PNGs drawn on top (Canva route) |

Colours are hex codes. 8 digits = with see-through: the last two digits are how solid (`cc` ≈ 80%, `99` ≈ 60%).

## Go live (Netlify)

1. They need a free Netlify account (netlify.com, sign up with email or Google).
2. `npx -y netlify-cli@27.14.2 login` (opens their browser to say yes).
3. `npx -y netlify-cli@27.14.2 sites:create --name <event-name>-booth` (lowercase, dashes; if the name's taken, add a number). This links the folder to the new site.
4. `npx -y netlify-cli@27.14.2 env:import .env` (copies their keys to Netlify without showing them).
5. `npm run check`, then `npm run deploy:live` (live deploy: tell them, count it). It prints the live address.
6. `bash tools/links.sh https://<their-site>.netlify.app` and tell them to open `my-links.md`.
7. Test on the real iPad: open the live admin page on their laptop and scan the QR code on it with the iPad's camera. That opens the booth with the key in the link. Take a test photo, check it on the admin page, then delete it.

Changing settings or frames after going live needs another live deploy. Changing keys in `.env` needs `env:import` again AND a deploy.

## Turn on email (optional)

1. Free Resend account (resend.com). The free plan sends up to 100 emails a day: at a bigger event, emails stop for the day after about 100 photos, but the QR code keeps working. For a big event, Resend Pro is US$20 for the month.
2. In Resend, add their domain and add the DNS records it shows at wherever their domain lives (walk them through it one record at a time, using their domain host's screens). Wait for "Verified".
3. Create an API key with sending access. They paste it into `.env` themselves as `RESEND_API_KEY=`, and add `EMAIL_FROM=Photo Booth <photos@theirdomain.com>`. Not in the chat.
4. Test on the computer: take a photo and enter their own email.
5. Live: `env:import .env`, then a live deploy.

## The day of the event

Point them to `docs/ON-THE-DAY.md`. The short version: iPad on charge in a stand, Auto-Lock set to Never, Guided Access on, good light on faces, wall and slideshow links open on the screens, and one test photo before doors open.

## Make a GIF of the night ("make a GIF", "GIF of the photos")

It's a button on the admin page, made in their browser, nothing to install. Tell them:
1. Open the admin link from `my-links.md` (the live one after the event) and scroll to **Make a GIF of the night**.
2. Pick **Plain photos** (one per group, flipbook style) or **Framed posts** (shows off the frames). Default is the newest 30 photos.
3. Change the words if they like: **Window title** (the file name on the little window), **Bottom left** and **Bottom right**. It uses their booth colours automatically.
4. **Make my GIF**, then **Download GIF**. Under 5 MB suits emails; if it's bigger, use fewer photos.

Remind them: only post it publicly if their guests are happy with that (the start screen only says photos may show on the big screen; change `booth.privacyNote` before the event if they plan to share online). Make the GIF BEFORE "Delete everything". To change the GIF's look beyond the colours and words (size, fonts, layout), edit `public/js/gif.js` and test with a couple of photos locally.

## After the event

Admin page: **Download guest list (CSV)**. Only email people marked "said yes to updates". The rest only gave their email to get their photos. Make the GIF of the night if they want one, then **Delete everything** when they're ready.

## Troubleshooting

| What they see | What to do |
|---|---|
| "Booth locked" | the link is missing the key or it's the wrong one. Run `tools/links.sh` and use the booth link from `my-links.md` |
| Camera won't start | on iPad: Settings → Apps → Safari → Camera → Allow, then reload. On a laptop: allow the camera in the address bar |
| Booth works on the laptop but not live | they forgot `env:import .env` before deploying. Import, then deploy |
| Frame missing from the picker | it's not in the `frames` list, or its `frame.json` is broken: run `npm run check` |
| Words in the wrong font | the font name doesn't match Google Fonts exactly (check fonts.google.com) |
| Netlify says the site isn't available | out of credits for the month. Upgrade the plan or wait for the reset. This is why we deploy rarely |
