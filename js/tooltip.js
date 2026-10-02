// DOM tooltip that follows the cursor and stays inside the viewport.
// pointer-events is disabled in CSS so it never blocks mouse interaction.
// It sizes to its text (see CSS) and is re-measured on language change.

import { t, formatDate, onLangChange } from './i18n.js';
import { getVideoField } from './data.js';

const el = document.getElementById('tooltip');
let current = null; // { video, x, y } while visible

export function showTooltip(video, x, y) {
  current = { video, x, y };
  el.innerHTML = renderContent(video);
  el.classList.add('visible');
  el.classList.remove('hidden');
  positionTooltip(x, y);
}

export function hideTooltip() {
  current = null;
  el.classList.remove('visible');
}

export function positionTooltip(x, y) {
  const margin = 8;
  const offset = 16;
  el.style.left = '0px';
  el.style.top = '0px';
  const rect = el.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x + offset;
  let top = y + offset;

  if (left + w > vw - margin) left = x - w - offset;
  if (top + h > vh - margin) top = y - h - offset;
  left = Math.min(left, vw - w - margin);
  top = Math.min(top, vh - h - margin);
  left = Math.max(margin, left);
  top = Math.max(margin, top);

  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

// Language switched while open: re-render and re-measure immediately.
onLangChange(() => {
  if (current) showTooltip(current.video, current.x, current.y);
});
// Late web-font arrival changes text metrics; re-clamp.
if (document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    if (current) positionTooltip(current.x, current.y);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderContent(v) {
  const song = escapeHtml(getVideoField(v, 'title') || t('untitled'));
  const sub = getVideoField(v, 'subtitle');
  const subHtml = sub ? `<div class="tt-sub">${escapeHtml(sub)}</div>` : '';
  const dash = t('empty');
  const rows = [
    ['label.artist', getVideoField(v, 'artist') || dash],
    ['label.director', getVideoField(v, 'director') || dash],
    ['label.date', formatDate(v.date)],
    ['label.type', v.groupType || dash],
    ['label.release', v.release || dash],
  ];
  const rowsHtml = rows
    .map(([key, val]) => `<div class="tt-row"><b>${t(key)}</b><span>${escapeHtml(val)}</span></div>`)
    .join('');
  const linkNote = v.hasLink ? '' : `<div class="tt-nolink">${escapeHtml(t('noLink'))}</div>`;

  return `<div class="tt-song">${song}</div>${subHtml}${rowsHtml}${linkNote}`;
}
