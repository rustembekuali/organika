// Іздеу: қазақша, орысша және халықаралық атаулар, формулалар, ғалымдар, реагенттер
import { REACTIONS, eqOf } from '../data/index';
import { SUB } from '../data/substances';
import { TOPIC, TYPE_NAMES } from '../data/topics';
import { NAMED_BY_ID } from '../data/named';
import type { Reaction } from '../data/types';
import { hillFormula } from './chem';

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[₀-₉]/g, (d) => String(SUBS.indexOf(d)))
    .replace(/[⁺⁻]/g, '')
    .replace(/[–—−]/g, '-');
}
/** Формулалардағы сызықшалар мен жақшаларды алып тастау */
export const squash = (s: string) => norm(s).replace(/[\s\-=≡()[\]·^+,.]/g, '');

const EN: Record<string, string> = {
  wurtz: 'wurtz вюрц', 'wurtz-fittig': 'wurtz fittig вюрц фиттиг', dumas: 'dumas дюма', kolbe: 'kolbe кольбе',
  konovalov: 'konovalov коновалов', wagner: 'wagner вагнер', kucherov: 'kucherov кучеров', lebedev: 'lebedev лебедев',
  zinin: 'zinin зинин', williamson: 'williamson вильямсон уильямсон', 'fischer-tropsch': 'fischer tropsch фишер тропш',
  zelinsky: 'zelinsky зелинский казанский', butlerov: 'butlerov бутлеров', 'friedel-crafts': 'friedel crafts фридель крафтс',
  grignard: 'grignard гриньяр', markovnikov: 'markovnikov марковников', zaitsev: 'zaitsev зайцев',
};

const TYPE_RU: Record<string, string> = {
  subst: 'замещение substitution', add: 'присоединение addition', elim: 'отщепление элиминирование elimination', ox: 'окисление oxidation',
  red: 'восстановление reduction', comb: 'горение combustion', poly: 'полимеризация polymerization', polycond: 'поликонденсация',
  hydrol: 'гидролиз hydrolysis', isom: 'изомеризация', ester: 'этерификация esterification', acidbase: 'нейтрализация соль',
  decomp: 'разложение крекинг пиролиз', ferment: 'брожение fermentation', synth: 'синтез', qual: 'качественная реакция', exch: 'обмен',
};

const KK_RU: [RegExp, string][] = [
  [/гидрле/, 'гидрирование'], [/дегидрле/, 'дегидрирование'], [/бромда/, 'бромирование'], [/хлорла/, 'хлорирование'],
  [/нитрле/, 'нитрование'], [/дегидратац/, 'дегидратация'], [/гидратац/, 'гидратация'], [/жану/, 'горение'],
  [/тотық/, 'окисление'], [/полимерлен/, 'полимеризация'], [/сабында/, 'омыление'], [/ашу/, 'брожение'],
  [/алкилде/, 'алкилирование'], [/сульфирле/, 'сульфирование'], [/изомерлен/, 'изомеризация'], [/күміс айна/, 'серебряного зеркала'],
];

export interface Indexed { r: Reaction; text: string; flat: string }

function substanceText(id: string): string {
  const s = SUB[id];
  if (!s) return '';
  let h = '';
  try { if (!/[а-я]/i.test(s.cf)) h = hillFormula(s.cf); } catch { /* */ }
  return [s.name, ...(s.alt ?? []), s.cf, s.sf ?? '', h].join(' ');
}

export const INDEX: Indexed[] = REACTIONS.map((r) => {
  const e = eqOf(r);
  const subs = e ? [...e.left, ...e.right].map((t) => substanceText(t.id)).join(' ') : r.scheme ?? '';
  const topics = r.at.map((a) => TOPIC[a.split(':')[0]]?.name).join(' ');
  const named = [r.nm, r.rule].filter(Boolean).map((n) => `${NAMED_BY_ID[n!]?.name} ${NAMED_BY_ID[n!]?.scientist} ${EN[n!] ?? ''}`).join(' ');
  const ru = KK_RU.filter(([re]) => re.test(r.t.toLowerCase())).map(([, w]) => w).join(' ');
  const text = norm([r.t, subs, topics, named, TYPE_NAMES[r.ty], TYPE_RU[r.ty], r.c ?? '', ru, r.q ? 'сапалық реакция качественная' : ''].join(' '));
  return { r, text, flat: squash(text) };
});

export function searchReactions(q: string, base: Reaction[] = REACTIONS): Reaction[] {
  const query = norm(q).trim();
  if (!query) return base;
  const tokens = query.split(/\s+/).filter(Boolean);
  const allowed = new Set(base.map((r) => r.id));
  const scored: { r: Reaction; score: number }[] = [];
  for (const it of INDEX) {
    if (!allowed.has(it.r.id)) continue;
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const sq = squash(t);
      if (it.text.includes(t)) score += 2;
      else if (sq && it.flat.includes(sq)) score += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (norm(it.r.t).includes(query)) score += 5;
    scored.push({ r: it.r, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.r);
}

/** Заттарды іздеу (метро мен селекторлар үшін) */
export function searchSubstances(q: string, ids: string[]): string[] {
  const query = norm(q).trim();
  if (!query) return ids;
  const sq = squash(query);
  const rank = (id: string): number => {
    const s = SUB[id];
    if (squash(s.cf) === sq || squash(s.sf ?? '') === sq) return 0;
    const nm = norm(s.name);
    if (nm === query || norm(s.name.replace(/\s*\(.*$/, '')) === query) return 1;
    if ((s.alt ?? []).some((a) => norm(a) === query || squash(a) === sq)) return 2;
    if (nm.startsWith(query)) return 3;
    const t = norm(substanceText(id));
    if (t.includes(query)) return 4;
    if (squash(t).includes(sq)) return 5;
    return 99;
  };
  return ids.map((id) => [id, rank(id)] as const).filter(([, r]) => r < 99).sort((a, b) => a[1] - b[1]).map(([id]) => id);
}
