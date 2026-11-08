// GET /api/wall: the list of sessions for the big screens (photo wall + slideshow).
// Needs the booth key, so guests' photos only show on screens you set up.

import { json, keyFrom, keyMatches, listSessions } from "../lib/shared.mjs";

export default async (req) => {
  const key = keyFrom(req);
  if (!keyMatches(key, "BOOTH_KEY") && !keyMatches(key, "ADMIN_KEY")) {
    return json({ error: "key invalid" }, 403);
  }
  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.trunc(limitParam), 1000) : 60;
  try {
    const sessions = await listSessions();
    return json({ sessions: sessions.slice(0, limit), total: sessions.length });
  } catch (err) {
    console.error("[wall] list failed:", err);
    return json({ error: "couldn't load photos" }, 500);
  }
};

export const config = { path: "/api/wall" };
