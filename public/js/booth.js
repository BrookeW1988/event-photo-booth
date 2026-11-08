// The photo booth kiosk. Runs all day on an iPad, so a few golden rules:
//   - ask for the camera ONCE and keep it on (asking again can re-trigger the
//     permission pop-up mid-event)
//   - every screen except the start screen goes back to the start after 60
//     seconds of nobody touching it
//   - while sitting on the start screen, reload every 4 hours to keep Safari fresh
//   - photos stay in memory until they're saved, so a wi-fi blip never loses them
//
// Flow: attract (start) → framePick → capture (3 shots) → preview → email
//       (only if email sending is set up) → sending → done (QR code) → attract

import { applyLook, keyFromLink, loadConfig, loadFrames, setText, wordsFrom } from "./setup.js";
import { SHOT, compose, loadArt, placeholderShot, shrink } from "./compose.js";
import qrcode from "./vendor/qrcode.mjs";

const SHOT_COUNT = 3;
const INACTIVITY_MS = 60_000;
const DONE_RESET_MS = 45_000;
const IDLE_RELOAD_MS = 4 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toJpeg = (canvas, quality = 0.88) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );

// ---- everything the booth remembers ----
let config, frames, art, w, key;
let emailSending = false;
let frame; // the chosen frame
let state = "loading";
let shots = []; // this session's 3 square canvases
let feedBlob = null;
let storyBlob = null;
let stream = null;
let facing = "environment";
let run = 0; // bumped to cancel a capture that's in progress
let inactivityTimer = null;
let doneTimer = null;

// ---------------------------------------------------------------- screens

function show(next) {
  state = next;
  for (const el of document.querySelectorAll("[data-screen]")) el.hidden = el.dataset.screen !== next;
  const cameraOn = next === "framePick" || next === "capture";
  $("camera-wrap").hidden = !cameraOn;
  // Leave room for the frame picker under the camera.
  $("camera-wrap").style.setProperty("--camera-room", next === "framePick" ? `${$("picker").offsetHeight + 16}px` : "0px");
  armInactivity();
  clearTimeout(doneTimer);
  if (next === "done") doneTimer = setTimeout(reset, DONE_RESET_MS);
}

/** Back to the start screen, forgetting this guest's photos. */
function reset() {
  run += 1; // stop any capture in progress
  shots = [];
  feedBlob = storyBlob = null;
  $("email").value = "";
  $("optin").checked = false;
  $("email-error").hidden = true;
  $("preview-error").hidden = true;
  $("countdown").hidden = true;
  $("flash").hidden = true;
  frame = frames[0];
  paintFrameChoice();
  show("attract");
}

// Any screen except start / saving / locked resets after 60s of no touches.
function armInactivity() {
  clearTimeout(inactivityTimer);
  if (["attract", "sending", "locked", "loading"].includes(state)) return;
  inactivityTimer = setTimeout(reset, INACTIVITY_MS);
}
["pointerdown", "keydown", "input"].forEach((evt) => document.addEventListener(evt, armInactivity, { passive: true }));

// ---------------------------------------------------------------- camera

async function startCamera() {
  if (stream) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    $("video").srcObject = stream;
    await $("video").play().catch(() => {});
    return true;
  } catch (err) {
    console.error("[booth] camera failed:", err);
    show("cameraError");
    return false;
  }
}

/** Grab the current camera picture as a square (mirrored on the selfie camera, like a mirror). */
function grabShot() {
  const video = $("video");
  if (!video.videoWidth) return null;
  const side = Math.min(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SHOT;
  const ctx = canvas.getContext("2d");
  if (facing === "user") {
    ctx.translate(SHOT, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, SHOT, SHOT);
  return canvas;
}

function shutterSound() {
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // Sound is a nice-to-have.
  }
}

// ---------------------------------------------------------------- frames

function paintFrameChoice() {
  document.querySelectorAll(".frame-btn").forEach((b) => b.classList.toggle("on", b.dataset.id === frame.id));
  document.documentElement.style.setProperty("--ring", frame.accent);
}

/** Frame buttons with little previews (person shapes until there are real photos). */
function buildFramePickers() {
  const fake = [0, 1, 2].map(() => placeholderShot(config.look?.colours?.accent));
  const thumbs = new Map(frames.map((f) => [f.id, shrink(compose("feed", f, fake, art, config), 216).toDataURL("image/jpeg", 0.8)]));
  for (const holder of [$("frames"), $("frames-mini")]) {
    holder.innerHTML = "";
    for (const f of frames) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "frame-btn";
      btn.dataset.id = f.id;
      btn.innerHTML = `<img alt=""><span></span>`;
      btn.querySelector("img").src = thumbs.get(f.id);
      btn.querySelector("span").textContent = f.label;
      btn.addEventListener("click", () => chooseFrame(f));
      holder.appendChild(btn);
    }
  }
  paintFrameChoice();
}

