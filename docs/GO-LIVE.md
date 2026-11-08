# Go live

**The fastest way:** say **"Put my booth live"** and Claude runs every step, stopping when it needs you to click something.

Here's what happens, so you know what you're agreeing to.

## 1. Try it on your computer first

Run `npm run dev` (or ask Claude to start it), then open your **links file** (`my-links.md`, which Claude makes with `bash tools/links.sh`):
- **Frame preview**: every frame with sample photos
- **Booth**: open it in Chrome and allow the camera. Take a photo with your webcam
- **Admin**: your photo is there

Get everything how you want it here. Changes on your computer are free and instant.

## 2. Put it on Netlify

1. Make a free account at netlify.com.
2. Claude runs these (or you can):

```bash
npx -y netlify-cli@27.14.2 login                              # opens your browser: click Authorize
npx -y netlify-cli@27.14.2 sites:create --name my-event-booth # your booth gets my-event-booth.netlify.app
npx -y netlify-cli@27.14.2 env:import .env                    # copies your secret keys to Netlify
npm run deploy:live                                            # puts it live
bash tools/links.sh https://my-event-booth.netlify.app         # adds your live links to my-links.md
```

3. On the iPad: open the live **admin** link on your laptop and scan the QR code on it with the iPad's camera. That opens the booth with your key built in. Take a test photo, check it on the admin page, then delete it.

## About Netlify's free plan

- You get **300 credits a month**. Putting a new version live uses **15**. A normal event's photos and visits use a handful.
- If you run out, Netlify **pauses your site** until next month. That's why you test on your computer and only go live when you're happy. Claude counts your live deploys for you.
- The free plan allows business use, so running it for your own events or a client's is fine.
- After you've gone live, any change to settings or frames needs another live deploy. Group your changes.

## Turn on email (optional)

Guests always get the QR code. Email is a bonus: their photos land in their inbox, and the "keep me posted" box grows your list.

1. Make a free account at **resend.com**.
2. Add your domain in Resend (Domains → Add domain). It shows a few DNS records. Add them wherever your domain lives (GoDaddy, Squarespace, Cloudflare...). Claude can walk you through your host's screens. Wait for **Verified**.
3. Make an API key (API Keys → Create, sending access).
4. Open the `.env` file in your booth folder and fill in:

```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Photo Booth <photos@yourdomain.com>
```

   Paste the key into the file yourself, not into a chat.
5. Test on your computer: take a photo and enter your own email.
6. Then `npx -y netlify-cli@27.14.2 env:import .env` and `npm run deploy:live`.

Resend's free plan sends **100 emails a day**. At a bigger event, emails stop for the day after about 100 photos, and guests still get the QR code. If you expect more, Resend Pro is US$20 for the month.

## Keys, in plain English

- **BOOTH_KEY** opens the booth, the wall and the slideshow. It's built into those links.
- **ADMIN_KEY** opens the admin page, with guests' emails. Keep it to yourself.
- They live in `.env` on your computer and in Netlify. Never in a chat, an email or GitHub. `.env` is set to never upload.
- Think a key got out? Delete that line from `.env`, run `npm run setup` (it makes a new one), then `env:import` and deploy again. Old links stop working.
