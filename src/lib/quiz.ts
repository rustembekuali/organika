// Жаттығу сұрақтарының генераторлары. Әр сұрақтың кілті бар — қате жауаптар қайталау тізіміне осы кілтпен түседі.
import { REACTIONS, RX, eqOf, usable, isOrganic } from '../data/index';
import { SUB, SUBSTANCES, formulaOf } from '../data/substances';
import { FIND_ERRORS, IDENTIFY } from '../data/exercises';
import { NAMED_BY_ID } from '../data/named';
import type { Reaction, Term } from '../data/types';
import { checkBalance, coefValue } from './chem';
import { shuffle, formulaText, shortName, reagentText } from './format';
import { EDGES, OUT, distTo, STATION_IDS, reagentOf, bestReaction } from './graph';

export type Mode = 'product' | 'reagent' | 'error' | 'identify' | 'chain' | 'named';

export const MODE_INFO: Record<Mode, { title: string; desc: string }> = {
  product: { title: 'Өнімді тап', desc: 'Реагенттер мен шарттар берілген — өнімді таңда.' },
  reagent: { title: 'Реагентті таңда', desc: 'Бастапқы зат пен өнім берілген — реагент пен шартты таңда.' },
  error: { title: 'Қатені тап', desc: 'Теңдеудегі қате коэффициентті, өнімді немесе шартты тап.' },
  identify: { title: 'Затты анықта', desc: 'Сапалық реакция белгілері бойынша затты ажырат.' },
  chain: { title: 'Айналу тізбегі', desc: 'Бірнеше қадамдық тізбектегі белгісіз заттарды тап.' },
  named: { title: 'Атаулы реакциялар', desc: 'Ғалымдардың атымен аталған реакциялар мен ережелер.' },
};

export interface Option { label: string; kind: 'sub' | 'text' | 'reagent'; id?: string; why?: string; terms?: { k: string; id: string }[]; cond?: string }

export interface MCQ {
  type: 'mcq';
  key: string;
  mode: Mode;
  rid?: string;
  /** Сұрақтың мазмұны: теңдеудің бір бөлігі немесе мәтін */
  stem: { left?: Term[]; right?: Term[]; cond?: string; text?: string; clues?: string[]; askRight?: boolean };
  question: string;
  options: Option[];
  answer: number;
  explain: string;
}

export interface ErrorQ {
  type: 'error';
  key: string;
  mode: 'error';
  rid?: string;
  parts: string[];
  cond?: string;
  bad: number | 'cond';
  fix: string;
  why: string;
}

export interface ChainQ {
  type: 'chain';
  key: string;
  mode: 'chain';
  nodes: string[];
  rids: string[];
  hidden: number[];
  options: Record<number, string[]>;
}

export type Question = MCQ | ErrorQ | ChainQ;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const uniq = <T,>(a: T[]) => [...new Set(a)];

const QUIZ_POOL = REACTIONS.filter((r) => usable(r) && r.eq);

function mainProduct(r: Reaction): string | null {
  const e = eqOf(r)!;
  return e.right.map((t) => t.id).find(isOrganic) ?? null;
}
function mainReactant(r: Reaction): string | null {
  const e = eqOf(r)!;
  return e.left.map((t) => t.id).find(isOrganic) ?? null;
}
const leftSet = (r: Reaction) => eqOf(r)!.left.map((t) => t.id).sort().join('|');

// ───────── «Өнімді тап»
export const PRODUCT_POOL = QUIZ_POOL.filter((r) => r.ty !== 'comb' && mainProduct(r) && SUB[mainProduct(r)!].sf);