async function chooseFrame(f) {
  frame = f;
  paintFrameChoice();
  if (shots.length === SHOT_COUNT) await makeOutputs(); // on the preview screen: redo the photos live
}

// ---------------------------------------------------------------- the 3 shots

async function takePhotos() {
  const myRun = ++run;
  const cancelled = () => run !== myRun;
  shots = [];
  show("capture");
  const first = Number(config.booth?.firstCountdown) || 5;
  const next = Number(config.booth?.nextCountdown) || 3;

  for (let i = 0; i < SHOT_COUNT; i++) {
    $("count-label").textContent = i === 0 ? w("firstPose") : w("nextPose", { n: i + 1, total: SHOT_COUNT });
    $("countdown").hidden = false;
    for (let s = i === 0 ? first : next; s > 0; s--) {
      if (cancelled()) return;
      $("count-num").textContent = s;
      await sleep(1000);
    }
    if (cancelled()) return;
    $("countdown").hidden = true;
    const shot = grabShot();
    if (shot) shots.push(shot);
    shutterSound();
    $("flash").hidden = false;
    await sleep(180);
    $("flash").hidden = true;
    await sleep(320); // a beat so the flash reads as "got it"
  }
  if (cancelled()) return;
  if (shots.length < SHOT_COUNT) return show("cameraError"); // the camera dropped out mid-way
  await makeOutputs();
  if (!cancelled()) show("preview");
}

async function makeOutputs() {
  const feed = compose("feed", frame, shots, art, config);
  const story = compose("story", frame, shots, art, config);
  [feedBlob, storyBlob] = await Promise.all([toJpeg(feed), toJpeg(story)]);
  $("feed-preview").src = feed.toDataURL("image/jpeg", 0.7);
  $("story-preview").src = story.toDataURL("image/jpeg", 0.7);
  $("email-thumb").src = $("feed-preview").src;
}

/** The 3 unframed shots side by side, for the photo wall + slideshow. */
async function rawStrip() {
  const strip = document.createElement("canvas");
  strip.width = SHOT * shots.length;
  strip.height = SHOT;
  const ctx = strip.getContext("2d");
  shots.forEach((s, i) => ctx.drawImage(s, i * SHOT, 0));
  return toJpeg(strip, 0.82);
}

// ---------------------------------------------------------------- saving

async function save() {
  if (!feedBlob || !storyBlob) return;
  show("sending");
  setText("sending-label", w("sending"));
  $("email-error").hidden = true;
  let raw = null;
  try {
    raw = await rawStrip();
  } catch {
    // The wall just uses the framed photo instead.
  }

  // 3 tries with a pause between, then a "tap to try again". Photos stay in memory throughout.
  for (const wait of [0, 2000, 5000]) {
    if (wait) {
      setText("sending-label", w("retrying"));
      await sleep(wait);
    }
    try {
      const form = new FormData();
      form.set("feed", feedBlob, "feed.jpg");
      form.set("story", storyBlob, "story.jpg");
      if (raw) form.set("raw", raw, "raw.jpg");
      form.set("frame", frame.id);
      form.set("email", emailSending ? $("email").value.trim() : "");
      form.set("optIn", String(emailSending && $("optin").checked));
      const res = await fetch("/api/upload", { method: "POST", headers: { "x-booth-key": key }, body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) return showDone(data.token, data.emailSent);
      if (res.status === 403) return lock();
      if (res.status >= 400 && res.status < 500) {
        // Our mistake (usually a typo in the email): no point retrying.
        return backToEmail(data.error === "bad email" ? w("badEmail") : w("sendFailed"));
      }
    } catch (err) {
      console.error("[booth] save attempt failed:", err);
    }
  }
  backToEmail(w("sendFailed"));
}

function backToEmail(message) {
  if (!emailSending) {
    // No email screen in this setup: back to the photos so they can tap again.
    $("preview-error").textContent = message;
    $("preview-error").hidden = false;
    show("preview");
    return;
  }
  $("email-error").textContent = message;
  $("email-error").hidden = false;
  show("email");
}

function showDone(token, emailSent) {
  const link = `${location.origin}/p/${token}`;
  const qr = qrcode(0, "M");
  qr.addData(link);
  qr.make();
  $("qr").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 1, scalable: true });
  setText("done-text", emailSent ? w("doneWithEmail") : w("doneNoEmail"));
  show("done");
}

