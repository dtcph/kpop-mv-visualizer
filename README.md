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
- `js/i18n.js` — KR/EN dictionary, `t()`, `getLang()/setLang()/onLangChange()`,
  `Intl` formatters (year, count with plurals, date), canvas font stacks, and
  `localStorage` persistence. Loaded before the other modules.
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

## Language (KR / EN)

A two-segment toggle in the top-right corner switches all UI text instantly,
without reloading or touching either simulation.

- **Default:** KR. The choice is saved in `localStorage` (`kpopmv_lang`) and
  restored on load; if storage is unavailable, KR is used.
- `<html lang>` and `document.title` follow the active language.
- **Video data:** the CSV only has a Korean version of song names (`Korean
  Name`). KR mode shows it (falling back to the romanized name) with the
  romanized name as a subtitle; EN mode shows the romanized name. Artist,
  director, type, and release have a single version and are shown unchanged in
  both languages. `getVideoField()` in `js/data.js` does the selection.
- **Formatting:** numbers, dates, and plurals use `Intl` with `ko-KR` / `en-US`
  (e.g. `2020년` / `2020`, `5,000개 영상` / `5,000 videos`, `1 video`).
- **Add or change a string:** add the key to every language in `DICT` in
  `js/i18n.js`, then use `t('key')` in JS or `data-i18n="key"` (text) /
  `data-i18n-aria-label="key"` in `index.html`. Plural entries are objects
  (`{ one, other }`) selected by the `n` parameter.
- **Add a language:** add entries to `DICT`, `LANGS`, `LOCALES`, `HTML_LANG`
  and `FONT_STACKS` in `js/i18n.js`, plus a button (`data-lang`) in the toggle.
- **Korean font:** in KR mode (`:root:lang(ko)` in CSS, same stacks on canvas
  via `canvasFont()`), headings and titles (page title, welcome title, year
  labels, tooltip song title) use Black Han Sans at weight 700, and all other
  text and subtext (hint, paragraphs, counts, tooltip rows, buttons) use Noto
  Sans KR at 400. Black Han Sans has a single weight, so faux bold is disabled.
  `ensureFonts()` waits for the fonts before the first frame. EN keeps
  Unbounded / Inter.
