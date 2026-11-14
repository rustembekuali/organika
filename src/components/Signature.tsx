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
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function Signature({ className = '', label = 'Уали Рустембектің қолтаңбасы', speed = 1, onDone }: { className?: string; label?: string; speed?: number; onDone?: () => void }) {
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const root = useRef<HTMLButtonElement>(null);
  const ink = useRef<(SVGPathElement | null)[]>([]);
  const trail = useRef<(SVGPathElement | null)[]>([]);
  const tip = useRef<SVGGElement>(null);
  const raf = useRef(0);

  const show = useCallback((full: boolean) => {
    ink.current.forEach((p) => { if (p) { p.style.strokeDasharray = full ? 'none' : '0 99999'; p.style.visibility = full ? 'visible' : 'hidden'; } });
    trail.current.forEach((p) => { if (p) p.style.visibility = 'hidden'; });
    if (tip.current) tip.current.style.opacity = '0';
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
    const frame = (now: number) => {
      const e = (now - t0) * speed;
      let active = -1;
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
          if (tip.current) { tip.current.setAttribute('transform', `translate(${pt.x} ${pt.y})`); tip.current.style.opacity = '1'; }
        } else tr.style.visibility = 'hidden';
      }
      if (active < 0 && tip.current && e > HOLD) tip.current.style.opacity = '0';
      if (e < total) raf.current = requestAnimationFrame(frame);
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
        <g className="sig-ink">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} ref={(n) => { ink.current[i] = n; }} />)}
        </g>
        <g className="sig-trail">
          {sig.strokes.map((s, i) => <path key={i} d={s.d} ref={(n) => { trail.current[i] = n; }} />)}
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
      timers.current.push(window.setTimeout(onEnd, 650));
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
      <div className="intro-in">
        <Signature speed={1.2} label="Интро: автордың қолтаңбасы" onDone={() => { box.current?.classList.add('signed'); close(1150); }} />
        <div className="intro-word" aria-hidden="true">Органика</div>
      </div>
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); close(0); }}>Өткізу</button>
    </div>
  );
}
