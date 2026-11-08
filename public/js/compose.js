// The compositor: turns 3 camera shots + a frame into the two finished images.
//   feed  1080 x 1350  (an Instagram post, 4:5)
//   story 1080 x 1920  (an Instagram / Facebook story, 9:16)
// The booth, the frame preview page and the frame-picker thumbnails all use
// this same file, so what you see in the preview is exactly what guests get.
//
// Layers, bottom to top:
//   1. the frame's background colour
//   2. the frame's background art (stretched to fill, trimmed at the edges)
//   3. the 3 photos, each with its border
//   4. your logo + line 2 (feed: the 4th square / story: under the photos)
//   5. the event name at the top
//   6. an optional overlay PNG (for frames designed in Canva etc.)
// Words are always drawn by code, never by AI, so they're always spelled right.

export const SIZES = { feed: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } };
export const SHOT = 1080; // each camera shot is saved as a 1080 x 1080 square

// Where everything goes, in pixels from the top-left corner.
// The story keeps everything clear of the bits Instagram covers with its own
// buttons (about the top 250px and the bottom 190px).
// docs/guides/*.png show these same boxes: if you move one here, remake the guides.
const GEOMETRY = {
  feed: {
    slots: [
      { x: 55, y: 235, w: 470, h: 470 },
      { x: 555, y: 235, w: 470, h: 470 },
      { x: 55, y: 735, w: 470, h: 470 },
    ],
    card: { x: 555, y: 735, w: 470, h: 470 },
    title: { x: 60, y: 60, w: 960, h: 140 },
  },
  story: {
    slots: [
      { x: 270, y: 392, w: 540, h: 405 },
      { x: 270, y: 813, w: 540, h: 405 },
      { x: 270, y: 1234, w: 540, h: 405 },
    ],
    title: { x: 90, y: 262, w: 900, h: 112 },
    footer: { x: 120, y: 1652, w: 840, h: 90 },
  },
};
// Tilt in degrees for "tilt": true frames (feed: 3 photos + the card).
const TILT = { feed: [-2, 1.5, 1, -1.2], story: [-1.5, 1.2, -1] };

/** Load an image. Resolves to null instead of failing, so flaky wi-fi never breaks a session. */
export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("[booth] couldn't load", src);
      resolve(null);
    };
    img.src = src;
  });
}

/** Load every image the frames + config need. Returns { images: Map(src → img), logo }. */
export async function loadArt(config, frames) {
  const srcs = new Set();
  for (const f of frames) [f.background, f.backgroundStory, f.overlayFeed, f.overlayStory].forEach((s) => s && srcs.add(s));
  const list = [...srcs];
  const imgs = await Promise.all(list.map(loadImage));
  const images = new Map(list.map((src, i) => [src, imgs[i]]).filter(([, img]) => img));
  const logoSrc = config.event?.logo ? `/${config.event.logo.replace(/^\//, "")}` : "";
  return { images, logo: await loadImage(logoSrc) };
}

/**
 * Build one finished image.
 * format: "feed" | "story". shots: 3 images or canvases (any size; squares are best).
 * art: from loadArt(). Returns a canvas.
 */
