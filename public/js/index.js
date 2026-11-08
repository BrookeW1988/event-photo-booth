// The home page guests might land on: points them to the QR code / their email.
import { applyLook, loadConfig, setText } from "./setup.js";

const config = await loadConfig();
applyLook(config);
setText("title", config.event?.name ?? "Photo booth");
if (config.event?.logo) {
  const logo = document.getElementById("logo");
  logo.src = `/${config.event.logo.replace(/^\//, "")}`;
  logo.onload = () => (logo.hidden = false);
}
