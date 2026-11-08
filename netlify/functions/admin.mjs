// /api/admin: everything the admin page does. Needs the ADMIN key (not the booth
// key), so a volunteer running the iPad can't see guests' emails.
//
//   GET  ?action=list    every session + the guest's email, newest first
//   GET  ?action=csv     the guest list as a spreadsheet file
//   POST {action:"delete", token}                     remove one session
//   POST {action:"delete-all", confirm:"DELETE"}      remove everything (after the event)

import {
  deleteSession,
  env,
  json,
  keyFrom,
  keyMatches,
  listSessions,
  store,
  TOKEN_RE,
} from "../lib/shared.mjs";

export default async (req) => {
  if (!keyMatches(keyFrom(req), "ADMIN_KEY")) return json({ error: "admin key invalid" }, 403);
  const site = new URL(req.url).origin;

  if (req.method === "GET") {
    const action = new URL(req.url).searchParams.get("action") ?? "list";
    const sessions = await withGuests(await listSessions());
    if (action === "csv") return csv(sessions, site);
    // The booth key comes back too, so the admin page can show your booth links.
    return json({ sessions, boothKey: env("BOOTH_KEY") });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad request" }, 400);
    }
    if (body.action === "delete") {
      if (!TOKEN_RE.test(body.token ?? "")) return json({ error: "bad token" }, 400);
      await deleteSession(body.token);
      return json({ ok: true });
    }
    if (body.action === "delete-all") {
      if (body.confirm !== "DELETE") return json({ error: "type DELETE to confirm" }, 400);
      const sessions = await listSessions();
      for (let i = 0; i < sessions.length; i += 20) {
        await Promise.all(sessions.slice(i, i + 20).map((s) => deleteSession(s.token)));
      }
      // Clear any guest files whose photos were already gone.
      const { blobs } = await store().list({ prefix: "guests/" });
      await Promise.all(blobs.map((b) => store().delete(b.key)));
      return json({ ok: true, deleted: sessions.length });
    }
    return json({ error: "unknown action" }, 400);
  }

  return json({ error: "method not allowed" }, 405);
};

/** Add each session's guest details (email, opt-in), 20 at a time. */
async function withGuests(sessions) {
  const s = store();
  const out = [];
  for (let i = 0; i < sessions.length; i += 20) {
    const batch = sessions.slice(i, i + 20);
    const guests = await Promise.all(batch.map((x) => s.get(`guests/${x.token}.json`, { type: "json" })));
    batch.forEach((x, j) => out.push({ ...x, email: guests[j]?.email ?? "", optIn: Boolean(guests[j]?.optIn) }));
  }
  return out;
}

function csv(sessions, site) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["taken_at_utc", "email", "opted_in_to_updates", "photo_page"]];
  for (const s of sessions) rows.push([s.takenAt, s.email, s.optIn ? "yes" : "no", `${site}/p/${s.token}`]);
  return new Response(rows.map((r) => r.map(cell).join(",")).join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="photo-booth-guests.csv"',
      "cache-control": "no-store",
    },
  });
}

export const config = { path: "/api/admin" };
