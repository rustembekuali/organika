import { useEffect, useRef } from 'react';
import { useProgress } from '../lib/store';

/**
 * Қысқы эффект: экранда қар жауады, карточкалар мен панельдердің жоғарғы жиегіне жиналады,
 * қар біраз жиналған соң басты беттегі панельдің үстінде аққала пайда болады.
 * Шапкадағы ❄ түймесімен өшіріледі; «Қозғалысты азайту» қосулы болса мүлде іске қосылмайды.
 * Қолданушыға кедергі жасамайды: canvas мәтін мен карточкалардың АРТЫНДА (z-index: -1), тек бос жерде көрінеді,
 * тышқанның басуын ұстамайды (pointer-events: none), ұшқындар аз әрі мөлдір, анимация ~30 кадр/с.
 */

// қар қай элементтердің үстіне жиналады
const SURFACES = '.card, .tile4, .mode-card, .bracket-panel, .deck, .film, .player, .bottom-nav, .fc-face.fc-front';
const COL = 4;          // үйінді бағанының ені, px
const MAX_PILE = 11;    // үйіндінің ең үлкен биіктігі, px
const SNOWMAN_AT = 2.2; // орташа биіктік осыдан асқанда аққала шығады

type Flake = { x: number; y: number; r: number; vy: number; drift: number; ph: number };
type Pile = { h: Float32Array; w: number };

