// Shared small helpers: math, color, canvas/DPR setup, cheap glow sprites.

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// easeOutCubic, used for the year->hub morph transition
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Sets up a canvas for crisp rendering on retina screens.
// Returns the 2d context; call again on resize.
export function fitCanvasToWindow(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: w, height: h, dpr };
}

// Neon spectrum stops, sampled across the 1995-2020 timeline.
const PALETTE_STOPS = ['#23e8ff', '#9b5bff', '#ff2fd0', '#ff5f6d', '#ffb020', '#d6ff2f'];

export function makeYearColorScale(minYear, maxYear) {
  const scale = d3.scaleLinear()
    .domain(PALETTE_STOPS.map((_, i) => minYear + (i * (maxYear - minYear)) / (PALETTE_STOPS.length - 1)))
    .range(PALETTE_STOPS)
    .interpolate(d3.interpolateRgb);
  return (year) => scale(clamp(year, minYear, maxYear));
}

// sqrt scaling so that AREA is proportional to count.
export function makeRadiusScale(counts, minR, maxR) {
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  const sqrtLo = Math.sqrt(lo);
  const sqrtHi = Math.sqrt(hi);
  return (count) => {
    if (sqrtHi === sqrtLo) return (minR + maxR) / 2;
    const t = (Math.sqrt(count) - sqrtLo) / (sqrtHi - sqrtLo);
    return lerp(minR, maxR, t);
  };
}

// Pre-renders a radial-gradient glow sprite for a ball color/radius so we
// never call shadowBlur per-frame on many shapes.
export function makeGlowSprite(color, radius) {
  const pad = radius * 0.4;
  const size = Math.ceil((radius + pad) * 2);
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const c = off.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  // soft halo, kept subtle so many balls don't wash the background out
  const grad = c.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius + pad);
  grad.addColorStop(0, colorWithAlpha(color, 0.5));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  c.fillStyle = grad;
  c.beginPath();
  c.arc(cx, cy, radius + pad, 0, Math.PI * 2);
  c.fill();

  // solid core on top, with a touch of shading for depth
  const core = c.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
  core.addColorStop(0, colorWithAlpha('#ffffff', 0.35));
  core.addColorStop(0.35, color);
  core.addColorStop(1, color);
  c.fillStyle = core;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.fill();

  return { canvas: off, size };
}

function colorWithAlpha(hex, alpha) {
  const c = d3.color(hex);
  c.opacity = alpha;
  return c.toString();
}

export { colorWithAlpha };

// Simple deterministic hash for artist-based coloring (used later).
export function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return d3.hsl(hue, 0.75, 0.6).toString();
}

// Mapping function stub for coloring video nodes by release type.
// Swap the active "mode" here later to color by artist instead.
const RELEASE_COLORS = {
  Major: '#ff2fd0',
  Minor: '#23e8ff',
  OST: '#d6ff2f',
  CF: '#ffb020',
  Japanese: '#9b5bff',
  Special: '#ff5f6d',
  Chinese: '#5bffb0',
  English: '#ffffff',
};

export function colorForVideo(video, mode = 'uniform', uniformColor = '#23e8ff') {
  if (mode === 'release') return RELEASE_COLORS[video.release] || '#8a8aa0';
  if (mode === 'artist') return hashColor(video.artist);
  return uniformColor;
}
