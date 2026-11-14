import { useCallback, useEffect, useRef } from 'react';
import sig from '../data/generated/signature.json';

/**
 * Автордың қолтаңбасы — жарқыраған қалам ұшымен «жазылып шығады».
 * Сызықтар scripts/signature/ ішіндегі құралдармен қолтаңба суретінен алынған
 * (қалам жүрісінің ретімен). Көрінгенде бір рет ойнайды, басқанда қайта жазылады.
 */
const PAD = 26;
const GAP = 70;        // сызықтар арасындағы үзіліс, мс
const HOLD = 260;      // басталар алдындағы кідіріс, мс
const dur = (len: number) => 230 + len * 0.78; // сызық ұзындығына қарай уақыт, мс
const SPARKS = 34;      // қалам ұшынан шашырайтын ұшқындар
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function Signature({ className = '', label = 'Уали Рустембектің қолтаңбасы', speed = 1, onDone }: { className?: string; label?: string; speed?: number; onDone?: () => void }) {
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const root = useRef<HTMLButtonElement>(null);
  const ink = useRef<(SVGPathElement | null)[]>([]);
  const trail = useRef<(SVGPathElement | null)[]>([]);
  const tip = useRef<SVGGElement>(null);
  const raf = useRef(0);
  const sparks = useRef<(SVGCircleElement | null)[]>([]);

  const show = useCallback((full: boolean) => {
    ink.current.forEach((p) => { if (p) { p.style.strokeDasharray = full ? 'none' : '0 99999'; p.style.visibility = full ? 'visible' : 'hidden'; } });
    trail.current.forEach((p) => { if (p) p.style.visibility = 'hidden'; });
    if (tip.current) tip.current.style.opacity = '0';
    sparks.current.forEach((c) => c?.setAttribute('opacity', '0'));
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const el = root.current;
    if (!el) return;
    if (document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { show(true); el.classList.add('done'); doneCb.current?.(); return; }
    const lens = ink.current.map((p) => (p ? p.getTotalLength() : 0));
    const starts: number[] = [];
    let t = HOLD;
    lens.forEach((l) => { starts.push(t); t += dur(l) + GAP; });
    const total = t;
    show(false);
    el.classList.remove('done');
    const t0 = performance.now();
    const ps = Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
    let last = t0, next = 0;
    const frame = (now: number) => {
      const e = (now - t0) * speed;
      let active = -1, tx = 0, ty = 0;
      const dt = Math.min(50, now - last); last = now;
      for (let i = 0; i < lens.length; i++) {
        const p = ink.current[i], tr = trail.current[i];
        if (!p || !tr) continue;
        const k = Math.min(1, Math.max(0, (e - starts[i]) / dur(lens[i])));
        const drawn = ease(k) * lens[i];
        if (k <= 0) { p.style.visibility = 'hidden'; tr.style.visibility = 'hidden'; continue; }
        p.style.visibility = 'visible';
        p.style.strokeDasharray = k >= 1 ? 'none' : `${drawn} ${lens[i] + 10}`;
        if (k < 1) {
          active = i;
          const tl = Math.min(drawn, 150); // жарқыраған құйрық
          tr.style.visibility = 'visible';
          tr.style.strokeDasharray = `${tl} ${lens[i] + 300}`;
          tr.style.strokeDashoffset = String(-(drawn - tl));
          const pt = p.getPointAtLength(drawn);
          tx = pt.x; ty = pt.y;
          if (tip.current) { tip.current.setAttribute('transform', `translate(${pt.x} ${pt.y})`); tip.current.style.opacity = '1'; }
        } else tr.style.visibility = 'hidden';
      }
      if (active < 0 && tip.current && e > HOLD) tip.current.style.opacity = '0';
      // ұшқындар: қалам ұшынан туып, баяу төмен түсіп сөнеді
      if (active >= 0 && Math.random() < 0.55) {
        const q = ps[next++ % SPARKS];
        const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.09;
        q.x = tx; q.y = ty; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v - 0.02; q.life = 1;
      }
      ps.forEach((q, i) => {
        const c = sparks.current[i];
        if (!c) return;
        if (q.life <= 0) { c.setAttribute('opacity', '0'); return; }
        q.life -= dt / 620; q.vy += dt * 0.00012; q.x += q.vx * dt; q.y += q.vy * dt;
        c.setAttribute('cx', q.x.toFixed(1)); c.setAttribute('cy', q.y.toFixed(1));
        c.setAttribute('r', (1.2 + q.life * 3.2).toFixed(1)); c.setAttribute('opacity', Math.max(0, q.life).toFixed(2));
      });
      if (e < total + 380) raf.current = requestAnimationFrame(frame);
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

  return (
    <button ref={root} type="button" className={'sig ' + className} onClick={play} aria-label={label + ' — қайта жазу үшін бас'} title="Қайта жазу">
      <svg viewBox={`${-PAD} ${-PAD} ${sig.w + PAD * 2} ${sig.h + PAD * 2}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="sig-shine-g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="sig-shine-m" maskUnits="userSpaceOnUse" x={-PAD} y={-PAD} width={sig.w + PAD * 2} height={sig.h + PAD * 2}>
            <rect className="sig-shine-bar" x="-320" y={-PAD} width="300" height={sig.h + PAD * 2} fill="url(#sig-shine-g)" transform="skewX(-18)" />
          </mask>
        </defs>
        <g className="sig-ink">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} ref={(n) => { ink.current[i] = n; }} />)}
        </g>
        <g className="sig-trail">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} ref={(n) => { trail.current[i] = n; }} />)}
        </g>
        <g className="sig-shine" mask="url(#sig-shine-m)">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} />)}
        </g>
        <g className="sig-sparks">
          {Array.from({ length: SPARKS }, (_, i) => <circle key={i} r="2" opacity="0" ref={(n) => { sparks.current[i] = n; }} />)}
        </g>
        <g ref={tip} className="sig-tip" style={{ opacity: 0 }}>
          <circle r="26" className="sig-halo" />
          <circle r="7" className="sig-dot" />
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
        <Signature speed={1.2} label="Интро: автордың қолтаңбасы" onDone={() => { box.current?.classList.add('signed'); close(1700); }} />
        <div className="intro-word" aria-hidden="true">{'ОРГАНИКА'.split('').map((ch, i) => <span key={i} style={{ transitionDelay: i * 55 + 'ms' }}>{ch}</span>)}</div>
        <div className="intro-line" aria-hidden="true" />
      </div>
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); close(0); }}>Өткізу</button>
    </div>
  );
}
