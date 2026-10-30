// Видеодағыдай реакция «фильмі»: атомдар шар түрінде, реакция кезінде орнынан жылжып, жаңа заттарға айналады.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import scenesJson from '../data/generated/scenes.json';
import { RX, eqOf, isOrganic } from '../data/index';
import { SUB, formulaOf } from '../data/substances';
import { CLASS_INFO, TYPE_NAMES } from '../data/topics';
import { checkBalance } from '../lib/chem';
import { shortName, plainFormula, reagentText } from '../lib/format';
import { reagentOf } from '../lib/graph';
import { useProgress } from '../lib/store';
import { Icon, A } from './ui';
import { defaultBond } from '../lib/text';

type St = [number, number, number, number, number, string | null, number];
interface SAtom { e: string; a: St | null; b: St | null; n?: number; f?: number; t?: number }
interface Pill { k: string; sid: string; x: number; w: number }
interface Scene { W: number; top: number; bot: number; atoms: SAtom[]; bA: number[][]; bB: number[][]; pA: Pill[]; pB: Pill[]; plusA: number[]; plusB: number[]; nA: { sid: string; x: number; y: number }[]; nB: { sid: string; x: number; y: number }[] }
const SCENES = scenesJson as unknown as Record<string, Scene>;
export const hasScene = (rid: string) => !!SCENES[rid];

const COLORS: Record<string, [string, string]> = {
  C: ['#e9edf3', '#141820'], O: ['#ee4f6c', '#fff'], N: ['#4f86f0', '#fff'], Cl: ['#59c47a', '#0b1a0e'], Br: ['#c4683a', '#fff'],
  I: ['#9a66d8', '#fff'], S: ['#f2c94c', '#2a2000'], F: ['#93dc72', '#0b1a0e'], P: ['#f2b544', '#2a2000'],
};
const METAL = new Set(['Na', 'K', 'Mg', 'Ag', 'Cu', 'Ca', 'Fe', 'Al']);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩';

export interface FilmStep { rid: string; from?: string; to?: string }

interface Props {
  steps: FilmStep[];
  title?: string;
  autoplay?: boolean;
  loop?: boolean;
  /** Жоғарыдағы шағын жол (видеодағы «葡萄糖 → 乙醇 · …» сияқты) */
  crumb?: string;
  compact?: boolean;
  onClose?: () => void;
}

function mainSides(rid: string, step: FilmStep) {
  const e = eqOf(RX[rid])!;
  const from = step.from ?? e.left.map((t) => t.id).find(isOrganic) ?? e.left[0].id;
  const to = step.to ?? e.right.map((t) => t.id).find(isOrganic) ?? e.right[0].id;
  return { from, to };
}

