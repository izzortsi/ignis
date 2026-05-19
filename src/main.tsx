import { render } from "solid-js/web";
import "./styles/app.css";
import { App } from "./App";

// The vendored ludus-ignis CSS is phone-first; its full-size layout lives
// behind html[data-view-mode="desktop"] (.intro-stage / .map-stage caps at
// 1.5rem, fits 96vw/88vh). Set it by viewport width so a desktop window uses
// the whole screen instead of a phone-width column; keep it live on resize.
function applyViewMode(): void {
  const desktop = window.innerWidth >= 760;
  document.documentElement.dataset.viewMode = desktop ? "desktop" : "mobile";
}
applyViewMode();
window.addEventListener("resize", applyViewMode);

const host = document.getElementById("app");
if (host === null) throw new Error("#app mount point missing");
render(() => <App />, host);
