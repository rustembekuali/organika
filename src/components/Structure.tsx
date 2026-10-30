import React, { useMemo } from 'react';
import data from '../data/generated/structures.json';
import { SUB } from '../data/substances';
import { F } from '../lib/format';

type Atom = [number, number, string, number, number, number, string | null];
interface Struct { a: Atom[]; b: [number, number, number][] }
const STRUCTS = (data as unknown as { structures: Record<string, Struct> }).structures;
export const HIGHLIGHTS = (data as unknown as { highlights: Record<string, Record<string, number[]>> }).highlights;
export const hasStructure = (id: string) => !!STRUCTS[id];

const EL_COLORS: Record<string, [string, string]> = {
  O: ['var(--atom-o)', '#fff'], N: ['var(--atom-n)', '#fff'], Cl: ['var(--atom-cl)', '#0b1a0e'], Br: ['var(--atom-br)', '#fff'],
  I: ['var(--atom-i)', '#fff'], S: ['var(--atom-s)', '#2a2000'], F: ['var(--atom-f)', '#0b1a0e'], P: ['var(--atom-p)', '#2a2000'],
};
const METALS = new Set(['Na', 'K', 'Mg', 'Ag', 'Cu', 'Ca', 'Fe', 'Al', 'Pb', 'Hg', 'Zn']);

const BOND = 44;

interface Props {
  id: string;
  hl?: number[];
  hlColor?: 'gold' | 'green';
  /** Атомдар бөлектеуі жыпылықтасын */
  pulse?: boolean;
  maxH?: number;
  className?: string;
  label?: boolean;
}

/** Молекуланы «шар мен таяқша» стилінде салу (видеодағы көрнекілік бойынша) */
export function Structure({ id, hl, hlColor = 'gold', pulse, maxH = 190, className, label = true }: Props) {
  const st = STRUCTS[id];
  const geo = useMemo(() => (st ? layout(st) : null), [st]);
  const sub = SUB[id];
  if (!st || !geo) {
    return (
      <figure className={'mol mol-text ' + (className ?? '')}>
        <div className="mol-fallback"><F s={sub?.sf ?? sub?.cf ?? id} /></div>
        {label && <figcaption>{sub?.name}</figcaption>}
      </figure>
    );
  }
  const hs = new Set(hl ?? []);
  const { w, h, nodes, bonds, brackets } = geo;
  const ring = hlColor === 'gold' ? 'var(--hl-gold)' : 'var(--hl-green)';
  return (
    <figure className={'mol ' + (className ?? '')}>
      <svg viewBox={`0 0 ${w} ${h}`} width={Math.round(w * Math.min(1.15, maxH / h))} height={Math.round(h * Math.min(1.15, maxH / h))} role="img" aria-label={`${sub?.name}: ${sub?.sf ?? sub?.cf}`}>
        {bonds.map((b, i) => {
          const on = hs.has(b.i) && hs.has(b.j);
          return (
            <g key={i}>
              {on && <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={ring} strokeWidth={b.order === 1 ? 10 : 14} strokeLinecap="round" opacity={0.35} className={pulse ? 'pulse' : undefined} />}
              {offsets(b.order).map((o, k) => (
                <line key={k} x1={b.x1 + b.nx * o} y1={b.y1 + b.ny * o} x2={b.x2 + b.nx * o} y2={b.y2 + b.ny * o} stroke="var(--bond)" strokeWidth={2.4} strokeLinecap="round" />
              ))}
            </g>
          );
        })}
        {brackets.map((br, i) => (
          <g key={'br' + i}>
            <line x1={br.x - br.nx * 12} y1={br.y - br.ny * 12} x2={br.x + br.nx * 12} y2={br.y + br.ny * 12} stroke="var(--fg)" strokeWidth={2} />
            {br.last && <text x={br.x + 6} y={br.y + 22} className="mol-n">n</text>}
          </g>
        ))}
        {nodes.map((n) => {
          const on = hs.has(n.i);
          if (n.dot) {
            return (
              <g key={n.i}>
                {on && <circle cx={n.x} cy={n.y} r={10} fill="none" stroke={ring} strokeWidth={3} className={pulse ? 'pulse' : undefined} />}
                <circle cx={n.x} cy={n.y} r={3.2} fill="var(--bond)" />
              </g>
            );
          }
          const [bg, fg] = n.colors;
          return (
            <g key={n.i}>
              {on && <rect x={n.x - n.w / 2 - 5} y={n.y - 16} width={n.w + 10} height={32} rx={16} fill="none" stroke={ring} strokeWidth={3} className={pulse ? 'pulse' : undefined} />}
              <rect x={n.x - n.w / 2} y={n.y - 11.5} width={n.w} height={23} rx={11.5} fill={bg} />
              <text x={n.x} y={n.y + 4.6} textAnchor="middle" fill={fg} className="mol-t">
                {n.parts.map((p, k) => (p.sub ? <tspan key={k} fontSize="9.5" dy={3}>{p.t}</tspan> : p.sup ? <tspan key={k} fontSize="9.5" dy={-6}>{p.t}</tspan> : <tspan key={k} dy={k > 0 ? (n.parts[k - 1].sub ? -3 : n.parts[k - 1].sup ? 6 : 0) : 0}>{p.t}</tspan>))}
              </text>
            </g>
          );
        })}
      </svg>
      {label && <figcaption>{sub?.name}<span className="mol-f"><F s={sub?.cf ?? ''} /></span></figcaption>}
    </figure>
  );
}