export function productQ(rid?: string): MCQ {
  const r = rid ? RX[rid] : pick(PRODUCT_POOL);
  const e = eqOf(r)!;
  const correct = mainProduct(r)!;
  const rightIds = new Set(e.right.map((t) => t.id));
  const forbidden = new Set<string>(rightIds);
  // бірдей реагенттер мен шарттағы басқа реакциялардың өнімдері де дұрыс болып шығуы мүмкін — оларды алып тастаймыз
  for (const o of QUIZ_POOL) if (o.id !== r.id && leftSet(o) === leftSet(r) && (o.c ?? '') === (r.c ?? '')) eqOf(o)!.right.forEach((t) => forbidden.add(t.id));
  const reactants = e.left.map((t) => t.id).filter(isOrganic);
  const poolA = r.trap ?? [];
  const poolB = QUIZ_POOL.filter((o) => o.id !== r.id && eqOf(o)!.left.some((t) => reactants.includes(t.id))).map(mainProduct).filter(Boolean) as string[];
  const cls = SUB[correct].cls;
  const poolC = SUBSTANCES.filter((s) => s.cls === cls && s.sf && s.id !== correct).map((s) => s.id);
  const topic = r.at[0].split(':')[0];
  const poolD = QUIZ_POOL.filter((o) => o.at.some((a) => a.startsWith(topic + ':'))).map(mainProduct).filter(Boolean) as string[];
  const opts: string[] = [];
  for (const pool of [shuffle(poolA), shuffle(uniq(poolB)), shuffle(uniq(poolC)), shuffle(uniq(poolD))]) {
    for (const c of pool) {
      if (opts.length >= 3) break;
      if (!forbidden.has(c) && !opts.includes(c) && SUB[c]?.sf) opts.push(c);
    }
  }
  const all = shuffle([correct, ...opts]);
  const trapWhy = (id: string) => {
    if (r.trap?.includes(id)) return `${shortName(id)} — бұл жағдайда негізгі өнім емес (${r.rule ? NAMED_BY_ID[r.rule].name : 'реакция бағыты'}).`;
    const other = QUIZ_POOL.find((o) => o.id !== r.id && eqOf(o)!.right.some((t) => t.id === id) && eqOf(o)!.left.some((t) => reactants.includes(t.id)));
    if (other) return `${shortName(id)} басқа реакцияда түзіледі: «${other.t}»${other.c ? ' (' + other.c + ')' : ''}.`;
    return `${shortName(id)} бұл реагенттерден осы шартта түзілмейді.`;
  };
  return {
    type: 'mcq', key: 'product:' + r.id, mode: 'product', rid: r.id,
    stem: { left: e.left, cond: r.c, askRight: true },
    question: 'Негізгі органикалық өнім қандай?',
    options: all.map((id) => ({ label: formulaText(id), kind: 'sub', id, why: id === correct ? undefined : trapWhy(id) })),
    answer: all.indexOf(correct),
    explain: r.x,
  };
}

// ───────── «Реагентті таңда»
export const REAGENT_POOL = QUIZ_POOL.filter((r) => mainReactant(r) && mainProduct(r) && mainReactant(r) !== mainProduct(r) && r.ty !== 'comb');

const reagentLabel = (terms: { k: string; id: string }[], cond?: string) => reagentText(terms, cond);

