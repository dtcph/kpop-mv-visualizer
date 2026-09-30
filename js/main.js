// Entry point: wires up data loading, canvas setup, the two views, and the
// single requestAnimationFrame loop. All tunable constants live in CONFIG.

import { loadVideos } from './data.js';
import { fitCanvasToWindow } from './utils.js';
import { YearView } from './yearView.js';
import { VideoView } from './videoView.js';
import { hideTooltip } from './tooltip.js';

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
  ballFrictionAir: 0.045,
  centerForceStrength: 0.00006, // force per ms scaling toward viewport center
  pushSpeedThreshold: 14, // px/frame smoothed pointer speed before a push fires
  pushScale: 0.9,
  pushMaxImpulse: 28,
  selectTransitionMs: 600,

  // hub sizing (auto)
  hubRadiusFrac: 0.095,
  hubRadius: 70,

  // video-view spring layout
  nodeRadiusFrac: 0.0055,
  nodeRadius: 5,
  collidePadding: 2.5,
  linkDistanceFrac: 0.24,
  linkDistance: 220,
  linkStrength: 0.35,
  chargeStrength: 55,
  videoAlphaDecay: 0.02,
  videoVelocityDecay: 0.35,
  nodeColor: '#23e8ff',
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

const canvas = document.getElementById('stage');
const backBtn = document.getElementById('backBtn');
let ctx, width, height;

const yearView = new YearView(CONFIG);
const videoView = new VideoView(CONFIG);
let state = 'year'; // 'year' | 'video'
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

window.addEventListener('resize', resize);

// --- view switching ------------------------------------------------

yearView.onSelectYear = (yearData) => {
  state = 'video';
  videoView.setYear(yearData);
  backBtn.classList.remove('hidden');
};

function goBackToYears() {
  if (state !== 'video') return;
  hideTooltip();
  canvas.style.transition = 'opacity 220ms ease';
  canvas.style.opacity = '0';
  window.setTimeout(() => {
    state = 'year';
    yearView.setData(years); // rebuild fresh so balls re-appear and settle
    backBtn.classList.add('hidden');
    canvas.style.opacity = '1';
  }, 220);
}

backBtn.addEventListener('click', goBackToYears);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') goBackToYears();
});

// --- pointer events (delegated to the active view) ---------------------

function activeView() {
  return state === 'year' ? yearView : videoView;
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('mousemove', (e) => {
  const { x, y } = pointerPos(e);
  activeView().handleMouseMove(x, y);
  canvas.style.cursor = activeView().cursorStyle();
});

canvas.addEventListener('mousedown', (e) => {
  const { x, y } = pointerPos(e);
  activeView().handleMouseDown(x, y);
});

window.addEventListener('mouseup', (e) => {
  const { x, y } = pointerPos(e);
  activeView().handleMouseUp(x, y);
  canvas.style.cursor = activeView().cursorStyle();
});

canvas.addEventListener('mouseleave', () => {
  activeView().handleMouseLeave();
});

// --- main loop -----------------------------------------------------

let lastT = performance.now();
function frame(now) {
  const dt = now - lastT;
  lastT = now;

  if (state === 'year') {
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
  const data = await loadVideos();
  years = data.years;
  yearView.setData(years);
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('Failed to load video data', err);
});
