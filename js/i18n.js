// Language support (KR / EN): dictionary, t(), formatters, font stacks, and
// persistence. Every user-visible string in the app lives in DICT below.
//
// Add a string:   put the same key in every language of DICT, then use
//                 t('key') in JS or data-i18n="key" in index.html.
// Add a language: add a DICT entry + LOCALES / FONT_STACKS / LANGS entries,
//                 then add a segment to the toggle in index.html.

const STORAGE_KEY = 'kpopmv_lang';
const DEFAULT_LANG = 'kr';
const LANGS = ['kr', 'en'];
const LOCALES = { kr: 'ko-KR', en: 'en-US' };
const HTML_LANG = { kr: 'ko', en: 'en' };

const DICT = {
  kr: {
    docTitle: 'K-POP MV 탐색기 1995–2020',
    appTitle: 'K-POP MV 탐색기',
    hint: '마우스를 빠르게 움직여 공을 밀어보세요 · 연도를 클릭해 탐색하세요',
    back: '← 뒤로',
    backAria: '연도 화면으로 돌아가기',
    close: '닫기',
    langGroup: '언어 선택',
    welcomeTitle: 'K-POP MV 탐색기에 오신 것을 환영합니다',
    welcomeP1: '1995~2020년 K-pop 뮤직비디오가 공으로 변신했어요. 공 하나가 연도 하나, 점 하나가 영상 하나!',
    welcomeP2: '마우스를 빠르게 휘둘러 공을 밀어보고, 연도를 클릭해 들어가 보세요. 뒤로 가려면 Esc나 뒤로 버튼! (공은 아파하지 않아요.)',
    year: '{y}년',
    videos: { other: '{n}개 영상' },
    untitled: '(제목 없음)',
    empty: '—',
    noLink: '영상 링크 없음',
    'label.artist': '아티스트',
    'label.director': '감독',
    'label.date': '날짜',
    'label.type': '유형',
    'label.release': '발매',
  },
  en: {
    docTitle: 'K-Pop MV Explorer 1995–2020',
    appTitle: 'K-POP MV EXPLORER',
    hint: 'move the mouse fast to push the balls · click a year to explore',
    back: '← Back',
    backAria: 'Back to years',
    close: 'Close',
    langGroup: 'Language',
    welcomeTitle: 'Welcome to K-POP MV Explorer',
    welcomeP1: 'K-pop music videos from 1995 to 2020, turned into balls. One ball per year, one dot per video.',
    welcomeP2: 'Shove the balls around with your mouse, then click a year to dive in. Esc or Back gets you out. (The balls are fine.)',
    year: '{y}',
    videos: { one: '{n} video', other: '{n} videos' },
    untitled: '(untitled)',
    empty: '—',
    noLink: 'no video link',
    'label.artist': 'Artist',
    'label.director': 'Director',
    'label.date': 'Date',
    'label.type': 'Type',
    'label.release': 'Release',
  },
};

// Canvas + CSS share these stacks. Korean mode puts the Korean web font first
// (Black Han Sans for headings, Noto Sans KR for text).
const KR_BODY = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const KR_DISPLAY = '"Black Han Sans", ' + KR_BODY;
const FONT_STACKS = {
  kr: { display: KR_DISPLAY, body: KR_BODY },
  en: {
    display: 'Unbounded, "Noto Sans KR", sans-serif',
    body: 'Inter, "Noto Sans KR", sans-serif',
  },
};

let lang = readStoredLang();
const listeners = new Set();
const fmtCache = new Map();

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(v)) return v;
  } catch (_) {
    /* storage unavailable: fall back to default */
  }
  return DEFAULT_LANG;
}

export function getLang() {
  return lang;
}

export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    /* ignore */
  }
  applyLanguage();
  for (const cb of listeners) cb(lang);
}

// --- translation ---------------------------------------------------------

// t('key', { n: 5 }): `{name}` placeholders are filled from params. `n` is
// formatted with the active locale and also picks the plural form when the
// entry is an object like { one, other }.
export function t(key, params = {}) {
  let entry = DICT[lang][key];
  if (entry === undefined) entry = DICT[DEFAULT_LANG][key];
  if (entry === undefined) return key;
  if (typeof entry === 'object') {
    const cat = pluralRules().select(Number(params.n));
    entry = entry[cat] ?? entry.other;
  }
  return entry.replace(/\{(\w+)\}/g, (m, name) => {
    if (!(name in params)) return m;
    return name === 'n' ? formatNumber(params[name]) : String(params[name]);
  });
}

// --- formatters ----------------------------------------------------------

function cached(kind, build) {
  const k = kind + lang;
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = build(LOCALES[lang])));
  return f;
}

function pluralRules() {
  return cached('plural', (l) => new Intl.PluralRules(l));
}

export function formatNumber(n) {
  return cached('num', (l) => new Intl.NumberFormat(l)).format(n);
}

export function formatYear(y) {
  return t('year', { y });
}

export function formatCount(n) {
  return t('videos', { n });
}

// Accepts the CSV's ISO date (YYYY-MM-DD); returns the raw string if unparsable.
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || t('empty');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return cached(
    'date',
    (l) => new Intl.DateTimeFormat(l, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  ).format(d);
}

// --- fonts ---------------------------------------------------------------

export function fontStack(role = 'body') {
  return FONT_STACKS[lang][role];
}

// CSS font shorthand for canvas text, e.g. canvasFont('display', 800, 24).
export function canvasFont(role, weight, sizePx) {
  // KR hierarchy: headings/titles 700 (Black Han Sans), text/subtext 400.
  const w = lang === 'kr' ? (role === 'display' ? 700 : 400) : weight;
  return `${w} ${sizePx}px ${fontStack(role)}`;
}

// Resolves once every face used by either language is loaded (or after
// timeoutMs, e.g. offline) so canvas text is never measured with a fallback.
export function ensureFonts(timeoutMs = 4000) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const hangul = '가나다라마바사 년개영상 한국어';
  const loads = [
    document.fonts.load('400 16px "Black Han Sans"', hangul),
    document.fonts.load('400 16px "Noto Sans KR"', hangul),
    document.fonts.load('700 16px "Noto Sans KR"', hangul),
    document.fonts.load('800 16px Unbounded', '0123456789'),
    document.fonts.load('500 16px Inter', 'videos'),
  ];
  const timeout = new Promise((res) => setTimeout(res, timeoutMs));
  return Promise.race([Promise.allSettled(loads), timeout]);
}

// --- DOM -----------------------------------------------------------------

// Fills [data-i18n] (text) and [data-i18n-aria-label] (aria-label) elements.
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  }
}

function applyLanguage() {
  document.documentElement.lang = HTML_LANG[lang];
  document.title = t('docTitle');
  applyI18n();
}

applyLanguage();
