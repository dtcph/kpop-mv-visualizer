// First-visit welcome popup, remembered with a cookie.
const COOKIE = 'kpopmv_visited';

function hasVisited() {
  return document.cookie.split('; ').some((c) => c.startsWith(COOKIE + '='));
}

function markVisited() {
  document.cookie = `${COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

export function initWelcome() {
  if (hasVisited()) return;
  const el = document.getElementById('welcome');
  const close = () => {
    el.classList.add('hidden');
    markVisited();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.getElementById('welcomeClose').addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', onKey, true);
  el.classList.remove('hidden');
}
