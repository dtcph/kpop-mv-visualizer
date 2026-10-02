// Entry point: wires up data loading, canvas setup, the two views, and the
// single requestAnimationFrame loop. All tunable constants live in CONFIG.

import { loadVideos } from "./data.js";
import { fitCanvasToWindow } from "./utils.js";
import { YearView } from "./yearView.js";
import { VideoView } from "./videoView.js";
import { hideTooltip } from "./tooltip.js";
import { initWelcome } from "./welcome.js";
import { getLang, setLang, onLangChange, ensureFonts } from "./i18n.js";

initWelcome();

// ---------------------------------------------------------------------
// Tuning constants. Sizes below marked "(auto)" are recomputed on resize
// as fractions of the viewport (see computeResponsiveConfig) so the layout
// stays sensible at any window size; everything else is a fixed knob.
// ---------------------------------------------------------------------
const CONFIG = {
  // year-view ball sizing (auto, fraction of min(width,height))
  minBallRadiusFrac: 0.032,
  maxBallRadiusFrac: 0.125,
  minBallRadius: 30,
  maxBallRadius: 110,

  // year-view physics
  ballRestitution: 0.55,
  ballFrictionAir: 0.15,
  centerForceStrength: 0.00001, // force per ms scaling toward viewport center
  pushSpeedThreshold: 14, // px/frame smoothed pointer speed before a push fires
  pushScale: 0.8,
  pushMaxImpulse: 10,
  selectTransitionMs: 600,

  // hub sizing (auto)
  hubRadiusFrac: 0.095,
  hubRadius: 70,

  // video-view spring layout
  nodeRadiusFrac: 0.0055,
  nodeRadius: 5,
  collidePadding: 2.5,
  linkDistanceFrac: 0.25,
  linkDistance: 200,
  linkStrength: 0.35,
  chargeStrength: 55,
  videoAlphaDecay: 0.02,
  videoVelocityDecay: 0.35,
  clusterStrength: 0.5,
};

function computeResponsiveConfig(width, height) {
  const m = Math.min(width, height);
  CONFIG.minBallRadius = m * CONFIG.minBallRadiusFrac;
  CONFIG.maxBallRadius = m * CONFIG.maxBallRadiusFrac;
  CONFIG.hubRadius = m * CONFIG.hubRadiusFrac;
  CONFIG.nodeRadius = Math.max(4, m * CONFIG.nodeRadiusFrac);
  CONFIG.linkDistance = m * CONFIG.linkDistanceFrac;
}

// --- setup -------------------------------------------------------------

const canvas = document.getElementById("stage");
const backBtn = document.getElementById("backBtn");
let ctx, width, height;

const yearView = new YearView(CONFIG);
const videoView = new VideoView(CONFIG);
let state = "year"; // 'year' | 'video'
let years = null;

function resize() {
  const fit = fitCanvasToWindow(canvas);
  ctx = fit.ctx;
  width = fit.width;
  height = fit.height;
  computeResponsiveConfig(width, height);
  yearView.resize(width, height);
  videoView.resize(width, height);
}

window.addEventListener("resize", resize);

// --- view switching ------------------------------------------------

yearView.onSelectYear = (yearData) => {
  state = "video";
  videoView.setYear(yearData);
  backBtn.classList.remove("hidden");
};

function goBackToYears() {
  if (state !== "video") return;
  hideTooltip();
  canvas.style.transition = "opacity 220ms ease";
  canvas.style.opacity = "0";
  window.setTimeout(() => {
    state = "year";
    yearView.setData(years); // rebuild fresh so balls re-appear and settle
    backBtn.classList.add("hidden");
    canvas.style.opacity = "1";
  }, 220);
}

backBtn.addEventListener("click", goBackToYears);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") goBackToYears();
});

// --- language toggle -----------------------------------------------
// Text is re-applied by i18n.js and the tooltip; canvas text reads the
// active language every frame, so nothing in the simulations is touched.

const langButtons = document.querySelectorAll("#langToggle button");
function syncLangToggle() {
  for (const b of langButtons) {
    const active = b.dataset.lang === getLang();
    b.setAttribute("aria-pressed", String(active));
    b.classList.toggle("active", active);
  }
}
for (const b of langButtons) {
  b.addEventListener("click", () => setLang(b.dataset.lang));
}
onLangChange(syncLangToggle);
syncLangToggle();

// --- pointer events (delegated to the active view) ---------------------

function activeView() {
  return state === "year" ? yearView : videoView;
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener("mousemove", (e) => {
  const { x, y } = pointerPos(e);
  activeView().handleMouseMove(x, y);
  canvas.style.cursor = activeView().cursorStyle();
});

// A click only counts if it both started and ended on the canvas while the
// welcome popup is closed (otherwise closing the popup would click the ball
// underneath it).
const welcomeEl = document.getElementById("welcome");
const welcomeOpen = () => !welcomeEl.classList.contains("hidden");
let pressedOnCanvas = false;

canvas.addEventListener("mousedown", (e) => {
  if (welcomeOpen()) return;
  pressedOnCanvas = true;
  const { x, y } = pointerPos(e);
  activeView().handleMouseDown(x, y);
});

window.addEventListener("mouseup", (e) => {
  if (!pressedOnCanvas) return;
  pressedOnCanvas = false;
  if (welcomeOpen()) return;
  const { x, y } = pointerPos(e);
  activeView().handleMouseUp(x, y);
  canvas.style.cursor = activeView().cursorStyle();
});

canvas.addEventListener("mouseleave", () => {
  activeView().handleMouseLeave();
});

// --- main loop -----------------------------------------------------

let lastT = performance.now();
function frame(now) {
  const dt = now - lastT;
  lastT = now;

  if (state === "year") {
    yearView.update(dt);
    yearView.render(ctx);
  } else {
    videoView.update(dt);
    videoView.render(ctx);
  }

  requestAnimationFrame(frame);
}

// --- boot ------------------------------------------------------------

async function boot() {
  resize();
  await ensureFonts(); // so canvas text is measured with the real fonts
  const data = await loadVideos();
  years = data.years;
  yearView.setData(years);
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error("Failed to load video data", err);
});
