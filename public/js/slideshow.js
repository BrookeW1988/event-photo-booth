// End-of-night slideshow. Builds itself from every photo of the day, oldest
// first (the day in order): title card → one photo at a time with a slow fade
// and zoom → title card again. Keeps checking for new photos every minute, so
// anything taken during the wrap-up slides in on the next lap.

import { applyLook, keyFromLink, loadConfig } from "./setup.js";
import { cropFor, tilesFrom } from "./tiles.js";

const POLL_MS = 60_000;
const TITLE_MS = 5_000;

async function start() {
  const config = await loadConfig();
  applyLook(config);
  const key = keyFromLink();
  const slideMs = (Number(config.slideshow?.secondsPerPhoto) || 6) * 1000;
  document.documentElement.style.setProperty("--slide-ms", `${slideMs + 1500}ms`);
  const stage = document.getElementById("stage");
  const counter = document.getElementById("counter");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const logo = config.event?.logo ? `<img src="/${esc(config.event.logo.replace(/^\//, ""))}" alt="" style="max-height:90px">` : "";

  let photos = [];
  let index = -1; // -1 = the title card
  let locked = false;

  const load = async () => {
    try {
      const res = await fetch("/api/wall?limit=1000", { headers: { "x-booth-key": key } });
      if (res.status === 403) locked = true;
      if (!res.ok) return;
      const { sessions } = await res.json();
      photos = tilesFrom(sessions, config.wall?.show).reverse(); // oldest first
    } catch {
      // Try again next round.
    }
  };

  const titleCard = () => `
    <div class="title-card slide in">
      ${logo}
      <h1>${esc(config.slideshow?.title ?? "That's a wrap!")}</h1>
      <p class="muted" style="font-size:22px">${esc(config.slideshow?.subtitle ?? "")}</p>
      <p class="muted small">${
        locked
          ? "Slideshow locked: open it from your admin page to get the right link."
          : photos.length
            ? `${photos.length} photo booth moments`
            : "No photos yet. They'll appear here as soon as someone uses the booth."
      }</p>
    </div>`;

  const photoSlide = (p) => `
    <div class="slide in">
      <img class="blur" src="${p.src}" style="${cropFor(p)}" alt="">
      <img class="main ${p.part === undefined ? "" : "square"}" src="${p.src}" style="${cropFor(p)}" alt="">
    </div>`;

  const step = () => {
    if (photos.length === 0) index = -1;
    const html = index === -1 ? titleCard() : photoSlide(photos[index]);
    // New slide fades in on top of the old one, then the old one is removed.
    stage.insertAdjacentHTML("beforeend", html);
    while (stage.children.length > 2) stage.firstElementChild.remove();
    counter.textContent = index >= 0 ? `${index + 1} / ${photos.length}` : "";
    // Get the next photo loading now, so the fade never shows a half-loaded picture.
    const next = photos[index + 1];
    if (next) new Image().src = next.src;
    const wait = index === -1 ? TITLE_MS : slideMs;
    index = index + 1 >= photos.length ? -1 : index + 1;
    setTimeout(step, wait);
  };

  await load();
  setInterval(load, POLL_MS);
  step();
}

start();