export function Film({ steps, title, autoplay, loop, crumb, compact, onClose }: Props) {
  const prog = useProgress();
  const reduce = prog.motion === 'reduce' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [num, setNum] = useState<boolean>(localNum.get() ?? true);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!!autoplay && !reduce);
  const box = useRef<HTMLDivElement>(null);
  const valid = steps.filter((s) => SCENES[s.rid]);
  const step = valid[Math.min(i, valid.length - 1)];
  const sc = step ? SCENES[step.rid] : null;
  const r = step ? RX[step.rid] : null;

  useEffect(() => { setI(0); setPhase(0); setT(0); }, [steps.map((s) => s.rid).join()]);

  // морф анимациясы
  useEffect(() => {
    if (phase < 2) { setT(0); return; }
    if (phase === 3) { setT(1); return; }
    if (reduce) { setT(1); return; }
    let raf = 0;
    const start = performance.now();
    const D = 1600;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / D);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, i, reduce]);

  // автоматты ойнату
  useEffect(() => {
    if (!playing) return;
    const dur = [1300, 1900, reduce ? 900 : 1900, 2400][phase];
    const id = setTimeout(() => next(true), dur);
    return () => clearTimeout(id);
  }, [playing, phase, i]);

  const next = (auto = false) => {
    if (phase < 3) { setPhase(phase + 1); return; }
    if (i < valid.length - 1) { setI(i + 1); setPhase(0); return; }
    if (auto && loop) { setI(0); setPhase(0); return; }
    if (auto) setPlaying(false);
  };
  const prev = () => {
    if (phase > 0) { setPhase(phase - 1); return; }
    if (i > 0) { setI(i - 1); setPhase(3); }
  };

  const derived = useMemo(() => (sc ? analyse(sc) : null), [sc]);
  if (!sc || !r || !derived) return null;
  const { from, to } = mainSides(r.id, step);
  const cFrom = CLASS_INFO[SUB[from].cls].color, cTo = CLASS_INFO[SUB[to].cls].color;
  const g = reagentOf(r, from);
  const reag = plainFormula(reagentText(g.terms, g.cond));
  const te = ease(t);
  const pathMode = valid.length > 1;
  const segColors = pathMode ? valid.map((s) => CLASS_INFO[SUB[mainSides(s.rid, s).to].cls].color) : [cFrom, '#f2b544', '#f2b544', cTo];
  const segFill = pathMode ? valid.map((_, k) => (k < i ? 1 : k === i ? (phase + (phase === 2 ? t : 0)) / 3 : 0)) : [0, 1, 2, 3].map((k) => (k < phase ? 1 : k === phase ? (phase === 2 ? t : 1) : 0));
  const stageText = pathMode ? `${i + 1}-саты · ${CLASS_INFO[SUB[to].cls].name}` : `${['Бастапқы заттар', 'Реакция орталығы', 'Айналу', 'Өнімдер'][phase]}`;
  const sub = phase === 0 ? (reag !== '—' ? `Реагент мен шарт: ${reag}` : 'Реакцияға түсетін заттар') : phase === 1 ? (r.b ?? defaultBond(r)) : (r.ob ?? r.x.split(/(?<=\.)\s/)[0]);
  // есептегіштер
  const bal = checkBalance(eqOf(r)!, formulaOf);
  const tiles = pathMode ? pathTiles(valid, i, phase) : [
    { l: 'үзілді', v: phase >= 2 ? String(derived.broken.length) : '0' },
    { l: 'түзілді', v: phase >= 2 ? String(Math.round(derived.formed.length * (phase === 3 ? 1 : clamp((t - 0.4) / 0.6)))) : '0' },
    { l: 'баланс', v: bal.ok ? '✓' : '✗' },
  ];

  // кішкентай молекулалар тым үлкейіп кетпесін: көру аймағының ең кіші биіктігі бар (видеодағыдай тұрақты атом өлшемі)
  const pad = 34;
  const cTop = sc.top - 48, cBot = sc.bot + 64, cH = cBot - cTop;
  const vbH = Math.max(cH, 235), vbW = sc.W + pad * 2;
  const vbX = -pad, vbY = cTop - (vbH - cH) / 2;
  const center = derived.center;

  const fullscreen = () => {
    const el = box.current;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else el?.requestFullscreen?.().catch(() => {});
    } catch { /* рұқсат жоқ */ }
  };

  return (
    <div className={'film' + (compact ? ' compact' : '') + (reduce ? ' reduce' : '')} ref={box} tabIndex={0} role="region" aria-label={'Реакция анимациясы: ' + r.t}
      onKeyDown={(ev) => {
        if (ev.key === 'ArrowRight') { ev.preventDefault(); setPlaying(false); next(); }
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setPlaying(false); prev(); }
        if (ev.key === ' ') { ev.preventDefault(); setPlaying((p) => !p); }
        if (ev.key === 'Escape' && onClose) onClose();
      }}>
      {onClose && <button className="x" onClick={onClose} aria-label="Жабу"><Icon n="x" /></button>}
      <header className="film-head">
        <div className="film-left">
          <div className="film-crumb">
            <span className="stage" style={{ ['--c' as string]: pathMode ? segColors[i] : phase === 3 ? cTo : phase === 0 ? cFrom : '#f2b544' }}>{stageText}</span>
            <span className="crumb-t">{crumb ?? title ?? r.t}</span>
          </div>
          <h3 className="film-title">
            <span className="num">{CIRC[pathMode ? i : 0] ?? i + 1}</span> {shortName(from)} <span className="pa">{eqOf(r)!.rev ? '⇌' : '→'}</span> {shortName(to)}
          </h3>
          <p className="film-sub" aria-live="polite">{TYPE_NAMES[r.ty]} · {sub}</p>
        </div>
        <div className="film-tiles">
          {tiles.map((x) => <div key={x.l} className="ftile"><span className="tl">{x.l}</span><span className="tv">{x.v}</span></div>)}
        </div>
      </header>

      <svg className="film-svg" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`${SUB[from].name} → ${SUB[to].name}`}>
        {/* «+» белгілері */}
        {sc.plusA.map((x, k) => <text key={'pa' + k} x={x} y={6} className="f-plus" opacity={1 - clamp(te / 0.3)}>+</text>)}
        {sc.plusB.map((x, k) => <text key={'pb' + k} x={x} y={6} className="f-plus" opacity={clamp((te - 0.7) / 0.3)}>+</text>)}
        {/* байланыстар */}
        {derived.bonds.map((bd, k) => {
          const p1 = pos(sc.atoms[bd.i], te, sc, center, derived.free.has(bd.i)), p2 = pos(sc.atoms[bd.j], te, sc, center, derived.free.has(bd.j));
          if (p1.dummy || p2.dummy) {
            const real = p1.dummy ? p2 : p1, dm = p1.dummy ? p1 : p2;
            const op = bd.kind === 'formed' ? clamp((te - 0.5) / 0.5) : bd.kind === 'broken' ? 1 - clamp(te / 0.5) : 1;
            const x2 = real.x + (dm.x - real.x) * 0.72, y2 = real.y + (dm.y - real.y) * 0.72;
            const dx = dm.x - real.x, dy = dm.y - real.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
            return <g key={k} opacity={op}><line x1={real.x} y1={real.y} x2={x2} y2={y2} className="f-bond" /><line x1={x2 + nx * 13} y1={y2 + ny * 13} x2={x2 - nx * 13} y2={y2 - ny * 13} className="f-bracket" /></g>;
          }
          const op = bd.kind === 'broken' ? 1 - clamp(te / 0.55) : bd.kind === 'formed' ? clamp((te - 0.45) / 0.55) : 1;
          if (op <= 0.01) return null;
          const order = bd.oA === bd.oB ? [{ o: bd.oA, op: 1 }] : [{ o: bd.oA, op: 1 - te }, { o: bd.oB, op: te }];
          const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const mark = (phase === 1 || phase === 2) && bd.kind !== 'same' ? (bd.kind === 'formed' ? '' : 'gold') : phase === 3 && (bd.kind === 'formed' || bd.kind === 'order') ? 'green' : '';
          return (
            <g key={k} opacity={op}>
              {mark && <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={'f-glow ' + mark + (phase === 1 ? ' pulse' : '')} />}
              {order.map((oo, q) => offs(oo.o).map((o, z) => (
                <line key={q + '-' + z} x1={p1.x + nx * o} y1={p1.y + ny * o} x2={p2.x + nx * o} y2={p2.y + ny * o} className={'f-bond' + (bd.kind === 'broken' && phase >= 1 ? ' breaking' : '')} opacity={oo.op} />
              )))}
            </g>
          );
        })}
        {/* бейорганикалық реагенттер мен өнімдер — «таблеткалар» (видеодағы ATP/NADH сияқты) */}
        {sc.pA.map((p, k) => {
          const cx = lerp(p.x, center.ax, te * 0.85), cy = lerp(0, center.ay - 44, te * 0.85);
          return <PillG key={'pA' + k} p={p} x={cx} y={cy} op={1 - clamp((te - 0.25) / 0.45)} glow={phase === 1} />;
        })}
        {sc.pB.map((p, k) => {
          const s = clamp((te - 0.35) / 0.65);
          const cx = lerp(center.bx, p.x, ease(s)), cy = lerp(center.by - 44, 0, ease(s));
          return <PillG key={'pB' + k} p={p} x={cx} y={cy} op={s} />;
        })}
        {/* атомдар */}
        {sc.atoms.map((a, k) => {
          const p = pos(a, te, sc, center, derived.free.has(k));
          if (p.op <= 0.01 || p.dummy) return null;
          const st = (te < 0.5 ? a.a ?? a.b : a.b ?? a.a)!;
          const rc = derived.rc.has(k);
          const ring = (phase === 1 || phase === 2) && rc ? 'gold' : phase === 3 && derived.formedAtoms.has(k) ? 'green' : '';
          return <AtomG key={k} a={a} st={st} x={p.x} y={p.y} op={p.op} num={num} ring={ring} pulse={phase === 1} />;
        })}
        {/* атаулар */}
        {sc.nA.map((n, k) => <NameG key={'nA' + k} n={n} op={1 - clamp(te / 0.3)} />)}
        {sc.nB.map((n, k) => <NameG key={'nB' + k} n={n} op={clamp((te - 0.7) / 0.3)} />)}
      </svg>

      <div className="film-ctl">
        <button className="fbtn" onClick={() => { setPlaying(false); prev(); }} disabled={i === 0 && phase === 0} aria-label="Алдыңғы"><Icon n="prev" /></button>
        <button className="fbtn main" onClick={() => { if (i === valid.length - 1 && phase === 3) { setI(0); setPhase(0); } setPlaying((p) => !p); }} aria-label={playing ? 'Тоқтату' : 'Ойнату'}>
          <Icon n={playing ? 'pause' : 'play'} />{playing ? 'Тоқтату' : i === valid.length - 1 && phase === 3 ? 'Қайта көру' : 'Ойнату'}
        </button>
        <button className="fbtn" onClick={() => { setPlaying(false); next(); }} disabled={i === valid.length - 1 && phase === 3} aria-label="Келесі"><Icon n="next" /></button>
        <span className="film-sep" />
        <button className="fbtn sm" aria-pressed={num} onClick={() => { setNum(!num); localNum.set(!num); }} title="Көміртекті нөмірлеу">{num ? 'C1, C2…' : 'CH₃, CH₂…'}</button>
        <button className="fbtn sm" onClick={fullscreen} title="Толық экран">⛶</button>
        <A to={'r-' + r.id} className="fbtn sm link">Карточка</A>
      </div>
      <div className="film-bar" aria-hidden>
        {segColors.map((c, k) => <span key={k}><i style={{ width: segFill[k] * 100 + '%', background: c }} /></span>)}
      </div>
    </div>
  );
}