export function reagentQ(rid?: string): MCQ {
  const r = rid ? RX[rid] : pick(REAGENT_POOL);
  const from = mainReactant(r)!, to = mainProduct(r)!;
  const corr = reagentOf(r, from);
  const corrLabel = reagentLabel(corr.terms, corr.cond);
  const opts: Option[] = [];
  const seen = new Set([corrLabel]);
  const same = shuffle(REAGENT_POOL.filter((o) => o.id !== r.id && mainReactant(o) === from && !eqOf(o)!.right.some((t) => t.id === to)));
  for (const o of same) {
    const g = reagentOf(o, from);
    const label = reagentLabel(g.terms, g.cond);
    if (seen.has(label) || opts.length >= 3) continue;
    seen.add(label);
    opts.push({ label, kind: 'reagent', terms: g.terms, cond: g.cond, why: `Бұл жағдайда ${shortName(from)} басқа өнім береді: ${shortName(mainProduct(o)!)} («${o.t}»).` });
  }
  const topic = r.at[0].split(':')[0];
  const others = shuffle(REAGENT_POOL.filter((o) => o.id !== r.id && mainReactant(o) !== from && o.at.some((a) => a.startsWith(topic + ':'))));
  const fallback = shuffle(REAGENT_POOL.filter((o) => mainReactant(o) !== from));
  for (const o of [...others, ...fallback]) {
    if (opts.length >= 3) break;
    const g = reagentOf(o, mainReactant(o)!);
    const label = reagentLabel(g.terms, g.cond);
    if (seen.has(label)) continue;
    // бұл реагент from → to айналуын базадағы басқа реакция арқылы да жүзеге асырмауы керек
    if (REAGENT_POOL.some((x) => mainReactant(x) === from && eqOf(x)!.right.some((t) => t.id === to) && reagentLabel(reagentOf(x, from).terms, reagentOf(x, from).cond) === label)) continue;
    seen.add(label);
    opts.push({ label, kind: 'reagent', terms: g.terms, cond: g.cond, why: `Бұл реагент пен шарт базада басқа айналу үшін берілген: «${o.t}». ${shortName(from)} → ${shortName(to)} айналуына сәйкес келмейді.` });
  }
  const all = shuffle([{ label: corrLabel, kind: 'reagent' as const, terms: corr.terms, cond: corr.cond }, ...opts]);
  return {
    type: 'mcq', key: 'reagent:' + r.id, mode: 'reagent', rid: r.id,
    stem: { left: [{ k: '', id: from }], right: [{ k: '', id: to }] },
    question: 'Бұл айналуды қандай реагент пен шарт жүзеге асырады?',
    options: all,
    answer: all.findIndex((o) => o.label === corrLabel),
    explain: r.x,
  };
}

// ───────── «Қатені тап»
const AUTO_ERR_POOL = QUIZ_POOL.filter((r) => eqOf(r)!.left.length + eqOf(r)!.right.length >= 3 && !/n/.test(r.eq!));

export function errorQ(key?: string): ErrorQ {
  if (key?.startsWith('error:auto:') || (!key && Math.random() < 0.35)) return autoErrorQ(key);
  const fe = key ? FIND_ERRORS.find((f) => 'error:' + f.id === key)! : pick(FIND_ERRORS);
  return { type: 'error', key: 'error:' + fe.id, mode: 'error', rid: fe.rid, parts: fe.parts, cond: fe.cond, bad: fe.bad, fix: fe.fix, why: fe.why };
}

function autoErrorQ(key?: string): ErrorQ {
  let r: Reaction, idx: number, newK: string;
  if (key) {
    const [, , rid, i, k] = key.split(':');
    r = RX[rid]; idx = +i; newK = k;
  } else {
    for (;;) {
      r = pick(AUTO_ERR_POOL);
      const e = eqOf(r)!;
      const terms = [...e.left, ...e.right];
      idx = Math.floor(Math.random() * terms.length);
      const v = coefValue(terms[idx].k);
      const cands = [v + 1, v - 1, v * 2].filter((x) => x >= 1 && x !== v);
      newK = String(pick(cands));
      if (newK === '1') newK = '';
      const mut = { left: e.left.map((t) => ({ ...t })), right: e.right.map((t) => ({ ...t })), rev: e.rev };
      const all = [...mut.left, ...mut.right];
      all[idx].k = newK;
      if (!checkBalance(mut, formulaOf).ok) break;
    }
  }
  const e = eqOf(r)!;
  const terms = [...e.left, ...e.right];
  const parts: string[] = [];
  let partIdx = -1;
  terms.forEach((t, i) => {
    if (i === e.left.length) parts.push(e.rev ? '⇌' : '→');
    else if (i > 0) parts.push('+');
    const k = i === idx ? newK : t.k;
    if (i === idx) partIdx = parts.length;
    parts.push((k ?? '') + formulaText(t.id, 'cf'));
  });
  const mut = { left: e.left.map((t) => ({ ...t })), right: e.right.map((t) => ({ ...t })), rev: e.rev };
  [...mut.left, ...mut.right][idx].k = newK;
  const b = checkBalance(mut, formulaOf);
  const diff = b.elements.filter((el) => (b.left[el] || 0) !== (b.right[el] || 0)).map((el) => `${el}: сол жақта ${b.left[el] || 0}, оң жақта ${b.right[el] || 0}`).join('; ');
  const orig = terms[idx];
  return {
    type: 'error', key: `error:auto:${r.id}:${idx}:${newK}`, mode: 'error', rid: r.id, parts, cond: r.c, bad: partIdx,
    fix: (orig.k || '1') + ' · ' + formulaText(orig.id, 'cf'),
    why: `Коэффициент қате: атомдар теңестірілмеген (${diff}). Дұрыс коэффициент — ${orig.k || '1'}.`,
  };
}

