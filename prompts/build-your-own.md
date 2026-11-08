# Build your own booth (the outcome prompt)

Rather build a booth around the tools you already use (your own website host, your email platform, your brand system) than install this one as it is? Paste this into Claude Code, fill in the brackets, and let it build.

---

I want an iPad photo booth web app for my event, [EVENT NAME] on [DATE], for about [NUMBER] guests.

What it needs to do:
- Guests tap to start, pick a frame, then a countdown takes 3 photos in a row.
- It combines them into two images: a 1080 × 1350 Instagram post and a 1080 × 1920 story, with my event name, date and logo drawn on by code (never by AI, so the words are always spelled right).
- Guests preview both, can swap frames or retake, then get a QR code to download their photos on their phone. [Optional: and an email with their photos, plus an unticked "keep me posted" box.]
- A big-screen photo wall that updates by itself during the event, and an end-of-night slideshow of every photo.
- An admin page only I can open: every photo, a delete button, a guest-list download, and a "delete everything" button for after the event.
- It must survive a long day on venue wi-fi: keep the camera on, go back to the start after a minute of no touches, and never lose photos if an upload fails (retry, then let the guest tap again).

My setup:
- Hosting: [Netlify / Vercel / my own host]. Check its free plan allows business use and how many uploads and deploys it allows a month before you pick storage.
- Email: [none / Resend / my email platform's transactional email].
- My brand: [colours, fonts, logo file].
- Frame art: use Codex (on my ChatGPT plan) to draw background art with decoration round the edges, a calm middle and no words.

Keep all my settings (words, colours, fonts, frames) in one file I can edit. Keep my keys in a .env file, never in the chat. Explain each step in plain English, and test it with a fake camera before you tell me it's done.