// Көміртекті нөмірлеу таңдауы (сессия ішінде есте сақталады)
const localNum = (() => {
  let v: boolean | null = null;
  return { get: () => v, set: (x: boolean) => { v = x; } };
})();

function offs(o: number) { return o === 2 ? [-3.4, 3.4] : o === 3 ? [-5, 0, 5] : [0]; }

function analyse(sc: Scene) {
  const key = (a: number, b: number) => (a < b ? a + ':' + b : b + ':' + a);
  const A = new Map(sc.bA.map((b) => [key(b[0], b[1]), b])), B = new Map(sc.bB.map((b) => [key(b[0], b[1]), b]));
  const bonds: { i: number; j: number; oA: number; oB: number; kind: 'same' | 'order' | 'broken' | 'formed' }[] = [];
  const rc = new Set<number>(), formedAtoms = new Set<number>();
  const broken: string[] = [], formed: string[] = [];
  for (const [k, b] of A) {
    const nb = B.get(k);
    if (nb) {
      const kind = nb[2] === b[2] ? 'same' : 'order';
      bonds.push({ i: b[0], j: b[1], oA: b[2], oB: nb[2], kind });
      if (kind === 'order') { rc.add(b[0]); rc.add(b[1]); formedAtoms.add(b[0]); formedAtoms.add(b[1]); }
    } else { bonds.push({ i: b[0], j: b[1], oA: b[2], oB: b[2], kind: 'broken' }); rc.add(b[0]); rc.add(b[1]); broken.push(k); }
  }
  for (const [k, b] of B) if (!A.has(k)) {
    bonds.push({ i: b[0], j: b[1], oA: b[2], oB: b[2], kind: 'formed' });
    rc.add(b[0]); rc.add(b[1]); formedAtoms.add(b[0]); formedAtoms.add(b[1]);
    if (sc.atoms[b[0]].e !== '*' && sc.atoms[b[1]].e !== '*') formed.push(k);
  }
  sc.atoms.forEach((a, k) => {
    if (!a.a || !a.b) rc.add(k);
    else if (a.a[2] !== a.b[2]) rc.add(k);
  });
  // тұрақты (өзгермейтін) байланысы жоқ атомдар бір молекуладан екіншісіне «ұшады»
  const keep = new Set<number>();
  for (const b of bonds) if (b.kind === 'same' || b.kind === 'order') { keep.add(b.i); keep.add(b.j); }
  const free = new Set<number>();
  sc.atoms.forEach((a, k) => { if (a.a && a.b && !keep.has(k) && Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) > 40) free.add(k); });
  // реакция орталығының ортасы (A және B кадрларында)
  const ca = [...rc].map((k) => sc.atoms[k].a).filter(Boolean) as St[];
  const cb = [...rc].map((k) => sc.atoms[k].b).filter(Boolean) as St[];
  const avg = (xs: St[], d: number, idx: number) => (xs.length ? xs.reduce((s, x) => s + (x[idx] as number), 0) / xs.length : d);
  const center = { ax: avg(ca, sc.W / 2, 0), ay: avg(ca, 0, 1), bx: avg(cb, sc.W / 2, 0), by: avg(cb, 0, 1) };
  return { bonds, rc, formedAtoms, broken, formed, center, free };
}