// ───────── «Затты анықта»
export function identifyQ(key?: string): MCQ {
  const it = key ? IDENTIFY.find((x) => 'identify:' + x.id === key)! : pick(IDENTIFY);
  const opts = shuffle(it.options);
  return {
    type: 'mcq', key: 'identify:' + it.id, mode: 'identify', rid: it.rids?.[0],
    stem: { clues: it.clues },
    question: 'Бұл қандай зат?',
    options: opts.map((id) => ({ label: SUB[id].name, kind: 'text', id })),
    answer: opts.indexOf(it.answer),
    explain: it.why,
  };
}

// ───────── «Айналу тізбегі»
export function chainQ(key?: string): ChainQ {
  let nodes: string[], rids: string[];
  if (key) {
    const [n, r] = key.slice('chain:'.length).split('|');
    nodes = n.split(','); rids = r.split(',');
  } else {
    for (;;) {
      const start = pick(STATION_IDS);
      const len = 3;
      const path = [start];
      const rs: string[] = [];
      let ok = true;
      for (let i = 0; i < len; i++) {
        const outs = (OUT[path[path.length - 1]] ?? []).filter((e) => !path.includes(e.to));
        if (!outs.length) { ok = false; break; }
        const e = pick(outs);
        path.push(e.to);
        rs.push(bestReaction(e).id);
      }
      if (!ok) continue;
      // тізбек ең қысқа жол болсын — сонда әр қадам мағыналы
      const d = distTo(path[path.length - 1]);
      if (d[path[0]] !== len) continue;
      nodes = path; rids = rs;
      break;
    }
  }
  const hidden = [1, 2];
  const options: Record<number, string[]> = {};
  for (const h of hidden) {
    const correct = nodes[h];
    const prev = nodes[h - 1];
    const fromPrev = (OUT[prev] ?? []).map((e) => e.to).filter((x) => x !== correct);
    const sameCls = STATION_IDS.filter((x) => SUB[x].cls === SUB[correct].cls && x !== correct);
    const rest = STATION_IDS.filter((x) => x !== correct);
    const opts: string[] = [];
    for (const pool of [shuffle(fromPrev), shuffle(sameCls), shuffle(rest)]) for (const c of pool) if (opts.length < 3 && !opts.includes(c) && !nodes.includes(c)) opts.push(c);
    options[h] = shuffle([correct, ...opts]);
  }
  return { type: 'chain', key: `chain:${nodes.join(',')}|${rids.join(',')}`, mode: 'chain', nodes, rids, hidden, options };
}

// ───────── Атаулы реакциялар бойынша сұрақ
export function namedQ(key?: string): MCQ {
  const ids = Object.keys(NAMED_BY_ID);
  const id = key ? key.slice('named:'.length) : pick(ids);
  const n = NAMED_BY_ID[id];
  return {
    type: 'mcq', key: 'named:' + id, mode: 'named', rid: n.examples[0],
    stem: { text: n.name + ' · ' + n.scientist },
    question: n.quiz.q,
    options: n.quiz.options.map((o) => ({ label: o, kind: 'text' })),
    answer: n.quiz.answer,
    explain: n.quiz.why,
  };
}

export function makeQ(mode: Mode, key?: string): Question {
  switch (mode) {
    case 'product': return productQ(key?.slice('product:'.length));
    case 'reagent': return reagentQ(key?.slice('reagent:'.length));
    case 'error': return errorQ(key);
    case 'identify': return identifyQ(key);
    case 'chain': return chainQ(key);
    case 'named': return namedQ(key);
  }
}

export function fromKey(key: string): Question {
  return makeQ(key.split(':')[0] as Mode, key);
}

export { EDGES };
