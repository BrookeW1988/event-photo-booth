// POST /api/upload: the booth sends a finished session here.
//
// Form fields: feed, story (the two framed photos), raw (the 3 unframed shots,
// optional), frame, email (optional), optIn ("true"/"false").
// Saves the photos, emails the guest if email sending is set up, and returns
// the token their QR code points to.

import {
  boothConfig,
  emailSendingOn,
  env,
  json,
  keyFrom,
  keyMatches,
  newToken,
  store,
} from "../lib/shared.mjs";

// A framed JPEG is usually 300-600 KB. Anything far bigger isn't a booth photo.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "that upload didn't come through properly" }, 400);
  }

  if (!keyMatches(keyFrom(req, form), "BOOTH_KEY")) {
    return json({ error: "booth key invalid" }, 403);
  }

  const feed = form.get("feed");
  const story = form.get("story");
  const raw = form.get("raw");
  for (const file of [feed, story]) {
    if (!(file instanceof Blob) || file.size === 0) return json({ error: "missing photos" }, 400);
    if (file.size > MAX_PHOTO_BYTES) return json({ error: "photo too large" }, 413);
  }
  const hasRaw = raw instanceof Blob && raw.size > 0 && raw.size <= MAX_PHOTO_BYTES;

  const frame = String(form.get("frame") ?? "").slice(0, 40);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (email && !EMAIL_RE.test(email)) return json({ error: "bad email" }, 400);
  const optIn = form.get("optIn") === "true";

  const token = newToken();
  const takenAt = new Date().toISOString();
  const s = store();
  try {
    await Promise.all([
      s.set(`photos/${token}/feed.jpg`, feed, { metadata: { frame, takenAt } }),
      s.set(`photos/${token}/story.jpg`, story),
      hasRaw ? s.set(`photos/${token}/raw.jpg`, raw) : null,
      // Guest details go in a separate file only the admin page can read.
      email ? s.setJSON(`guests/${token}.json`, { email, optIn, frame, takenAt }) : null,
    ]);
  } catch (err) {
    console.error("[upload] saving failed:", err);
    return json({ error: "couldn't save the photos, try again" }, 500);
  }

  // The email is a bonus: if it fails, the guest still has the QR code.
  let emailSent = false;
  if (email && emailSendingOn()) {
    const site = new URL(req.url).origin;
    emailSent = await sendPhotoEmail({ to: email, site, token });
  }

  return json({ token, emailSent });
};

async function sendPhotoEmail({ to, site, token }) {
  const words = boothConfig.email ?? {};
  const event = boothConfig.event ?? {};
  const colours = boothConfig.look?.colours ?? {};
  const page = `${site}/p/${token}`;
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Plain, sturdy HTML: email apps are fussy, so no fancy layout.
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#222;">
<tr><td style="padding:28px 28px 8px;text-align:center;">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#888;">${esc(event.name)}</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;">${esc(words.heading)}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#444;">${esc(words.message)}</p>
</td></tr>
<tr><td style="padding:0 28px;"><a href="${page}"><img src="${site}/img/${token}/feed.jpg" width="504" alt="Your photo booth photos" style="display:block;width:100%;height:auto;border-radius:12px;"></a></td></tr>
<tr><td style="padding:24px 28px 32px;text-align:center;">
<a href="${page}" style="display:inline-block;background:${esc(colours.button || "#222222")};color:${esc(colours.buttonText || "#ffffff")};text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;">${esc(words.buttonText)}</a>
</td></tr>
</table></td></tr></table></body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject: words.subject, html }),
    });
    if (!res.ok) console.error("[upload] email rejected:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[upload] email failed:", err);
    return false;
  }
}

export const config = { path: "/api/upload" };
