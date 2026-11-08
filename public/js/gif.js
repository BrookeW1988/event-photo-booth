// "Make a GIF of the night": turns your booth photos into one looping GIF, right here in
// the browser, so there's nothing to install. It looks like a little retro computer window
// (title bar, photo counter, camera date stamp) in your booth colours.
// Post it, pop it in your thank-you email, or share it with your community.

import { GIFEncoder, applyPalette, quantize } from "./vendor/gifenc.mjs";
import { loadImage } from "./compose.js";

const WIDTH = 600; // 600px wide: sharp in emails and posts, small enough to load fast
const BORDER = 4;
const BAR = 34; // height of the title bar and the bottom bar
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** "Bloom Breakfast" → "bloom_breakfast.gif" */
export function gifName(eventName) {
  const slug = String(eventName || "photo booth").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${slug || "photo_booth"}.gif`;
}

/**
 * Build the GIF. Returns a Blob.
 * sessions: from the admin list (newest first). opts: { show: "raw" | "framed", count, title,
 * left, right, msPerPhoto, colours, onProgress(done, total) }
 */
export async function makeGif(sessions, opts) {
  const framed = opts.show === "framed";
  // Oldest first, so the GIF plays through the night in order.
  const picked = sessions.slice(0, opts.count).reverse();
  const photoW = WIDTH - BORDER * 2;
  const photoH = framed ? Math.round(photoW * 1.25) : photoW; // feed posts are 4:5, raw shots are square
  const height = BORDER * 2 + BAR * 2 + photoH;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const gif = GIFEncoder();
  let written = 0;

  for (let i = 0; i < picked.length; i++) {
    const s = picked[i];
    // Plain photos use the middle shot of each guest's 3; framed uses the finished feed post.
    const useRaw = !framed && s.hasRaw;
    const img = await loadImage(`/img/${s.token}/${useRaw ? "raw" : "feed"}.jpg`);
    opts.onProgress?.(i + 1, picked.length);
    if (!img) continue; // a deleted or missing photo: skip it rather than fail the whole GIF

    drawWindow(ctx, opts, photoH);
    const box = { x: BORDER, y: BORDER + BAR, w: photoW, h: photoH };
    if (useRaw) {
      const third = img.naturalWidth / 3;
      drawCover(ctx, img, third, 0, third, img.naturalHeight, box);
    } else {
      drawCover(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, box);
    }
    drawStamps(ctx, box, `${String(i + 1).padStart(2, "0")}/${String(picked.length).padStart(2, "0")}`, dateStamp(s.takenAt));

    const { data } = ctx.getImageData(0, 0, WIDTH, height);
    const palette = quantize(data, 256); // each frame gets its own 256 colours, so skin tones stay nice
    const index = applyPalette(data, palette);
    gif.writeFrame(index, WIDTH, height, { palette, delay: opts.msPerPhoto, repeat: 0 });
    written++;
    await new Promise((r) => setTimeout(r)); // let the page breathe so the progress text updates
  }

  if (!written) throw new Error("none of those photos could be loaded");
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

/** The retro window: coloured border + title bar with buttons, light bottom bar with your words. */
function drawWindow(ctx, opts, photoH) {
  const { accent, background, text, buttonText } = opts.colours;
  const h = BORDER * 2 + BAR * 2 + photoH;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, WIDTH, h);

  // Title bar: file name on the left, minimise / maximise / close on the right.
  ctx.fillStyle = buttonText;
  ctx.font = `bold 16px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(fit(ctx, opts.title, WIDTH - 150), BORDER + 10, BORDER + BAR / 2 + 1);
  ["–", "□", "×"].forEach((glyph, n) => {
    const x = WIDTH - BORDER - 8 - (3 - n) * 30 + 4;
    const y = BORDER + 6;
    ctx.fillStyle = text;
    ctx.fillRect(x, y, 24, BAR - 12);
    ctx.strokeStyle = background;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, 22, BAR - 14);
    ctx.fillStyle = background;
    ctx.font = `bold 15px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(glyph, x + 12, y + (BAR - 12) / 2 + 1);
  });

  // Bottom bar: your event on the left, your second line on the right.
  const barY = BORDER + BAR + photoH;
  ctx.fillStyle = text;
  ctx.fillRect(BORDER, barY, WIDTH - BORDER * 2, BAR);
  ctx.font = `15px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = background;
  ctx.fillText(fit(ctx, opts.left, WIDTH * 0.5), BORDER + 10, barY + BAR / 2 + 1);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.font = `bold 15px ${MONO}`;
  ctx.fillText(fit(ctx, opts.right, WIDTH * 0.42), WIDTH - BORDER - 10, barY + BAR / 2 + 1);
}

/** Photo counter (top left) and an old-camera date stamp (bottom right), on top of the photo.
 *  Each sits on a small dark pill so it reads on light frames as well as dark ones. */
function drawStamps(ctx, box, counter, date) {
  ctx.save();
  ctx.textBaseline = "middle";
  const pill = (text, font, colour, x, y, align) => {
    ctx.font = font;
    const w = ctx.measureText(text).width + 16;
    const left = align === "left" ? x : x - w;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(left, y - 14, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.textAlign = "left";
    ctx.fillText(text, left + 8, y + 1);
  };
  pill(`› ${counter}`, `bold 17px ${MONO}`, "#ffffff", box.x + 10, box.y + 24, "left");
  // the orange of a film camera's date stamp
  if (date) pill(date, `bold 18px ${MONO}`, "#ffa53a", box.x + box.w - 10, box.y + box.h - 24, "right");
  ctx.restore();
}

/** Draw part of an image (sx, sy, sw, sh) so it fills the box, trimming the edges if needed. */
function drawCover(ctx, img, sx, sy, sw, sh, box) {
  const scale = Math.max(box.w / sw, box.h / sh);
  const cw = box.w / scale;
  const ch = box.h / scale;
  ctx.drawImage(img, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, box.x, box.y, box.w, box.h);
}

/** "2026-12-06T…" → "06 12 '26" */
function dateStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())} ${p(d.getMonth() + 1)} '${String(d.getFullYear()).slice(2)}`;
}

/** Shorten text with "…" so it never runs off the bar. */
function fit(ctx, text, maxWidth) {
  let t = String(text ?? "");
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}