export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  const prog = useProgress();
  const on = prog.snow !== false && prog.motion !== 'reduce';

  useEffect(() => {
    if (!on) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;

    let w = 0, h = 0, raf = 0, last = 0, lastScan = 0, snowman = 0;
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    addEventListener('resize', resize);

    const N = w < 700 ? 30 : 60;
    const spawn = (f: Partial<Flake> = {}): Flake => ({
      x: Math.random() * w, y: -10 - Math.random() * h, r: 0.8 + Math.random() * 1.6,
      vy: 0.3 + Math.random() * 0.55, drift: (Math.random() - 0.5) * 0.25, ph: Math.random() * Math.PI * 2, ...f,
    });
    const flakes: Flake[] = Array.from({ length: N }, () => spawn({ y: Math.random() * h }));
    const piles = new WeakMap<Element, Pile>();
    let surf: { el: Element; r: DOMRect }[] = [];

    const pileOf = (el: Element, width: number): Pile => {
      let p = piles.get(el);
      const cols = Math.max(2, Math.ceil(width / COL));
      if (!p || p.h.length !== cols) { p = { h: new Float32Array(cols), w: width }; piles.set(el, p); }
      return p;
    };
    const scan = () => {
      surf = [];
      document.querySelectorAll(SURFACES).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 60 || r.bottom < 0 || r.top > h || getComputedStyle(el).visibility === 'hidden') return;
        surf.push({ el, r });
      });
    };

    const deposit = (p: Pile, c: number, amt: number) => {
      // қар жұмсақ төбе болып жатсын: көршілерге де аздап таралады
      for (let k = -2; k <= 2; k++) {
        const i = c + k;
        if (i < 0 || i >= p.h.length) continue;
        const add = amt * (k === 0 ? 1 : Math.abs(k) === 1 ? 0.55 : 0.2);
        // шетке жақын жерде аз жиналады — жиектен «құлап» қалады
        const edge = Math.min(i, p.h.length - 1 - i) / 4;
        p.h[i] = Math.min(MAX_PILE * Math.min(1, 0.35 + edge), p.h[i] + add);
      }
    };

    // үйіндіні тегістеу: әр баған көршілерімен ақырын теңеседі — моншақ емес, жұмсақ төбе болады
    const relax = (p: Pile, dt: number) => {
      const a = p.h, k = Math.min(0.45, 0.18 * dt);
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < a.length - 1; i++) a[i] += k * ((a[i - 1] + a[i + 1]) / 2 - a[i]);
    };

    const drawPile = (r: DOMRect, p: Pile) => {
      const n = p.h.length, step = r.width / n;
      if (!p.h.some((v) => v > 0.4)) return;
      ctx.beginPath();
      ctx.moveTo(r.left, r.top + 1);
      for (let i = 0; i < n; i++) {
        const x = r.left + (i + 0.5) * step, y = r.top + 1 - p.h[i];
        const nx = r.left + (i + 1.5) * step, ny = r.top + 1 - (p.h[i + 1] ?? 0);
        ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      }
      ctx.lineTo(r.right, r.top + 1);
      ctx.closePath();
      ctx.fill();
    };

    const drawSnowman = (x: number, base: number, s: number, light: boolean) => {
      if (s <= 0) return;
      ctx.save();
      ctx.translate(x, base);
      ctx.scale(s, s);
      ctx.fillStyle = '#f7fbff';
      ctx.shadowColor = 'rgba(40, 80, 120, .35)'; ctx.shadowBlur = 6;
      for (const [cy, r] of [[-13, 13], [-33, 10], [-49, 7.5]]) { ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowBlur = 0;
      if (light) { // ақшыл фонда ақ аққала көрінсін — жұқа контур
        ctx.strokeStyle = 'rgba(90, 130, 170, .55)'; ctx.lineWidth = 1;
        for (const [cy, r] of [[-13, 13], [-33, 10], [-49, 7.5]]) { ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.fillStyle = '#1b1d24';
      for (const [ex, ey] of [[-2.8, -51], [2.8, -51], [0, -36], [0, -30], [0, -16]]) { ctx.beginPath(); ctx.arc(ex, ey, 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f08a24'; // сәбіз мұрын
      ctx.beginPath(); ctx.moveTo(0, -48.5); ctx.lineTo(9, -47.5); ctx.lineTo(0, -46.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6303c'; // Санта қалпағы
      ctx.beginPath(); ctx.moveTo(-8, -54); ctx.quadraticCurveTo(2, -74, 11, -63); ctx.lineTo(7, -55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-9, -57, 17, 4.5);
      ctx.beginPath(); ctx.arc(11.5, -63, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 30) return; // ~30 кадр/с жеткілікті
      const dt = Math.min(3, Math.max(0.2, (now - (last || now)) / 16.67));
      last = now;
      if (now - lastScan > 350) { scan(); lastScan = now; }
      else surf.forEach((s) => { s.r = s.el.getBoundingClientRect(); }); // айналдырғанда үйінді элементпен бірге жүреді
      const t = now / 1000;
      const wind = Math.sin(t * 0.13) * 0.35;

      ctx.clearRect(0, 0, w, h);
      const light = document.documentElement.dataset.theme === 'light';
      // ақшыл тақырыпта ақ қар көрінбейді — көкшіл реңк
      ctx.fillStyle = light ? 'rgba(110, 150, 190, 1)' : 'rgba(255, 255, 255, 1)';
      for (const f of flakes) {
        const py = f.y;
        f.y += f.vy * dt;
        f.x += (Math.sin(t * 1.3 + f.ph) * 0.35 + f.drift + wind) * dt;
        if (f.x < -10) f.x = w + 10; else if (f.x > w + 10) f.x = -10;
        let landed = false;
        for (const s of surf) {
          const r = s.r;
          if (f.x < r.left + 2 || f.x > r.right - 2) continue;
          const p = pileOf(s.el, r.width);
          const c = Math.min(p.h.length - 1, Math.floor((f.x - r.left) / (r.width / p.h.length)));
          const top = r.top - p.h[c];
          if (py <= top && f.y >= top && r.top > 0) { deposit(p, c, f.r * 3.2); landed = true; break; }
        }
        if (landed || f.y > h + 10) { Object.assign(f, spawn({ y: -10 - Math.random() * 40 })); continue; }
        ctx.globalAlpha = 0.3 + f.r * 0.2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // үйінділер: ақ, астында жұмсақ көкшіл көлеңке (ақшыл тақырыпта да көрінсін)
      ctx.fillStyle = '#fbfdff';
      ctx.shadowColor = light ? 'rgba(60, 110, 160, .55)' : 'rgba(60, 110, 160, .35)'; ctx.shadowBlur = light ? 6 : 4; ctx.shadowOffsetY = 1;
      for (const s of surf) { const p = piles.get(s.el); if (p) { relax(p, dt); drawPile(s.r, p); } }
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // аққала басты беттегі бірінші панельдің үстінде
      const host = surf.find((s) => s.el.matches('.hero-side .bracket-panel'));
      if (host) {
        const p = piles.get(host.el);
        const avg = p ? p.h.reduce((a, b) => a + b, 0) / p.h.length : 0;
        if (avg > SNOWMAN_AT || snowman > 0) snowman = Math.min(1, snowman + 0.03 * dt);
        if (snowman > 0) {
          const x = host.r.right - 34;
          const c = p ? Math.floor((x - host.r.left) / (host.r.width / p.h.length)) : 0;
          const bounce = snowman < 1 ? Math.sin(snowman * Math.PI) * 0.15 : 0;
          drawSnowman(x, host.r.top + 2 - (p ? p.h[c] * 0.6 : 0), (snowman + bounce) * 0.8, light);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); ctx.clearRect(0, 0, w, h); };
  }, [on]);

  return on ? <canvas ref={ref} className="snow-canvas" aria-hidden="true" /> : null;
}
