// Прогресс браузерде сақталады (localStorage). Сақтау мүмкін болмаса, сайт жадта жұмыс істей береді.
import { useSyncExternalStore } from 'react';

export interface Progress {
  /** Оқушының аты (тіркелусіз, тек осы браузерде) */
  name?: string;
  viewed: Record<string, number>;
  topics: Record<string, number>;
  lastTopic?: string;
  favorites: string[];
  results: Record<string, { ok: number; total: number }>;
  history: { key: string; ok: boolean; ts: number }[];
  review: string[];
  theme: 'dark' | 'light' | 'auto';
  motion: 'auto' | 'reduce';
  formula: 'sf' | 'hill';
  /** Пайдаланушы қолмен қосқан реакциялар (тексерілмеген) */
  custom: CustomReaction[];
  /** Атау жаттығуы: бөлім бойынша ең жақсы нәтиже (10-нан), раундтар саны, дұрыс табылған атаулар */
  names?: { best: Record<string, number>; rounds: number; learned: string[] };
  /** Оқу зертханасында жүргізілген реакциялар */
  labRuns?: string[];
  /** Таныстыру нұсқаулығы көрсетілді ме */
  onboarded?: boolean;
  /** Флэш-карталар: карта id → Лейтнер қорабы (0 — білмейді, 3 — толық меңгерді) және соңғы қаралған уақыт */
  cards?: Record<string, { box: number; ts: number }>;
}

export interface CustomReaction {
  id: string;
  t: string;
  left: { k: string; id: string }[];
  right: { k: string; id: string }[];
  c?: string;
  ty: string;
  x?: string;
  ts: number;
}

const KEY = 'organika-v1';
const OLD_KEYS = ['organika-lab-v1'];
const empty = (): Progress => ({ viewed: {}, topics: {}, favorites: [], results: {}, history: [], review: [], theme: 'auto', motion: 'auto', formula: 'sf', custom: [] });

let state: Progress = load();
let persisted = true;
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    let raw = localStorage.getItem(KEY);
    // бұрынғы нұсқадан көшіру
    if (!raw) for (const k of OLD_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch { /* сақтау қолжетімсіз */ }
  return empty();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); persisted = true; } catch { persisted = false; }
}

// Басқа бетте (қойындыда) өзгерсе, жаңарту
try {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = { ...empty(), ...JSON.parse(e.newValue) }; listeners.forEach((l) => l()); } catch { /* */ }
  });
} catch { /* */ }

/** Прогресті басқа құрылғыға көшіруге арналған код (JSON → base64) */
export function exportCode(): string {
  const { theme, motion, formula, ...rest } = state;
  void theme; void motion; void formula;
  const json = JSON.stringify({ v: 1, ...rest });
  return 'ORG1-' + btoa(unescape(encodeURIComponent(json)));
}

/** Кодты немесе JSON файлды қабылдап, прогрессті біріктіру. Сәтті болса — true */
export function importCode(input: string): boolean {
  try {
    const txt = input.trim();
    const json = txt.startsWith('ORG1-') ? decodeURIComponent(escape(atob(txt.slice(5).replace(/\s+/g, '')))) : txt;
    const data = JSON.parse(json) as Partial<Progress> & { v?: number };
    if (typeof data !== 'object' || !data || !('viewed' in data)) return false;
    update((p) => {
      p.name = data.name || p.name;
      p.viewed = { ...p.viewed, ...(data.viewed ?? {}) };
      p.topics = { ...p.topics, ...(data.topics ?? {}) };
      p.lastTopic = data.lastTopic ?? p.lastTopic;
      p.favorites = [...new Set([...(data.favorites ?? []), ...p.favorites])];
      const res = { ...p.results };
      for (const [m, r] of Object.entries(data.results ?? {})) {
        const cur = res[m] ?? { ok: 0, total: 0 };
        res[m] = cur.total >= r.total ? cur : r;
      }
      p.results = res;
      p.history = [...(data.history ?? []), ...p.history].sort((a, b) => b.ts - a.ts).slice(0, 80);
      p.review = [...new Set([...(data.review ?? []), ...p.review])].slice(0, 200);
      if (data.names) {
        const n = p.names ?? { best: {}, rounds: 0, learned: [] };
        const best = { ...n.best };
        for (const [k, v] of Object.entries(data.names.best ?? {})) best[k] = Math.max(best[k] ?? 0, v);
        p.names = { best, rounds: Math.max(n.rounds, data.names.rounds ?? 0), learned: [...new Set([...n.learned, ...(data.names.learned ?? [])])] };
      }
      p.labRuns = [...new Set([...(p.labRuns ?? []), ...(data.labRuns ?? [])])];
      if (data.cards) {
        const c = { ...(p.cards ?? {}) };
        for (const [k, v] of Object.entries(data.cards)) if (!c[k] || c[k].ts < v.ts) c[k] = v;
        p.cards = c;
      }
      const ids = new Set(p.custom.map((c) => c.id));
      p.custom = [...p.custom, ...(data.custom ?? []).filter((c) => !ids.has(c.id))];
    });
    return true;
  } catch { return false; }
}

export function setName(name: string) {
  update((p) => { p.name = name.trim().slice(0, 40) || undefined; });
}

export function update(fn: (p: Progress) => Progress | void) {
  const draft: Progress = JSON.parse(JSON.stringify(state));
  const res = fn(draft);
  state = res ?? draft;
  save();
  listeners.forEach((l) => l());
}

export function useProgress(): Progress {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}

export const getProgress = () => state;
export const isPersisted = () => persisted;

export function markViewed(rid: string) {
  if (state.viewed[rid]) return;
  update((p) => { p.viewed[rid] = Date.now(); });
}

export function markTopic(tid: string) {
  update((p) => { p.topics[tid] = Date.now(); p.lastTopic = tid; });
}

export function toggleFav(rid: string) {
  update((p) => {
    p.favorites = p.favorites.includes(rid) ? p.favorites.filter((x) => x !== rid) : [rid, ...p.favorites];
  });
}

export function recordAnswer(mode: string, key: string, ok: boolean) {
  update((p) => {
    const r = (p.results[mode] ??= { ok: 0, total: 0 });
    r.total++;
    if (ok) r.ok++;
    p.history = [{ key, ok, ts: Date.now() }, ...p.history].slice(0, 80);
    if (!ok && !p.review.includes(key)) p.review = [key, ...p.review].slice(0, 200);
    if (ok && p.review.includes(key)) p.review = p.review.filter((k) => k !== key);
  });
}

export function recordNamesRound(part: string, score: number, learned: string[]) {
  update((p) => {
    const n = (p.names ??= { best: {}, rounds: 0, learned: [] });
    n.rounds++;
    n.best[part] = Math.max(n.best[part] ?? 0, score);
    n.learned = [...new Set([...n.learned, ...learned])];
  });
}

export function markLabRun(rid: string) {
  update((p) => { if (!(p.labRuns ?? []).includes(rid)) p.labRuns = [...(p.labRuns ?? []), rid]; });
}

export function rateCard(id: string, known: boolean) {
  update((p) => {
    const c = (p.cards ??= {});
    const cur = c[id]?.box ?? 0;
    c[id] = { box: known ? Math.min(3, cur + 1) : 0, ts: Date.now() };
  });
}

export function resetProgress() {
  const keep = { theme: state.theme, motion: state.motion, formula: state.formula, custom: state.custom, name: state.name, onboarded: state.onboarded };
  state = { ...empty(), ...keep };
  save();
  listeners.forEach((l) => l());
}
