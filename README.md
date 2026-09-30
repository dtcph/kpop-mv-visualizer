# K-Pop MV Explorer (1995–2020)

An interactive visualization of 5,000+ K-pop music videos: a bouncing bubble
per year on Screen 1, and a spring-graph of every video in a year on Screen 2.

## Run it

Needs a local server (the CSV is loaded with `fetch`, which requires
`http(s)://`, not `file://`):

```
python3 -m http.server 8000
# or
npx serve
```

Then open `http://localhost:8000`.

## Code organization

- `index.html` — page shell, CDN script tags (Matter.js, d3), fonts.
- `style/main.css` — all styling (dark neon theme, tooltip, HUD, back button).
- `js/data.js` — fetches and parses `data/videos.csv`, derives the year from
  the date, filters to 1995–2020, and groups videos by year once at startup.
- `js/utils.js` — math helpers, DPR-aware canvas setup, the year color scale,
  the sqrt radius scale, and pre-rendered glow sprites.
- `js/tooltip.js` — the DOM tooltip that follows the cursor.
- `js/yearView.js` — Screen 1: Matter.js bodies (one per year), a custom
  center force, mouse-push impulses, and the ball → hub selection morph.
- `js/videoView.js` — Screen 2: a manually-stepped d3-force simulation
  (hub + one node per video), canvas rendering, drag, and quadtree-based
  hover hit-testing via `simulation.find()`.
- `js/main.js` — wires it all together: the `CONFIG` tuning object, the
  single `requestAnimationFrame` loop, resize handling, and view switching.

## Tuning knobs (`js/main.js` → `CONFIG`)

- `centerForceStrength` — how strongly year balls are pulled to the center.
- `pushSpeedThreshold` / `pushScale` / `pushMaxImpulse` — mouse-push feel.
- `ballRestitution` / `ballFrictionAir` — bounciness/damping of year balls.
- `linkDistance` / `linkStrength` / `chargeStrength` — spring-graph spacing.
- `videoAlphaDecay` / `videoVelocityDecay` — how fast Screen 2 settles.
- `nodeColor` — uniform node color; `colorForVideo()` in `utils.js` already
  supports coloring by `release` type or by artist if you want to switch
  the mapping later.
