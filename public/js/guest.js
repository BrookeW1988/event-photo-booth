// A guest's own photos page: /p/<token>. What the QR code and the email link to.

import { applyLook, loadConfig, setText } from "./setup.js";

async function start() {
  const config = await loadConfig();
  applyLook(config);
  const g = config.guestPage ?? {};
  const token = location.pathname.split("/")[2] || new URLSearchParams(location.search).get("t") || "";
  const ok = /^\d{14}-[A-Za-z0-9_-]{16}$/.test(token);

  document.title = g.title ?? "Your photos";
  setText("title", g.title ?? "Your photos");
  setText("tip", g.tip ?? "");
  setText("tag", g.tagLine ?? "");
  if (config.event?.logo) {
    const logo = document.getElementById("logo");
    logo.src = `/${config.event.logo.replace(/^\//, "")}`;
    logo.onload = () => (logo.hidden = false);
  }

  const feed = document.getElementById("feed");
  const missing = () => {
    for (const id of ["feed", "story", "dl-feed", "dl-story", "tip", "tag"]) document.getElementById(id).hidden = true;
    document.getElementById("missing").hidden = false;
  };
  if (!ok) return missing();
  feed.onerror = missing;
  feed.src = `/img/${token}/feed.jpg`;
  document.getElementById("story").src = `/img/${token}/story.jpg`;

  const feedLink = document.getElementById("dl-feed");
  feedLink.href = `/img/${token}/feed.jpg?download=1`;
  feedLink.textContent = g.downloadFeed ?? "Save for your feed";
  const storyLink = document.getElementById("dl-story");
  storyLink.href = `/img/${token}/story.jpg?download=1`;
  storyLink.textContent = g.downloadStory ?? "Save for your story";
}

start();