function pos(a: SAtom, t: number, sc: Scene, c: { ax: number; ay: number; bx: number; by: number }, free?: boolean) {
  const dummy = a.e === '*' && !(a.b ?? a.a)![5];
  if (a.a && a.b) {
    const d = Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
    const arc = free ? Math.sin(Math.PI * t) * Math.min(70, d * 0.35) : 0;
    return { x: lerp(a.a[0], a.b[0], t), y: lerp(a.a[1], a.b[1], t) - arc, op: 1, dummy };
  }
  if (a.a) {
    // кететін атом: бейорганикалық өнімге (таблеткаға) ұшады
    const tgt = a.t !== undefined && a.t >= 0 ? { x: sc.pB[a.t].x, y: 0 } : { x: a.a[0], y: a.a[1] };
    return { x: lerp(a.a[0], tgt.x, t), y: lerp(a.a[1], tgt.y, t), op: 1 - clamp((t - 0.45) / 0.5), dummy };
  }
  const b = a.b!;
  // келетін атом: реагент таблеткасынан шығады
  const src = a.f !== undefined && a.f >= 0 ? { x: sc.pA[a.f].x, y: 0 } : { x: c.ax, y: c.ay };
  return { x: lerp(src.x, b[0], t), y: lerp(src.y, b[1], t), op: clamp((t - 0.15) / 0.5), dummy };
}