function offsets(order: number) {
  return order === 2 ? [-3.2, 3.2] : order === 3 ? [-4.6, 0, 4.6] : [0];
}

interface Part { t: string; sub?: boolean; sup?: boolean }

function layout(st: Struct) {
  const A = st.a;
  // орташа байланыс ұзындығы бойынша масштаб
  let sum = 0;
  for (const [i, j] of st.b) sum += Math.hypot(A[i][0] - A[j][0], A[i][1] - A[j][1]);
  const avg = st.b.length ? sum / st.b.length : 1.5;
  const k = BOND / avg;
  const neigh: number[][] = A.map(() => []);
  for (const [i, j] of st.b) { neigh[i].push(j); neigh[j].push(i); }
  const xs = A.map((a) => a[0] * k), ys = A.map((a) => a[1] * k);
  const nodes = A.map((a, i) => {
    const [, , el, hc, ch, inRing, abbr] = a;
    const dot = el === 'C' && inRing === 1 && !ch && !abbr && neigh[i].length >= 2;
    const isDummyEnd = el === '*' && !abbr;
    let parts: Part[] = [];
    if (abbr) parts = splitFormula(abbr);
    else if (!isDummyEnd) {
      const nx = neigh[i].length ? neigh[i].reduce((s, j) => s + xs[j], 0) / neigh[i].length : xs[i] + 1;
      const hLeft = hc > 0 && nx > xs[i] + 4 && el !== 'C' ? true : hc > 0 && nx > xs[i] + 4 && neigh[i].length === 1;
      const h: Part[] = hc ? [{ t: 'H' }, ...(hc > 1 ? [{ t: String(hc), sub: true }] : [])] : [];
      parts = hLeft ? [...h, { t: el }] : [{ t: el }, ...h];
      if (ch) parts.push({ t: (Math.abs(ch) > 1 ? Math.abs(ch) : '') + (ch > 0 ? '+' : '−'), sup: true });
    }
    const textLen = parts.reduce((s, p) => s + (p.sub || p.sup ? p.t.length * 5.4 : p.t.length * 8.6), 0);
    const w = Math.max(23, textLen + 12);
    const colors: [string, string] = abbr ? ['var(--atom-r)', 'var(--atom-r-fg)'] : METALS.has(el) ? ['var(--atom-m)', '#fff'] : EL_COLORS[el] ?? ['var(--atom-c)', 'var(--atom-c-fg)'];
    return { i, x: xs[i], y: ys[i], dot, dummy: isDummyEnd, parts, w, colors };
  });
  const bonds = st.b.map(([i, j, order]) => {
    const dx = xs[j] - xs[i], dy = ys[j] - ys[i];
    const L = Math.hypot(dx, dy) || 1;
    return { i, j, order, x1: xs[i], y1: ys[i], x2: xs[j], y2: ys[j], nx: -dy / L, ny: dx / L };
  });
  // полимер буынының жақшалары: * атомына баратын байланыстың ортасында
  const dummyIdx = nodes.filter((n) => n.dummy).map((n) => n.i);
  const brackets = dummyIdx.map((di, q) => {
    const j = neigh[di][0];
    const dx = xs[di] - xs[j], dy = ys[di] - ys[j];
    const L = Math.hypot(dx, dy) || 1;
    return { x: xs[j] + dx * 0.55, y: ys[j] + dy * 0.55, nx: -dy / L, ny: dx / L, last: q === dummyIdx.length - 1 };
  });
  // жақша сыртындағы «*» атомдарын көрсетпейміз, байланысты жақшаға дейін қысқартамыз
  const shownNodes = nodes.filter((n) => !n.dummy);
  const shownBonds = bonds.map((b) => {
    if (nodes[b.j].dummy) return { ...b, x2: b.x1 + (b.x2 - b.x1) * 0.75, y2: b.y1 + (b.y2 - b.y1) * 0.75 };
    if (nodes[b.i].dummy) return { ...b, x1: b.x2 + (b.x1 - b.x2) * 0.75, y1: b.y2 + (b.y1 - b.y2) * 0.75 };
    return b;
  });
  const pad = 22;
  const minX = Math.min(...shownNodes.map((n) => n.x - n.w / 2), ...brackets.map((b) => b.x - 6)) - pad;
  const maxX = Math.max(...shownNodes.map((n) => n.x + n.w / 2), ...brackets.map((b) => b.x + 16)) + pad;
  const minY = Math.min(...shownNodes.map((n) => n.y - 14), ...brackets.map((b) => b.y - 14)) - pad + 6;
  const maxY = Math.max(...shownNodes.map((n) => n.y + 14), ...brackets.map((b) => b.y + 26)) + pad - 6;
  const sx = (x: number) => x - minX, sy = (y: number) => y - minY;
  return {
    w: Math.round(maxX - minX), h: Math.round(maxY - minY),
    nodes: shownNodes.map((n) => ({ ...n, x: sx(n.x), y: sy(n.y) })),
    bonds: shownBonds.map((b) => ({ ...b, x1: sx(b.x1), y1: sy(b.y1), x2: sx(b.x2), y2: sy(b.y2) })),
    brackets: brackets.map((b) => ({ ...b, x: sx(b.x), y: sy(b.y) })),
  };
}

function splitFormula(s: string): Part[] {
  const out: Part[] = [];
  const re = /(\d+)|([^\d]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ? { t: m[1], sub: true } : { t: m[2] });
  return out;
}
