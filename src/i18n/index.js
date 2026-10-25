// Internationalisation: UI strings per language and localized copies of the epoch content.
import en from './ui/en.js';
import ru from './ui/ru.js';
import es from './ui/es.js';
import de from './ui/de.js';
import fr from './ui/fr.js';
import pt from './ui/pt.js';
import { CONTENT } from './content/index.js';
import { EPOCHS, AXES, OUTCOME_MATRIX } from '../data/epochs.js';

const UI = { en, ru, es, de, fr, pt };
export const LANGS = ['en', 'ru', 'es', 'de', 'fr', 'pt'];
const STORE = 'kairos.lang';

let current = 'en';
const listeners = new Set();
let epochCache = null;

export function detectLang() {
  const hash = (location.hash || '').replace('#', '').toLowerCase();
  if (LANGS.includes(hash)) return hash;
  try { const s = localStorage.getItem(STORE); if (s && LANGS.includes(s)) return s; } catch (e) { /* storage unavailable */ }
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).slice(0, 2).toLowerCase());
  for (const p of prefs) if (LANGS.includes(p)) return p;
  return 'en';
}

export function getLang() { return current; }
export function langName(code) { return (UI[code] || UI.en)['lang.name']; }

export function setLang(code, { persist = true } = {}) {
  if (!LANGS.includes(code)) code = 'en';
  current = code;
  epochCache = null;
  document.documentElement.lang = code;
  if (persist) { try { localStorage.setItem(STORE, code); } catch (e) { /* ignore */ } }
  listeners.forEach((fn) => fn(code));
}
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function t(key, vars) {
  const d = UI[current] || UI.en;
  let s = d[key] ?? UI.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  return s;
}

export function tAxes() {
  return AXES.map((ax) => ({ ...ax, neg: t(`axis.${ax.key}.neg`), pos: t(`axis.${ax.key}.pos`) }));
}
export function tAxis(key) { return tAxes().find((a) => a.key === key); }

export function tOutcomes() {
  return OUTCOME_MATRIX.map((r, i) => ({ ...r, outcome: t(`outcome.${i}`), example: t(`outcome.${i}.ex`) }));
}

// A localized copy of an epoch: text fields replaced, numbers and structure untouched.
export function tEpoch(e) {
  if (current === 'en') return e;
  const c = CONTENT[current]?.[e.id];
  if (!c) return e;
  return {
    ...e,
    name: c.name ?? e.name, short: c.short ?? e.short, tagline: c.tagline ?? e.tagline, need: c.need ?? e.need,
    environment: c.environment ?? e.environment, skills: c.skills ?? e.skills, archetypes: c.archetypes ?? e.archetypes,
    artists: e.artists.map((a, i) => ({ ...a, ...(c.artists?.[i] || {}) })),
  };
}
export function tEpochs() {
  if (!epochCache) epochCache = EPOCHS.map(tEpoch);
  return epochCache;
}
export function tEpochById(id) { return tEpochs().find((e) => e.id === id); }
