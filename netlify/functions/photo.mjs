// GET /img/<token>/feed.jpg | story.jpg | raw.jpg: serves a saved photo.
// The token is long and random, so only people with the link (the guest, and
// the big screens) can see a photo. Add ?download=1 to save it as a file.

import { TOKEN_RE, store } from "../lib/shared.mjs";

const FILES = new Set(["feed.jpg", "story.jpg", "raw.jpg"]);

export default async (req, context) => {
  const { token, file } = context.params;
  if (!TOKEN_RE.test(token ?? "") || !FILES.has(file)) return new Response("Not found", { status: 404 });

  const photo = await store().get(`photos/${token}/${file}`, { type: "arrayBuffer" });
  if (!photo) return new Response("Not found", { status: 404 });

  const headers = {
    "content-type": "image/jpeg",
    // Phones and screens keep a copy for an hour. Netlify's servers keep one for
    // 10 minutes, so a photo you delete is gone everywhere within about 10 minutes.
    "cache-control": "public, max-age=3600",
    "netlify-cdn-cache-control": "public, max-age=600",
  };
  if (new URL(req.url).searchParams.has("download")) {
    headers["content-disposition"] = `attachment; filename="photo-booth-${file}"`;
  }
  return new Response(photo, { headers });
};

export const config = { path: "/img/:token/:file" };
