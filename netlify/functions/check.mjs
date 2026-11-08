// GET /api/check: the booth asks "is my key right, and will guests get an email?"
// before it opens, so a wrong link shows "booth locked" instead of failing later.

import { emailSendingOn, json, keyFrom, keyMatches } from "../lib/shared.mjs";

export default async (req) => {
  if (!keyMatches(keyFrom(req), "BOOTH_KEY")) return json({ ok: false }, 403);
  return json({ ok: true, emailSending: emailSendingOn() });
};

export const config = { path: "/api/check" };