function AtomG({ a, st, x, y, op, num, ring, pulse }: { a: SAtom; st: St; x: number; y: number; op: number; num: boolean; ring: string; pulse: boolean }) {
  const [, , h, ch, inRing, abbr] = st;
  let parts: { t: string; s?: 'sub' | 'sup' }[];
  if (abbr) parts = abbr.split(/(\d+)/).filter(Boolean).map((p) => (/^\d+$/.test(p) ? { t: p, s: 'sub' as const } : { t: p }));
  else if (a.e === 'C' && num && a.n) parts = [{ t: 'C' + a.n }];
  else if (st[6] === 0 && h && ['O', 'S', 'F', 'Cl', 'Br', 'I'].includes(a.e)) parts = [{ t: 'H' }, ...(h > 1 ? [{ t: String(h), s: 'sub' as const }] : []), { t: a.e }];
  else parts = [{ t: a.e }, ...(h ? [{ t: 'H' }, ...(h > 1 ? [{ t: String(h), s: 'sub' as const }] : [])] : [])];
  if (ch && !abbr) parts.push({ t: (Math.abs(ch) > 1 ? String(Math.abs(ch)) : '') + (ch > 0 ? '+' : '−'), s: 'sup' });
  const dot = !num && a.e === 'C' && inRing && !ch && !abbr;
  const len = parts.reduce((s, p) => s + (p.s ? p.t.length * 5.6 : p.t.length * 8.4), 0);
  const w = Math.max(27, len + 13), hh = 27;
  const [bg, fg] = abbr ? ['#4a5468', '#fff'] : METAL.has(a.e) ? ['#7d889c', '#fff'] : COLORS[a.e] ?? ['#e9edf3', '#141820'];
  return (
    <g transform={`translate(${x},${y})`} opacity={op}>
      {ring && <rect x={-w / 2 - 5} y={-hh / 2 - 5} width={w + 10} height={hh + 10} rx={(hh + 10) / 2} className={'f-ring ' + ring + (pulse ? ' pulse' : '')} />}
      {dot ? <circle r={4} fill="#9aa4b5" /> : (
        <>
          <rect x={-w / 2} y={-hh / 2} width={w} height={hh} rx={hh / 2} fill={bg} />
          <text y={4.8} textAnchor="middle" fill={fg} className="f-at">
            {parts.map((p, k) => <tspan key={k} fontSize={p.s ? 9.5 : undefined} dy={p.s === 'sub' ? 3 : p.s === 'sup' ? -6 : k > 0 && parts[k - 1].s ? (parts[k - 1].s === 'sub' ? -3 : 6) : 0}>{p.t}</tspan>)}
          </text>
        </>
      )}
    </g>
  );
}

