// Shared helpers for the booth's server functions (netlify/functions/*).
//
// Storage is Netlify Blobs: it comes free with every Netlify site, so there's
// no database to set up. Everything lives in one store called "photo-booth":
//   photos/<token>/feed.jpg    the framed Instagram post (1080x1350)
//   photos/<token>/story.jpg   the framed story (1080x1920)
//   photos/<token>/raw.jpg     the 3 unframed shots side by side (for the big screens)
//   guests/<token>.json        the guest's email + opt-in (only the admin page sees this)

import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import boothConfig from "../../public/booth.config.json" with { type: "json" };

export { boothConfig };

// "strong" = a photo is on the wall the moment it's saved, not up to 60s later.
export const store = () => getStore({ name: "photo-booth", consistency: "strong" });

/** Read a setting from Netlify's environment variables (or .env when testing locally). */
export function env(name) {
  const fromNetlify = globalThis.Netlify?.env?.get?.(name);
  return String(fromNetlify ?? process.env[name] ?? "").trim();
}

/** Does the key sent by the page match the secret key in the environment? */
export function keyMatches(given, envName) {
  const expected = env(envName);
  // A missing or too-short key in the environment locks everything, on purpose.
  if (expected.length < 8 || typeof given !== "string" || !given) return false;
  // Compare hashes so the check takes the same time whether it's close or not.
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** The key the page sent: in a header (preferred) or a form field. */
export function keyFrom(req, form) {
  return req.headers.get("x-booth-key") ?? (form ? form.get("key") : null);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// A session token: time first (so sorting the names puts newest last), then
// 16 random characters (so nobody can guess someone else's photo link).
export const TOKEN_RE = /^\d{14}-[A-Za-z0-9_-]{16}$/;

export function newToken() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14); // YYYYMMDDHHmmss (UTC)
  return `${stamp}-${randomBytes(12).toString("base64url")}`;
}

/** Turn a token back into the time the photo was taken. */
export function tokenTime(token) {
  const s = token.slice(0, 14);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

/** Every booth session, newest first: [{ token, takenAt, hasRaw }]. */
export async function listSessions() {
  const { blobs } = await store().list({ prefix: "photos/" });
  const sessions = new Map();
  for (const { key } of blobs) {
    const [, token, file] = key.split("/");
    if (!TOKEN_RE.test(token ?? "")) continue;
    const s = sessions.get(token) ?? { token, takenAt: tokenTime(token), hasFeed: false, hasRaw: false };
    if (file === "feed.jpg") s.hasFeed = true;
    if (file === "raw.jpg") s.hasRaw = true;
    sessions.set(token, s);
  }
  return [...sessions.values()]
    .filter((s) => s.hasFeed)
    .sort((a, b) => (a.token < b.token ? 1 : -1))
    .map(({ token, takenAt, hasRaw }) => ({ token, takenAt, hasRaw }));
}

/** Delete one session: its photos and the guest's details. */
export async function deleteSession(token) {
  const s = store();
  await Promise.all([
    s.delete(`photos/${token}/feed.jpg`),
    s.delete(`photos/${token}/story.jpg`),
    s.delete(`photos/${token}/raw.jpg`),
    s.delete(`guests/${token}.json`),
  ]);
}

export const emailSendingOn = () => Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));
