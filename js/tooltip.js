// DOM-based tooltip that follows the cursor and stays inside the viewport.
// pointer-events is disabled in CSS so it never blocks mouse interaction.

const el = document.getElementById('tooltip');

export function showTooltip(video, x, y) {
  el.innerHTML = renderContent(video);
  el.classList.add('visible');
  el.classList.remove('hidden');
  positionTooltip(x, y);
}

export function hideTooltip() {
  el.classList.remove('visible');
}

export function positionTooltip(x, y) {
  const offset = 16;
  el.style.left = '0px';
  el.style.top = '0px';
  const rect = el.getBoundingClientRect();
  const w = rect.width || 260;
  const h = rect.height || 90;

  let left = x + offset;
  let top = y + offset;

  if (left + w > window.innerWidth - 8) left = x - w - offset;
  if (top + h > window.innerHeight - 8) top = y - h - offset;
  left = Math.max(8, left);
  top = Math.max(8, top);

  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderContent(v) {
  const song = escapeHtml(v.song || '(untitled)');
  const korean = v.korean ? `<div class="tt-korean">${escapeHtml(v.korean)}</div>` : '';
  const rows = [
    ['Artist', v.artist],
    ['Director', v.director || '—'],
    ['Date', v.date],
    ['Type', v.groupType || '—'],
    ['Release', v.release || '—'],
  ];
  const rowsHtml = rows
    .map(([label, val]) => `<div class="tt-row"><b>${label}:</b><span>${escapeHtml(val)}</span></div>`)
    .join('');
  const linkNote = v.hasLink ? '' : '<div class="tt-nolink">no video link</div>';

  return `<div class="tt-song">${song}</div>${korean}${rowsHtml}${linkNote}`;
}