export function compose(format, frame, shots, art, config) {
  const { width: W, height: H } = SIZES[format];
  const g = GEOMETRY[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const fonts = config.look?.fonts ?? {};
  const event = config.event ?? {};

  // 1 + 2: background
  ctx.fillStyle = frame.backgroundColour;
  ctx.fillRect(0, 0, W, H);
  const bg = art.images.get((format === "story" && frame.backgroundStory) || frame.background);
  if (bg) drawCover(ctx, bg, 0, 0, W, H);

  // 3: photos
  g.slots.forEach((slot, i) => {
    if (shots[i]) drawPhoto(ctx, shots[i], slot, frame, frame.photos.tilt ? TILT[format][i] : 0);
  });

  // 4: logo + line 2
  if (format === "feed") {
    drawCard(ctx, g.card, frame, art.logo, event.line2, fonts, frame.photos.tilt ? TILT.feed[3] : 0);
  } else {
    drawFooter(ctx, g.footer, frame, art.logo, event.line2, fonts);
  }

  // 5: event name
  drawWords(ctx, event.name, g.title, fonts.headings, frame.title.colour, frame.title.plate, 1);

  // 6: overlay
  const overlay = art.images.get(format === "feed" ? frame.overlayFeed : frame.overlayStory);
  if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
  return canvas;
}

/** A soft "person" shape, used in the frame picker before anyone's had their photo taken. */
export function placeholderShot(colour = "#888888") {
  const c = document.createElement("canvas");
  c.width = c.height = 400;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e9e4ec";
  ctx.fillRect(0, 0, 400, 400);
  ctx.fillStyle = colour + "55";
  ctx.beginPath();
  ctx.arc(200, 165, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(200, 400, 150, 140, 0, Math.PI, 0);
  ctx.fill();
  return c;
}

/** Shrink a finished canvas into a small one (for thumbnails). */
export function shrink(canvas, width) {
  const small = document.createElement("canvas");
  small.width = width;
  small.height = Math.round((canvas.height / canvas.width) * width);
  small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
  return small;
}

// ---------------------------------------------------------------- drawing helpers

/** Draw an image to fill a box, cropping the edges that don't fit (like CSS object-fit: cover). */
function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function withShadow(ctx, on, draw) {
  ctx.save();
  if (on) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
  }
  draw();
  ctx.restore();
}

/** One photo in its slot, with the frame's border style. */
function drawPhoto(ctx, shot, slot, frame, tiltDeg) {
  const { border, colour, shadow } = frame.photos;
  const { w, h } = slot;
  ctx.save();
  ctx.translate(slot.x + w / 2, slot.y + h / 2);
  ctx.rotate((tiltDeg * Math.PI) / 180);
  const x = -w / 2;
  const y = -h / 2;

  // Border thickness: [top, sides, bottom] as a share of the slot size.
  const m = Math.min(w, h);
  const edges = {
    print: [0.045, 0.045, 0.045],
    polaroid: [0.055, 0.055, 0.17],
    thin: [0.012, 0.012, 0.012],
    rounded: [0, 0, 0],
    none: [0, 0, 0],
  }[border] ?? [0.045, 0.045, 0.045];
  const [t, s, b] = edges.map((e) => Math.round(e * m));
  const radius = border === "rounded" ? Math.round(m * 0.08) : 0;

  // The border card (or, for borderless styles, the shadow shape).
  withShadow(ctx, shadow, () => {
    ctx.fillStyle = border === "rounded" || border === "none" ? "#000000" : colour;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
  });

  // The photo itself, clipped to the space inside the border.
  ctx.save();
  roundRect(ctx, x + s, y + t, w - 2 * s, h - t - b, radius);
  ctx.clip();
  drawCover(ctx, shot, x + s, y + t, w - 2 * s, h - t - b);
  ctx.restore();
  ctx.restore();
}

/** Feed only: the 4th square, with your logo and line 2. */
function drawCard(ctx, box, frame, logo, line2, fonts, tiltDeg) {
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate((tiltDeg * Math.PI) / 180);
  const x = -box.w / 2;
  const y = -box.h / 2;
  if (frame.card.colour) {
    withShadow(ctx, frame.photos.shadow, () => {
      ctx.fillStyle = frame.card.colour;
      roundRect(ctx, x, y, box.w, box.h, Math.round(box.w * 0.05));
      ctx.fill();
    });
  }
  const pad = box.w * 0.1;
  if (logo) {
    // Logo in the top part, line 2 underneath.
    const area = { x: x + pad, y: y + pad, w: box.w - 2 * pad, h: box.h * 0.5 };
    drawContain(ctx, logo, area);
    drawWords(ctx, line2, { x: x + pad, y: y + box.h * 0.66, w: box.w - 2 * pad, h: box.h * 0.2 }, fonts.body, frame.card.textColour, "", 2);
  } else {
    // No logo: line 2 big in the middle.
    drawWords(ctx, line2, { x: x + pad, y: y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad }, fonts.headings, frame.card.textColour, "", 3);
  }
  ctx.restore();
}

/** Story only: logo + line 2 side by side under the photos. */
function drawFooter(ctx, box, frame, logo, line2, fonts) {
  if (!logo) {
    drawWords(ctx, line2, box, fonts.body, frame.title.colour, frame.title.plate, 1);
    return;
  }
  const logoH = box.h * 0.8;
  const logoW = Math.min(box.w * 0.35, logoH * ((logo.naturalWidth || 1) / (logo.naturalHeight || 1)));
  const gap = 28;
  const textBox = { x: box.x + logoW + gap, y: box.y, w: box.w - logoW - gap, h: box.h };
  drawContain(ctx, logo, { x: box.x, y: box.y + (box.h - logoH) / 2, w: logoW, h: logoH });
  drawWords(ctx, line2, textBox, fonts.body, frame.title.colour, frame.title.plate, 1, "left");
}

/** Fit an image inside a box without cropping, centred. */
function drawContain(ctx, img, box) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(box.w / iw, box.h / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

/**
 * Write text inside a box, as big as fits, on up to maxLines lines.
 * plate = an optional colour drawn behind the words so they read over busy art.
 */
function drawWords(ctx, text, box, family, colour, plate, maxLines, align = "center") {
  const words = String(text ?? "").trim();
  if (!words) return;
  const fontFor = (size) => `${size}px ${family ? `"${family}", ` : ""}system-ui, sans-serif`;

  // Start big and shrink until it fits the box on maxLines lines.
  let size = Math.floor(box.h / maxLines / 1.15);
  let lines = [words];
  for (; size > 14; size -= 2) {
    ctx.font = fontFor(size);
    lines = wrap(ctx, words, box.w, maxLines);
    const tooWide = lines.some((l) => ctx.measureText(l).width > box.w);
    if (lines.length <= maxLines && !tooWide && lines.length * size * 1.15 <= box.h) break;
  }
  ctx.font = fontFor(size);
  const lineH = size * 1.15;
  const blockH = lines.length * lineH;
  let top = box.y + (box.h - blockH) / 2;

  if (plate) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = size * 0.5;
    const padY = size * 0.25;
    const px = align === "left" ? box.x - padX : box.x + (box.w - widest) / 2 - padX;
    ctx.fillStyle = plate;
    roundRect(ctx, px, top - padY, widest + 2 * padX, blockH + 2 * padY, size * 0.4);
    ctx.fill();
  }

  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const x = align === "left" ? box.x : box.x + box.w / 2;
  for (const line of lines) {
    ctx.fillText(line, x, top + lineH / 2);
    top += lineH;
  }
}

/** Split text into lines no wider than maxWidth (at most maxLines; the last one may overflow). */
function wrap(ctx, text, maxWidth, maxLines) {
  if (maxLines <= 1) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    head.push(lines.slice(maxLines - 1).join(" "));
    return head;
  }
  return lines;
}
