// npm run check: looks over your booth settings and frames and tells you, in
// plain English, anything that's missing or broken. Run it before you go live.

import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath (not .pathname) so folders with spaces in their names work.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUB = join(ROOT, "public");
let problems = 0;
let warnings = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => (problems++, console.log(`  ✗ ${msg}`));
const warn = (msg) => (warnings++, console.log(`  ! ${msg}`));
const isColour = (c) => typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    bad(`${label} isn't valid JSON (usually a missing comma or quote): ${err.message}`);
    return null;
  }
}

/** Width x height of a PNG or JPEG, read from the file's first bytes. */
function imageSize(path) {
  const b = readFileSync(path);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function checkImage(file, label, { minHeight = 0 } = {}) {
  const path = join(PUB, file.replace(/^\//, ""));
  if (!existsSync(path)) return bad(`${label}: can't find ${file}`);
  const size = imageSize(path);
  const mb = statSync(path).size / 1024 / 1024;
  if (!size) return warn(`${label}: ${file} isn't a PNG or JPEG the booth can read`);
  if (minHeight && size.h < minHeight) warn(`${label}: ${file} is only ${size.w}×${size.h}, so it may look soft. Aim for at least ${minHeight}px tall.`);
  if (mb > 1.5) warn(`${label}: ${file} is ${mb.toFixed(1)} MB. Smaller loads faster on venue wi-fi (ask Claude to shrink it).`);
  ok(`${label}: ${file} (${size.w}×${size.h})`);
}

console.log("\nYour settings (public/booth.config.json)");
const cfg = readJson(join(PUB, "booth.config.json"), "booth.config.json");
if (cfg) {
  cfg.event?.name ? ok(`event name: "${cfg.event.name}"`) : bad("event.name is empty");
  if (cfg.event?.logo) {
    checkImage(cfg.event.logo, "logo");
    // The kit ships with a "YOUR LOGO" placeholder: catch it before it lands on guests' photos.
    const logoPath = join(PUB, cfg.event.logo.replace(/^\//, ""));
    const PLACEHOLDER = "596f88051f46d9b0fd0704480486976eedcb99e32ca2f7bca6438c10d8f1763e";
    if (existsSync(logoPath) && createHash("sha256").update(readFileSync(logoPath)).digest("hex") === PLACEHOLDER) {
      warn('the logo is still the "YOUR LOGO" placeholder. Add yours as public/brand/logo.png, or set "logo": "" for none');
    }
  }
  else ok("no logo (that's fine: line 2 shows bigger instead)");
  if (cfg.look?.startScreenImage) checkImage(cfg.look.startScreenImage, "start screen art");
  for (const [name, value] of Object.entries(cfg.look?.colours ?? {})) {
    if (!isColour(value)) bad(`colour "${name}" should look like #ff4fa3, but it's ${JSON.stringify(value)}`);
  }
  if (!["optional", "required", "off"].includes(cfg.booth?.askForEmail)) bad('booth.askForEmail should be "optional", "required" or "off"');
  if (!["back", "front"].includes(cfg.booth?.camera)) bad('booth.camera should be "back" or "front"');
  if (!["raw", "framed"].includes(cfg.wall?.show)) bad('wall.show should be "raw" (plain photos) or "framed"');
  if (!Array.isArray(cfg.frames) || cfg.frames.length === 0) bad("frames list is empty: add at least one frame name");

  console.log("\nYour frames (public/frames/)");
  for (const id of cfg.frames ?? []) {
    const dir = join(PUB, "frames", id);
    if (!existsSync(join(dir, "frame.json"))) {
      bad(`"${id}" is in your frames list, but public/frames/${id}/frame.json doesn't exist`);
      continue;
    }
    const f = readJson(join(dir, "frame.json"), `frames/${id}/frame.json`);
    if (!f) continue;
    for (const key of ["accent", "backgroundColour"]) if (f[key] && !isColour(f[key])) bad(`${id}: ${key} should be a colour like #ff4fa3`);
    for (const [group, key] of [["photos", "colour"], ["title", "colour"], ["title", "plate"], ["card", "colour"], ["card", "textColour"]]) {
      const v = f[group]?.[key];
      if (v && !isColour(v)) bad(`${id}: ${group}.${key} should be a colour like #ff4fa3 (or "" for none)`);
    }
    if (f.photos?.border && !["print", "polaroid", "thin", "rounded", "none"].includes(f.photos.border)) {
      bad(`${id}: photos.border should be print, polaroid, thin, rounded or none`);
    }
    if (f.background) checkImage(`frames/${id}/${f.background}`, `${id} background`, { minHeight: 1200 });
    else ok(`${id}: no background art (plain colour)`);
    for (const key of ["backgroundStory", "overlayFeed", "overlayStory"]) if (f[key]) checkImage(`frames/${id}/${f[key]}`, `${id} ${key}`);
  }
}

console.log("\nYour secret keys (.env, for testing on this computer)");
const envFile = join(ROOT, ".env");
if (!existsSync(envFile)) {
  warn("no .env file yet: run `npm run setup` to make your keys");
} else {
  const env = Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split("\n")
      .filter((l) => /^\w+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  for (const k of ["BOOTH_KEY", "ADMIN_KEY"]) (env[k]?.length ?? 0) >= 8 ? ok(`${k} is set`) : bad(`${k} is missing: run \`npm run setup\``);
  if (env.BOOTH_KEY && env.BOOTH_KEY === env.ADMIN_KEY) bad("BOOTH_KEY and ADMIN_KEY are the same: they must be different");
  if (env.RESEND_API_KEY && env.EMAIL_FROM) ok("email sending is set up");
  else if (env.RESEND_API_KEY || env.EMAIL_FROM) bad("email sending needs BOTH RESEND_API_KEY and EMAIL_FROM");
  else ok("email sending is off (guests use the QR code)");
  console.log("  (Remember: the live site uses the keys saved in Netlify, not this file.)");
}

console.log(
  problems
    ? `\n${problems} thing${problems > 1 ? "s" : ""} to fix${warnings ? `, ${warnings} to look at` : ""}.\n`
    : `\nAll good${warnings ? ` (${warnings} thing${warnings > 1 ? "s" : ""} worth a look)` : ""}.\n`,
);
process.exit(problems ? 1 : 0);