function PillG({ p, x, y, op, glow }: { p: Pill; x: number; y: number; op: number; glow?: boolean }) {
  if (op <= 0.01) return null;
  const label = (p.k && p.k !== '1' ? p.k : '') + plainFormula(SUB[p.sid].cf);
  const w = Math.max(40, label.length * 9 + 22);
  return (
    <g transform={`translate(${x},${y})`} opacity={op}>
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} className={'f-pill' + (glow ? ' glow' : '')} />
      <text y={5} textAnchor="middle" className="f-pill-t">{label}</text>
    </g>
  );
}

function NameG({ n, op }: { n: { sid: string; x: number; y: number }; op: number }) {
  if (op <= 0.01) return null;
  const s = SUB[n.sid];
  return (
    <g opacity={op}>
      <text x={n.x} y={n.y + 40} textAnchor="middle" className="f-name">{shortName(n.sid)}</text>
      <text x={n.x} y={n.y + 57} textAnchor="middle" className="f-form">{plainFormula(s.cf)}</text>
    </g>
  );
}

/** Маршрут бойы жиналатын қосымша өнімдер (видеодағы ATP / NADH / CO₂ есептегіштері сияқты) */
function pathTiles(steps: FilmStep[], i: number, phase: number) {
  const totals = new Map<string, number>();
  const counted = new Map<string, number>();
  steps.forEach((s, k) => {
    const e = eqOf(RX[s.rid])!;
    for (const t of e.right) {
      if (isOrganic(t.id) || !(SUB[t.id].smiles || t.id === 'h2')) continue;
      const v = /n/.test(t.k) ? 1 : parseInt(t.k || '1', 10);
      totals.set(t.id, (totals.get(t.id) ?? 0) + v);
      if (k < i || (k === i && phase >= 2)) counted.set(t.id, (counted.get(t.id) ?? 0) + v);
    }
  });
  const top = [...totals.keys()].sort((a, b) => (totals.get(b)! - totals.get(a)!)).slice(0, 2);
  return [
    { l: 'саты', v: `${i + 1}/${steps.length}` },
    ...top.map((id) => ({ l: plainFormula(SUB[id].cf), v: String(counted.get(id) ?? 0) })),
  ];
}

/** Толық экранға жақын қалқымалы терезедегі фильм (метро маршруты, генетикалық тізбектер) */
export function FilmOverlay({ steps, crumb, onClose }: { steps: FilmStep[]; crumb?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { (ref.current?.querySelector('.film') as HTMLElement | null)?.focus(); }, []);
  const ok = steps.filter((s) => SCENES[s.rid]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Реакциялар тізбегінің анимациясы" ref={ref} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="overlay-in">
        <Film steps={ok} crumb={crumb} autoplay onClose={onClose} />
        {ok.length < steps.length && <p className="overlay-note">Кейбір қадамдардың анимациясы жоқ, олар өткізіліп жіберілді.</p>}
      </div>
    </div>
  );
}
