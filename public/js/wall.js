// The big-screen photo wall: a grid of the newest photos that checks for new
// ones every 45 seconds, with one photo popping out every 8 seconds.
// Built to run for hours on a TV, so the number of photos on screen is capped.

import { applyLook, keyFromLink, loadConfig, setText } from "./setup.js";
import { cropFor, tilesFrom } from "./tiles.js";

const POLL_MS = 45_000;
const SPOTLIGHT_MS = 8_000;
const MAX_TILES = 60;

async function start() {
  const config = await loadConfig();
  applyLook(config);
  const key = keyFromLink();
  setText("title", config.wall?.title ?? "Photo wall");
  setText("empty-text", config.wall?.emptyText ?? "");
  if (config.event?.logo) {
    const logo = document.getElementById("logo");
    logo.src = `/${config.event.logo.replace(/^\//, "")}`;
    logo.onload = () => (logo.hidden = false);
  }

  let tiles = [];
  let shownIds = "";
  const grid = document.getElementById("grid");

  const load = async () => {
    try {
      const res = await fetch(`/api/wall?limit=${MAX_TILES}`, { headers: { "x-booth-key": key } });
      if (res.status === 403) {
        setText("empty-text", "Wall locked: open it from your admin page to get the right link.");
        document.getElementById("empty").hidden = false;
        return;
      }
      if (!res.ok) return;
      const { sessions } = await res.json();
      tiles = tilesFrom(sessions, config.wall?.show).slice(0, MAX_TILES);
      const ids = tiles.map((t) => t.id).join(",");
      if (ids === shownIds) return; // nothing new: don't redraw (no flicker)
      shownIds = ids;
      grid.innerHTML = tiles.map((t) => `<img class="tile" data-id="${t.id}" src="${t.src}" style="${cropFor(t)}" alt="">`).join("");
      document.getElementById("empty").hidden = tiles.length > 0;
    } catch {
      // Wi-fi blip: try again next round. The wall never crashes over it.
    }
  };
  await load();
  setInterval(load, POLL_MS);

  let i = 0;
  setInterval(() => {
    const all = grid.querySelectorAll(".tile");
    if (!all.length) return;
    all.forEach((t) => t.classList.remove("spot"));
    all[i++ % all.length].classList.add("spot");
  }, SPOTLIGHT_MS);
}

start();
