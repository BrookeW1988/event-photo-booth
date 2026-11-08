// Shared start-up for every page: loads your settings (booth.config.json) and
// your frames, and applies your colours and fonts.

export async function loadConfig() {
  const res = await fetch("/booth.config.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Couldn't load booth.config.json");
  return res.json();
}

/** Load every frame listed in the config. A broken frame is skipped, never fatal. */
export async function loadFrames(config) {
  const ids = Array.isArray(config.frames) ? config.frames : [];
  const loaded = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`/frames/${id}/frame.json`, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return frameWithDefaults(id, await res.json(), config);
      } catch (err) {
        console.warn(`[booth] frame "${id}" is missing or broken, skipping it:`, err);
        return null;
      }
    }),
  );
  const frames = loaded.filter(Boolean);
  // Never zero frames: fall back to a plain one in your colours.
  if (frames.length === 0) frames.push(frameWithDefaults("plain", {}, config));
  return frames;
}

/** Fill in anything a frame.json leaves out, so a frame can be as short as {"label": "Gold"}. */
export function frameWithDefaults(id, f, config) {
  const c = config.look?.colours ?? {};
  const file = (name) => (name ? `/frames/${id}/${name}` : "");
  return {
    id,
    label: f.label ?? id,
    accent: f.accent ?? c.accent ?? "#ff4fa3",
    backgroundColour: f.backgroundColour ?? c.background ?? "#111111",
    background: file(f.background),
    backgroundStory: file(f.backgroundStory),
    overlayFeed: file(f.overlayFeed),
    overlayStory: file(f.overlayStory),
    photos: {
      border: f.photos?.border ?? "print", // print | polaroid | thin | rounded | none
      colour: f.photos?.colour ?? "#ffffff",
      tilt: Boolean(f.photos?.tilt),
      shadow: f.photos?.shadow ?? true,
    },
    title: {
      colour: f.title?.colour ?? c.text ?? "#ffffff",
      plate: f.title?.plate ?? "", // a colour behind the words, e.g. "#00000099" (blank = none)
    },
    card: {
      colour: f.card?.colour ?? "#ffffffee",
      textColour: f.card?.textColour ?? "#222222",
    },
  };
}

/** Apply your colours + fonts to the page. Resolves once the fonts are ready (or after 4s). */
export function applyLook(config) {
  const c = config.look?.colours ?? {};
  const fonts = config.look?.fonts ?? {};
  const root = document.documentElement.style;
  const set = (name, value) => value && root.setProperty(name, value);
  set("--bg", c.background);
  set("--text", c.text);
  set("--muted", c.muted);
  set("--accent", c.accent);
  set("--button", c.button);
  set("--button-text", c.buttonText);
  if (fonts.headings) root.setProperty("--font-head", `"${fonts.headings}", system-ui, sans-serif`);
  if (fonts.body) root.setProperty("--font-body", `"${fonts.body}", system-ui, sans-serif`);
  // Optional art behind the start screen (e.g. one of your frame backgrounds).
  const art = config.look?.startScreenImage;
  if (art) root.setProperty("--start-art", `url("/${art.replace(/^\//, "")}")`);

  const families = [...new Set([fonts.headings, fonts.body].filter(Boolean))];
  if (families.length === 0) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?" +
    families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`).join("&") +
    "&display=swap";
  // Wait for Google's font list first: asking for a font before the browser has
  // heard of it says "ready" straight away, and the photos get a backup font.
  const listLoaded = new Promise((resolve) => {
    link.onload = resolve;
    link.onerror = resolve;
  });
  document.head.appendChild(link);
  const ready = listLoaded.then(() => Promise.all(families.map((f) => document.fonts.load(`64px "${f}"`).catch(() => null))));
  const timeout = new Promise((r) => setTimeout(r, 4000)); // slow wi-fi: carry on with a backup font
  return Promise.race([ready, timeout]);
}

/** A line of text from the "words" section of the config, with {n}-style blanks filled in. */
export function wordsFrom(config) {
  const w = config.words ?? {};
  return (key, vars = {}) =>
    String(w[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

/** The key from the page link: .../booth#key=abc (the part after # never leaves the device). */
export function keyFromLink() {
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("key");
  const fromQuery = new URLSearchParams(location.search).get("key");
  return (fromHash ?? fromQuery ?? "").trim();
}

/** Put text into an element by id (and skip quietly if the element isn't on this page). */
export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