// ---------------------------------------------------------------- start-up

function lock(offline = false) {
  setText("locked-title", offline ? "Can't connect" : w("lockedTitle"));
  setText("locked-help", offline ? "Check the wi-fi, then tap below." : w("lockedHelp"));
  show("locked");
}

function fillWords() {
  const ev = config.event ?? {};
  const b = config.booth ?? {};
  setText("attract-title", ev.name || w("boothTitle"));
  setText("tap-pill", w("tapToStart"));
  setText("attract-small", w("attractSmall"));
  setText("privacy", b.privacyNote ?? "");
  setText("pick-title", w("pickFrame"));
  setText("pick-back", w("back"));
  setText("pick-start", w("start"));
  setText("preview-title", w("previewTitle"));
  setText("for-feed", w("forFeed"));
  setText("for-story", w("forStory"));
  setText("go-again", w("goAgain"));
  setText("keep", w("keepThem"));
  setText("back-to-start", w("backToStart"));
  setText("email-title", w("emailTitle"));
  $("email").placeholder = w("emailPlaceholder");
  setText("optin-text", b.optInText ?? "");
  setText("send", w("sendButton"));
  setText("skip-email", w("skipEmail"));
  setText("back-to-photos", w("backToPhotos"));
  setText("done-title", w("doneTitle"));
  setText("all-done", w("allDone"));
  setText("cam-title", w("cameraErrorTitle"));
  setText("cam-help", w("cameraErrorHelp"));
  setText("cam-retry", w("tryAgain"));
  document.title = `${ev.name || "Photo"} booth`;
}

function wireButtons() {
  $("attract").addEventListener("click", async () => {
    if (!(await startCamera())) return;
    if (frames.length === 1) return takePhotos(); // only one frame: skip the picker
    show("framePick");
  });
  $("pick-back").addEventListener("click", reset);
  $("pick-start").addEventListener("click", takePhotos);
  $("go-again").addEventListener("click", takePhotos);
  $("back-to-start").addEventListener("click", reset);
  $("keep").addEventListener("click", () => (emailSending && config.booth?.askForEmail !== "off" ? show("email") : save()));
  $("email-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      $("email-error").textContent = w("badEmail");
      $("email-error").hidden = false;
      return;
    }
    save();
  });
  $("skip-email").addEventListener("click", () => {
    $("email").value = "";
    $("optin").checked = false;
    save();
  });
  $("back-to-photos").addEventListener("click", () => show("preview"));
  $("all-done").addEventListener("click", reset);
  $("cam-retry").addEventListener("click", () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    reset();
  });
  $("locked-retry").addEventListener("click", () => location.reload());
}

// Keep the screen awake all day (Auto-Lock: Never on the iPad is the backup).
async function keepAwake() {
  try {
    await navigator.wakeLock?.request("screen");
  } catch {
    // Not supported or refused: fine.
  }
}

async function start() {
  try {
    config = await loadConfig();
  } catch {
    return lock(true);
  }
  w = wordsFrom(config);
  key = keyFromLink();
  const camParam = new URLSearchParams(location.search).get("cam");
  const camera = camParam ?? config.booth?.camera ?? "back";
  facing = camera === "front" ? "user" : "environment";
  if (facing === "user") $("video").classList.add("mirror");

  const fontsReady = applyLook(config);
  fillWords();
  wireButtons();

  // Is the key right? (And will guests get an email?)
  try {
    const res = await fetch("/api/check", { headers: { "x-booth-key": key } });
    if (!res.ok) return lock();
    emailSending = Boolean((await res.json()).emailSending);
  } catch {
    return lock(true);
  }
  $("skip-email").hidden = config.booth?.askForEmail === "required";

  const logo = config.event?.logo;
  if (logo) {
    $("attract-logo").src = `/${logo.replace(/^\//, "")}`;
    $("attract-logo").onload = () => ($("attract-logo").hidden = false);
  }

  [frames] = await Promise.all([loadFrames(config), fontsReady]);
  art = await loadArt(config, frames);
  frame = frames[0];
  buildFramePickers();

  keepAwake();
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && keepAwake());
  setInterval(() => state === "attract" && location.reload(), IDLE_RELOAD_MS);
  show("attract");
}

start();
