// Your admin page (/admin#key=YOUR_ADMIN_KEY): your booth links, every photo,
// guests' emails, the guest list download, and delete buttons.

import { applyLook, keyFromLink, loadConfig } from "./setup.js";
import qrcode from "./vendor/qrcode.mjs";

const app = document.getElementById("app");
const key = keyFromLink();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const api = (path, opts = {}) => fetch(path, { ...opts, headers: { ...(opts.headers ?? {}), "x-booth-key": key } });

let config;

async function render() {
  const res = await api("/api/admin?action=list");
  if (res.status === 403) {
    app.innerHTML = `
      <h1 style="font-size:36px">Admin locked</h1>
      <p class="muted" style="margin-top:12px;max-width:560px">The key in this link isn't right. Your admin link is
      <code>/admin#key=</code> followed by your ADMIN_KEY. You'll find it in the <code>.env</code> file in your booth
      folder, or in Netlify under Project configuration → Environment variables. Or just ask Claude: "what's my admin link?"</p>`;
    return;
  }
  if (!res.ok) {
    app.innerHTML = `<p class="error">Couldn't load (${res.status}). Refresh to try again.</p>`;
    return;
  }
  const { sessions, boothKey } = await res.json();
  const check = await fetch("/api/check", { headers: { "x-booth-key": boothKey } }).then((r) => r.json()).catch(() => ({}));
  const origin = location.origin;
  const links = [
    ["The booth (open on the iPad)", `${origin}/booth#key=${boothKey}`],
    ["Photo wall (open on a TV during the event)", `${origin}/wall#key=${boothKey}`],
    ["Slideshow (open on the projector at the end)", `${origin}/slideshow#key=${boothKey}`],
    ["Frame preview (check your frames, no camera needed)", `${origin}/preview`],
  ];
  const qr = qrcode(0, "M");
  qr.addData(links[0][1]);
  qr.make();
  const emails = sessions.filter((s) => s.email).length;
  const optIns = sessions.filter((s) => s.optIn).length;

  app.innerHTML = `
    <h1 style="font-size:38px">${esc(config.event?.name ?? "Photo booth")} · admin</h1>
    <p class="muted" style="margin:8px 0 26px">${sessions.length} photo sessions · ${emails} emails · ${optIns} said yes to updates ·
      email sending is <strong>${check.emailSending ? "ON" : "OFF (guests use the QR code)"}</strong></p>

    <section class="card" style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;margin-bottom:22px">
      <div class="links">
        <h2 style="font-size:24px">Your links</h2>
        ${links.map(([label, url]) => `<div><strong>${esc(label)}</strong><br><code>${esc(url)}</code>
          <button class="btn quiet copy" data-url="${esc(url)}" type="button">Copy</button></div>`).join("")}
        <p class="muted small">Keep the booth, wall and slideshow links to the people running the event: anyone with them can see the photos.</p>
      </div>
      <div style="text-align:center">
        <div class="qr" style="width:200px;height:200px">${qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true })}</div>
        <p class="muted small" style="margin-top:8px">Scan with the iPad camera<br>to open the booth</p>
      </div>
    </section>

    <div class="row" style="justify-content:flex-start;margin-bottom:22px">
      <button class="btn" id="csv" type="button">Download guest list (CSV)</button>
      <button class="btn ghost" id="refresh" type="button">Refresh</button>
    </div>

    <section class="grid">
      ${
        sessions.length
          ? sessions
              .map(
                (s) => `<div class="card">
          <a href="/p/${s.token}" target="_blank"><img src="/img/${s.token}/feed.jpg" alt="" loading="lazy"></a>
          <span>${esc(new Date(s.takenAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }))}</span>
          <span class="muted">${s.email ? esc(s.email) + (s.optIn ? " · said yes to updates" : "") : "no email"}</span>
          <button class="btn quiet delete" data-token="${s.token}" type="button" style="color:var(--accent)">Delete</button>
        </div>`,
              )
              .join("")
          : `<p class="muted">No photos yet. Open the booth link and take a test photo!</p>`
      }
    </section>

    <section class="card" style="margin-top:40px">
      <h2 style="font-size:22px">After the event</h2>
      <p class="muted" style="margin:8px 0 14px">Download the guest list first. Then you can delete every photo and email in one go,
      so you're not holding guests' photos for longer than you need to. This can't be undone.</p>
      <button class="btn ghost" id="delete-all" type="button">Delete everything…</button>
    </section>`;

  app.querySelectorAll(".copy").forEach((b) =>
    b.addEventListener("click", async () => {
      await navigator.clipboard.writeText(b.dataset.url);
      b.textContent = "Copied!";
    }),
  );
  app.querySelectorAll(".delete").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this photo session? It disappears from the wall, and the guest's link stops working.")) return;
      b.disabled = true;
      await api("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", token: b.dataset.token }) });
      render();
    }),
  );
  document.getElementById("refresh").addEventListener("click", render);
  document.getElementById("csv").addEventListener("click", downloadCsv);
  document.getElementById("delete-all").addEventListener("click", async () => {
    const typed = prompt("This deletes EVERY photo and every guest email. Download the guest list first!\n\nType DELETE to go ahead:");
    if (typed !== "DELETE") return;
    const r = await api("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete-all", confirm: "DELETE" }) });
    const data = await r.json().catch(() => ({}));
    alert(r.ok ? `Done: deleted ${data.deleted} sessions.` : "That didn't work. Try again.");
    render();
  });
}

async function downloadCsv() {
  const res = await api("/api/admin?action=csv");
  if (!res.ok) return alert("Couldn't download the guest list. Try again.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "photo-booth-guests.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

config = await loadConfig();
applyLook(config);
render();
