import { useCallback, useEffect, useRef } from 'react';
import sig from '../data/generated/signature.json';

/**
 * Автордың қолтаңбасы — жарқыраған қалам ұшымен «жазылып шығады».
 * Сызықтар scripts/signature/ ішіндегі құралдармен қолтаңба суретінен алынған
 * (қалам жүрісінің ретімен). Көрінгенде бір рет ойнайды, басқанда қайта жазылады.
 */
const PAD = 30;
const HOLD = 380;      // басталар алдындағы кідіріс, мс
const TRAIL = 190;     // жарық құйрықтың ұзындығы
const CORE = 60;       // құйрықтың ақ өзегі
const SPARKS = 22;
const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2; // басы мен соңы жұмсақ, ортасы бірқалыпты
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Refs = (SVGGElement | null)[];

export function Signature({ className = '', label = 'Уали Рустембектің қолтаңбасы', speed = 1, onDone }: { className?: string; label?: string; speed?: number; onDone?: () => void }) {
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const root = useRef<HTMLButtonElement>(null);
  const meas = useRef<(SVGPathElement | null)[]>([]);
  const ink = useRef<Refs>([]);
  const soft = useRef<Refs>([]);
  const core = useRef<Refs>([]);
  const tip = useRef<SVGGElement>(null);
  const sparks = useRef<(SVGCircleElement | null)[]>([]);
  const raf = useRef(0);

  const show = useCallback((full: boolean) => {
    ink.current.forEach((g) => { if (g) { g.style.strokeDasharray = 'none'; g.style.visibility = full ? 'visible' : 'hidden'; } });
    [...soft.current, ...core.current].forEach((g) => { if (g) g.style.visibility = 'hidden'; });
    if (tip.current) tip.current.style.opacity = '0';
    sparks.current.forEach((c) => c?.setAttribute('opacity', '0'));
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const el = root.current;
    if (!el) return;
    if (document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { show(true); el.classList.add('done'); doneCb.current?.(); return; }
    // Бір үзіліссіз уақыт сызығы: қалам барлық сызық бойымен бірқалыпты жылдамдықпен жүреді,
    // сызықтар арасында ауамен жұмсақ ұшып өтеді.
    const paths = meas.current.filter(Boolean) as SVGPathElement[];
    const lens = paths.map((p) => p.getTotalLength());
    const a0 = paths.map((p) => p.getPointAtLength(0));
    const a1 = paths.map((p, i) => p.getPointAtLength(lens[i]));
    const starts: number[] = [];
    const hops: number[] = [];
    let total = 0;
    lens.forEach((l, i) => {
      starts.push(total); total += l;
      const h = i < lens.length - 1 ? Math.max(46, Math.hypot(a0[i + 1].x - a1[i].x, a0[i + 1].y - a1[i].y) * 0.55) : 0;
      hops.push(h); total += h;
    });
    const T = (700 + total * 1.02) / speed;
    const setTrail = (g: SVGGElement | null, u: number, i: number, size: number) => {
      if (!g) return;
      const head = clamp(u - starts[i], 0, lens[i]), tail = clamp(u - size - starts[i], 0, lens[i]);
      if (head - tail < 0.5) { g.style.visibility = 'hidden'; return; }
      g.style.visibility = 'visible';
      g.style.strokeDasharray = `${head - tail} ${lens[i] + 400}`;
      g.style.strokeDashoffset = String(-tail);
    };
    show(false);
    el.classList.remove('done');
    const ps = Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
    let next = 0, acc = 0;
    const t0 = performance.now();
    let last = t0;
    const frame = (now: number) => {
      const e = now - t0 - HOLD;
      const dt = Math.min(50, now - last); last = now;
      const k = clamp(e / T, 0, 1);
      const u = ease(k) * total;
      let tx = 0, ty = 0, pen = 0; // pen: 1 — жазып тұр, 0.5 — ауада
      for (let i = 0; i < lens.length; i++) {
        const g = ink.current[i];
        const head = clamp(u - starts[i], 0, lens[i]);
        if (g) {
          g.style.visibility = head > 0 ? 'visible' : 'hidden';
          g.style.strokeDasharray = head >= lens[i] ? 'none' : `${head} ${lens[i] + 10}`;
        }
        setTrail(soft.current[i], u, i, TRAIL);
        setTrail(core.current[i], u, i, CORE);
        const end = starts[i] + lens[i];
        if (u >= starts[i] && u < end) { const pt = paths[i].getPointAtLength(head); tx = pt.x; ty = pt.y; pen = 1; }
        else if (u >= end && u < end + hops[i]) {
          const h = (u - end) / hops[i], s = h * h * (3 - 2 * h);
          tx = a1[i].x + (a0[i + 1].x - a1[i].x) * s; ty = a1[i].y + (a0[i + 1].y - a1[i].y) * s - Math.sin(Math.PI * h) * 12; pen = 0.5;
        }
      }
      if (tip.current) {
        if (k > 0 && k < 1 && pen) { tip.current.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`); tip.current.style.opacity = String(pen); }
        else tip.current.style.opacity = '0';
      }
      // ұшқындар
      if (pen === 1) { acc += dt; while (acc > 34) { acc -= 34; const q = ps[next++ % SPARKS]; const a = Math.random() * Math.PI * 2, v = 0.02 + Math.random() * 0.07; q.x = tx; q.y = ty; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v - 0.015; q.life = 1; } }
      ps.forEach((q, i) => {
        const c = sparks.current[i];
        if (!c) return;
        if (q.life <= 0) { c.setAttribute('opacity', '0'); return; }
        q.life -= dt / 560; q.vy += dt * 0.0001; q.x += q.vx * dt; q.y += q.vy * dt;
        c.setAttribute('cx', q.x.toFixed(1)); c.setAttribute('cy', q.y.toFixed(1));
        c.setAttribute('r', (0.8 + q.life * 2.4).toFixed(1)); c.setAttribute('opacity', (Math.max(0, q.life) * 0.9).toFixed(2));
      });
      if (e < T + 420) raf.current = requestAnimationFrame(frame);
      else { show(true); el.classList.add('done'); doneCb.current?.(); }
    };
    raf.current = requestAnimationFrame(frame);
  }, [show, speed]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    show(false);
    if (!('IntersectionObserver' in window)) { play(); return; }
    const io = new IntersectionObserver((en) => {
      if (en.some((x) => x.isIntersecting)) { io.disconnect(); play(); }
    }, { threshold: 0.55 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf.current); };
  }, [play, show]);

  const vb = { x: -PAD, y: -PAD, w: sig.w + PAD * 2, h: sig.h + PAD * 2 };
  return (
    <button ref={root} type="button" className={'sig ' + className} onClick={play} aria-label={label + ' — қайта жазу үшін бас'} title="Қайта жазу">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="sig-tip-g"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".22" stopColor="#bfe6ff" stopOpacity=".55" /><stop offset="1" stopColor="#8fd3ff" stopOpacity="0" /></radialGradient>
          <linearGradient id="sig-shine-g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="sig-shine-m" maskUnits="userSpaceOnUse" x={vb.x} y={vb.y} width={vb.w} height={vb.h}>
            <rect className="sig-shine-bar" x="-360" y={vb.y} width="320" height={vb.h} fill="url(#sig-shine-g)" transform="skewX(-18)" />
          </mask>
        </defs>
        {sig.strokes.map((s, i) => (
          <g key={i} className="sig-stroke" ref={(n) => { ink.current[i] = n; }}>
            <path d={s.d} className="sig-g2" /><path d={s.d} className="sig-g1" />
            <path d={s.d} className="sig-line" ref={(n) => { meas.current[i] = n; }} />
          </g>
        ))}
        {sig.strokes.map((s, i) => <g key={i} className="sig-soft" ref={(n) => { soft.current[i] = n; }}><path d={s.d} className="sig-s2" /><path d={s.d} className="sig-s1" /></g>)}
        {sig.strokes.map((s, i) => <g key={i} className="sig-core" ref={(n) => { core.current[i] = n; }}><path d={s.d} /></g>)}
        <g className="sig-shine" mask="url(#sig-shine-m)">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} />)}
        </g>
        <g className="sig-sparks">
          {Array.from({ length: SPARKS }, (_, i) => <circle key={i} r="2" opacity="0" ref={(n) => { sparks.current[i] = n; }} />)}
        </g>
        <g ref={tip} className="sig-tip" style={{ opacity: 0 }}>
          <circle r="34" fill="url(#sig-tip-g)" />
          <circle r="4.5" fill="#fff" />
        </g>
      </svg>
    </button>
  );
}

/**
 * Сайтқа кіргендегі интро: қараңғы экранда қолтаңба жазылады, кейін сайт ашылады.
 * Браузер сессиясында бір рет көрсетіледі; басу, Esc немесе «Өткізу» арқылы өткізуге болады.
 */
const INTRO_KEY = 'organika-intro';
export function introPending(): boolean {
  try {
    if (sessionStorage.getItem(INTRO_KEY)) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const st = JSON.parse(localStorage.getItem('organika-v1') || '{}');
    return st.motion !== 'reduce';
  } catch { return false; }
}
export function Intro({ onEnd }: { onEnd: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const ended = useRef(false);
  const close = useCallback((delay: number) => {
    if (ended.current) return;
    ended.current = true;
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* жеке режим */ }
    timers.current.push(window.setTimeout(() => {
      box.current?.classList.add('out');
      timers.current.push(window.setTimeout(onEnd, 900));
    }, delay));
  }, [onEnd]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close(0); };
    window.addEventListener('keydown', key);
    const safety = window.setTimeout(() => close(0), 9000); // анимация тоқтап қалса да сайт ашылады
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const t = timers.current;
    return () => { window.removeEventListener('keydown', key); clearTimeout(safety); t.forEach(clearTimeout); document.documentElement.style.overflow = prev; };
  }, [close]);
  return (
    <div ref={box} className="intro" onClick={() => close(0)} role="presentation">
      <div className="intro-aura" aria-hidden="true"><i /><i /><i /></div>
      <div className="intro-in">
        <div className="intro-burst" aria-hidden="true" />
        <Signature speed={1.05} label="Интро: автордың қолтаңбасы" onDone={() => { box.current?.classList.add('signed'); close(1700); }} />
        <div className="intro-word" aria-hidden="true">{'ОРГАНИКА'.split('').map((ch, i) => <span key={i} style={{ transitionDelay: i * 55 + 'ms' }}>{ch}</span>)}</div>
        <div className="intro-line" aria-hidden="true" />
      </div>
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); close(0); }}>Өткізу</button>
    </div>
  );
}
