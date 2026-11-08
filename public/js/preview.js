// Frame preview (/preview): every frame, feed + story, built with sample photos
// by the same code the booth uses. Use it to check a new frame without a camera.
// /preview?frame=garden shows just one frame.

import { applyLook, loadConfig, loadFrames } from "./setup.js";
import { compose, loadArt, loadImage } from "./compose.js";

const out = document.getElementById("out");
const config = await loadConfig();
await applyLook(config);
const only = new URLSearchParams(location.search).get("frame");
const frames = (await loadFrames(config)).filter((f) => !only || f.id === only);
const art = await loadArt(config, frames);

// Sample shots: /samples/1.jpg, 2.jpg, 3.jpg. Swap in your own to test with real faces.
const samples = await Promise.all([1, 2, 3].map((n) => loadImage(`/samples/${n}.jpg`)));
const shots = samples.map((img, i) => img ?? stand_in(i));

for (const frame of frames) {
  const missing = [frame.background, frame.backgroundStory, frame.overlayFeed, frame.overlayStory].filter((src) => src && !art.images.has(src));
  const feed = compose("feed", frame, shots, art, config);
  const story = compose("story", frame, shots, art, config);
  const section = document.createElement("section");
  section.innerHTML = `
    <h2 style="font-size:26px">${frame.label} <span class="muted small">(${frame.id})</span></h2>
    ${missing.length ? `<p class="error">Can't find: ${missing.join(", ")}. Check the file names in frames/${frame.id}/frame.json.</p>` : ""}
    <div class="row" style="justify-content:flex-start;align-items:flex-end;margin-top:12px">
      <figure style="margin:0"><img style="width:min(420px,90vw);border-radius:12px" alt=""><figcaption class="muted small">Feed post 1080 × 1350</figcaption></figure>
      <figure style="margin:0"><img style="width:min(300px,64vw);border-radius:12px" alt=""><figcaption class="muted small">Story 1080 × 1920</figcaption></figure>
    </div>`;
  const [a, b] = section.querySelectorAll("img");
  a.src = feed.toDataURL("image/jpeg", 0.85);
  b.src = story.toDataURL("image/jpeg", 0.85);
  out.appendChild(section);
}

// If the sample photos are missing: grey squares, so the layout still shows.
function stand_in(i) {
  const c = document.createElement("canvas");
  c.width = c.height = 600;
  const ctx = c.getContext("2d");
  ctx.fillStyle = ["#9aa", "#a9a", "#aa9"][i];
  ctx.fillRect(0, 0, 600, 600);
  return c;
}
