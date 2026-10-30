// Реакциялар метросының графы: тек базадағы реакциялардан құрылады
import { REACTIONS, eqOf, usable, RX } from '../data/index';
import { METRO_STATIONS } from '../data/metro';
import { SUB } from '../data/substances';
import type { Reaction } from '../data/types';

export const STATION_IDS = METRO_STATIONS.map((s) => s[0]);
const STATION_SET = new Set(STATION_IDS);

export interface Edge { from: string; to: string; rids: string[] }

export const EDGES: Edge[] = (() => {
  const map = new Map<string, Edge>();
  for (const r of REACTIONS) {
    if (!usable(r)) continue;
    const e = eqOf(r);
    if (!e) continue;
    const L = e.left.map((t) => t.id).filter((id) => STATION_SET.has(id));
    const R = e.right.map((t) => t.id).filter((id) => STATION_SET.has(id));
    for (const a of L) for (const b of R) {
      if (a === b) continue;
      const k = a + '>' + b;
      const ed = map.get(k) ?? { from: a, to: b, rids: [] };
      if (!ed.rids.includes(r.id)) ed.rids.push(r.id);
      map.set(k, ed);
    }
  }
  return [...map.values()];
})();

export const OUT: Record<string, Edge[]> = {};
export const IN: Record<string, Edge[]> = {};
for (const e of EDGES) {
  (OUT[e.from] ??= []).push(e);
  (IN[e.to] ??= []).push(e);
}

/** Мақсатқа дейінгі қашықтық (кері BFS) */
export function distTo(target: string): Record<string, number> {
  const d: Record<string, number> = { [target]: 0 };
  const q = [target];
  while (q.length) {
    const v = q.shift()!;
    for (const e of IN[v] ?? []) if (!(e.from in d)) { d[e.from] = d[v] + 1; q.push(e.from); }
  }
  return d;
}

export interface Path { nodes: string[]; edges: Edge[] }

/** Бірнеше ең қысқа жол (қарапайым жолдар, ең қысқасынан +2 қадамға дейін) */
export function findPaths(from: string, to: string, limit = 5): Path[] {
  if (from === to) return [];
  const d = distTo(to);
  if (!(from in d)) return [];
  const best = d[from];
  const maxLen = Math.min(best + 2, 8);
  const res: Path[] = [];
  const nodes = [from];
  const edges: Edge[] = [];
  const seen = new Set([from]);
  const dfs = (v: string) => {
    if (res.length > 60) return;
    if (v === to) { res.push({ nodes: nodes.slice(), edges: edges.slice() }); return; }
    for (const e of OUT[v] ?? []) {
      if (seen.has(e.to) || !(e.to in d)) continue;
      if (edges.length + 1 + d[e.to] > maxLen) continue;
      seen.add(e.to); nodes.push(e.to); edges.push(e);
      dfs(e.to);
      seen.delete(e.to); nodes.pop(); edges.pop();
    }
  };
  dfs(from);
  const lv = { base: 0, ubt: 1, adv: 2 } as const;
  const cost = (p: Path) => p.edges.reduce((s, e) => s + Math.min(...e.rids.map((r) => lv[RX[r].lv])), 0);
  return res.sort((a, b) => a.edges.length - b.edges.length || cost(a) - cost(b)).slice(0, limit);
}

export function bestReaction(e: Edge): Reaction {
  const lv = { base: 0, ubt: 1, adv: 2 } as const;
  return e.rids.map((r) => RX[r]).sort((a, b) => lv[a.lv] - lv[b.lv])[0];
}

/** Реагент пен шарт: «+ H₂O; H₂SO₄, t°» */
export function reagentOf(r: Reaction, from: string): { terms: { k: string; id: string }[]; cond?: string } {
  const e = eqOf(r);
  if (!e) return { terms: [] };
  let skipped = false;
  const terms = e.left.filter((t) => {
    if (!skipped && t.id === from) { skipped = true; return false; }
    return true;
  }).map((t) => ({ k: t.k, id: t.id }));
  return { terms, cond: r.c };
}

export const stationName = (id: string) => SUB[id]?.name.replace(/\s*\([^()]*\)\s*$/, '') ?? id;

/** Басқа беттен метроға өткенде алдын ала таңдалатын жол */
export const metroIntent: { from?: string; to?: string } = {};
