import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProgress } from '../lib/store';

/**
 * Қысқы эффект: экранда қар жауады, карточкалар мен панельдердің жоғарғы жиегіне жиналады,
 * қар біраз жиналған соң басты беттегі панельдің үстінде аққала пайда болады.
 * - Тышқан: жақындағанда ұшқындар ығысады, үйіндінің үстінен өткізсе қар сыпырылып, төмен шашылады.
 * - 🚜 Трактор: қар жиналған жиектерді бірінен соң бірі тазалайды (аққаланы да итеріп жібереді).
 * - ❄ «Қар жаусын»: бірнеше секунд қалың қар жауады.
 * - Жаңа жылдық гирлянда шапканың астында.
 * Басқару — шапкадағы ❄ мәзірі (snowCommand): трактор, қалың қар, өшіру; «Қозғалысты азайту» қосулы болса мүлде іске қосылмайды.
 * Қолданушыға кедергі жасамайды: негізгі canvas мәтін мен карточкалардың АРТЫНДА (z-index: -1),
 * трактор мен шашырандылар салынатын canvas тышқанның басуын ұстамайды, анимация ~30 кадр/с.
 */

// қар қай элементтердің үстіне жиналады
const SURFACES = '.card, .tile4, .mode-card, .bracket-panel, .deck, .film, .player, .bottom-nav, .fc-face.fc-front';
const COL = 4;          // үйінді бағанының ені, px
const MAX_PILE = 11;    // үйіндінің ең үлкен биіктігі, px
const SNOWMAN_AT = 2.2; // орташа биіктік осыдан асқанда аққала шығады
const REPEL = 90;       // тышқан ұшқындарды осы радиуста ығыстырады
const BRUSH = 18;       // тышқан үйіндіні осы радиуста сыпырады
const MAX_LOOSE = 360;  // қосымша (сыпырылған / қалың жауған) ұшқындардың шегі

type Flake = { x: number; y: number; r: number; vy: number; vx: number; drift: number; ph: number };
type Pile = { h: Float32Array; w: number };
type Bit = { x: number; y: number; vx: number; vy: number; r: number; life: number };
type Cmd = { plow?: () => void; burst?: () => void };

export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const cmd = useRef<Cmd>({});
  const prog = useProgress();
  const on = prog.snow !== false && prog.motion !== 'reduce';

  useEffect(() => {
    if (!on) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = ref.current, fx = fxRef.current;
    const ctx = cv?.getContext('2d'), fxc = fx?.getContext('2d');
    if (!cv || !ctx || !fx || !fxc) return;

    let w = 0, h = 0, raf = 0, last = 0, lastScan = 0, snowman = 0, burstUntil = 0;
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      for (const [c, x] of [[cv, ctx], [fx, fxc]] as const) { c.width = Math.round(w * d); c.height = Math.round(h * d); x.setTransform(d, 0, 0, d, 0, 0); }
    };
    resize();
    addEventListener('resize', resize);

    const N = w < 700 ? 30 : 60;
    const spawn = (f: Partial<Flake> = {}): Flake => ({
      x: Math.random() * w, y: -10 - Math.random() * h, r: 0.8 + Math.random() * 1.6,
      vy: 0.3 + Math.random() * 0.55, vx: 0, drift: (Math.random() - 0.5) * 0.25, ph: Math.random() * Math.PI * 2, ...f,
    });
    const flakes: Flake[] = Array.from({ length: N }, () => spawn({ y: Math.random() * h }));
    const loose: Flake[] = [];   // сыпырылған немесе қалың жауған қосымша ұшқындар — экраннан шыққанда жойылады
    const bits: Bit[] = [];      // трактор шашқан қар кесектері (үстіңгі canvas-та)
    const piles = new WeakMap<Element, Pile>();
    let surf: { el: Element; r: DOMRect }[] = [];

    // ── тышқан
    const mouse = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (mouse.t && now - mouse.t < 100) { mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y; }
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = now;
    };
    const onLeave = () => { mouse.x = mouse.y = -999; };
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

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
    const avgOf = (p?: Pile) => (p ? p.h.reduce((a, b) => a + b, 0) / p.h.length : 0);

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

    // алты бұрышты қар кристалы
    const drawCrystal = (x: number, y: number, R: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
        ctx.moveTo(0, 0); ctx.lineTo(ca * R, sa * R);
        const bx = ca * R * 0.55, by = sa * R * 0.55, br = R * 0.3;
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * br, by + Math.sin(a + 0.7) * br);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * br, by + Math.sin(a - 0.7) * br);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawSnowman = (g: CanvasRenderingContext2D, x: number, base: number, s: number, light: boolean, tilt = 0) => {
      if (s <= 0) return;
      g.save();
      g.translate(x, base);
      g.rotate(tilt);
      g.scale(s, s);
      g.fillStyle = '#f7fbff';
      g.shadowColor = 'rgba(40, 80, 120, .35)'; g.shadowBlur = 6;
      for (const [cy, r] of [[-13, 13], [-33, 10], [-49, 7.5]]) { g.beginPath(); g.arc(0, cy, r, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 0;
      if (light) { // ақшыл фонда ақ аққала көрінсін — жұқа контур
        g.strokeStyle = 'rgba(90, 130, 170, .55)'; g.lineWidth = 1;
        for (const [cy, r] of [[-13, 13], [-33, 10], [-49, 7.5]]) { g.beginPath(); g.arc(0, cy, r, 0, Math.PI * 2); g.stroke(); }
      }
      g.fillStyle = '#1b1d24';
      for (const [ex, ey] of [[-2.8, -51], [2.8, -51], [0, -36], [0, -30], [0, -16]]) { g.beginPath(); g.arc(ex, ey, 1.3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f08a24'; // сәбіз мұрын
      g.beginPath(); g.moveTo(0, -48.5); g.lineTo(9, -47.5); g.lineTo(0, -46.2); g.closePath(); g.fill();
      g.fillStyle = '#d6303c'; // Санта қалпағы
      g.beginPath(); g.moveTo(-8, -54); g.quadraticCurveTo(2, -74, 11, -63); g.lineTo(7, -55); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(-9, -57, 17, 4.5);
      g.beginPath(); g.arc(11.5, -63, 3, 0, Math.PI * 2); g.fill();
      g.restore();
    };

    // ── трактор (қар күрегіш): алға (оңға) жүреді, алдында күрек
    const drawTractor = (x: number, base: number, t: number) => {
      const g = fxc;
      const bob = Math.sin(t * 22) * 0.6;
      g.save();
      g.translate(x, base + bob);
      // күрек
      g.fillStyle = '#9aa4b2';
      g.beginPath(); g.moveTo(22, -1); g.lineTo(31, -1); g.quadraticCurveTo(27, -10, 30, -19); g.lineTo(22, -17); g.closePath(); g.fill();
      g.strokeStyle = '#5f6b7a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, -9); g.lineTo(23, -9); g.stroke();
      // корпус пен кабина
      g.fillStyle = '#f5b81b';
      g.beginPath(); g.roundRect(-20, -17, 36, 11, 3); g.fill();
      g.beginPath(); g.roundRect(-16, -30, 17, 14, 3); g.fill();
      g.fillStyle = '#bfe8ff'; g.beginPath(); g.roundRect(-13, -27, 11, 8, 2); g.fill();
      // жыпылықтайтын шам
      g.fillStyle = Math.sin(t * 9) > 0 ? '#ff7a1a' : '#ffd08a';
      g.beginPath(); g.roundRect(-10, -34, 5, 4, 1.5); g.fill();
      // дөңгелектер
      g.fillStyle = '#1b1d24';
      g.beginPath(); g.arc(-12, -4, 6.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9, -3.5, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6b7280';
      g.beginPath(); g.arc(-12, -4, 2.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9, -3.5, 2, 0, Math.PI * 2); g.fill();
      g.restore();
    };

    type Job = { el: Element; x: number };
    let plowQueue: Job[] = [];
    let flying: { x: number; y: number; vx: number; vy: number; rot: number; vr: number } | null = null; // итерілген аққала
    cmd.current.plow = () => {
      if (plowQueue.length) return;
      scan();
      const withSnow = surf.filter((s) => avgOf(piles.get(s.el)) > 0.25 || (snowman > 0 && s.el.matches('.hero-side .bracket-panel')));
      const list = (withSnow.length ? withSnow : surf.filter((s) => s.r.top > 60).slice(0, 1))
        .filter((s) => s.r.top > 40 && s.r.top < h - 20)
        .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
      plowQueue = list.map((s) => ({ el: s.el, x: -50 }));
    };
    cmd.current.burst = () => { burstUntil = performance.now() + 7000; };
    // шапкадағы ❄ мәзірінен келетін командалар
    const onCmd = (e: Event) => { const k = (e as CustomEvent<string>).detail; if (k === 'plow') cmd.current.plow?.(); if (k === 'burst') cmd.current.burst?.(); };
    addEventListener('organika-snow', onCmd);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 30) return; // ~30 кадр/с жеткілікті
      const dt = Math.min(3, Math.max(0.2, (now - (last || now)) / 16.67));
      last = now;
      if (now - lastScan > 350) { scan(); lastScan = now; }
      else surf.forEach((s) => { s.r = s.el.getBoundingClientRect(); }); // айналдырғанда үйінді элементпен бірге жүреді
      const t = now / 1000;
      const wind = Math.sin(t * 0.13) * 0.35;
      const light = document.documentElement.dataset.theme === 'light';
      mouse.vx *= 0.85; mouse.vy *= 0.85;

      // қалың қар
      if (now < burstUntil) for (let k = 0; k < 3 && loose.length < MAX_LOOSE; k++) loose.push(spawn({ y: -8 - Math.random() * 30, vy: 0.6 + Math.random() * 0.8 }));

      // тышқан үйіндінің үстінен өтсе — қар сыпырылып, төмен шашылады
      if (mouse.x > -900) {
        for (const s of surf) {
          const r = s.r;
          if (mouse.x < r.left - BRUSH || mouse.x > r.right + BRUSH || mouse.y < r.top - MAX_PILE - 14 || mouse.y > r.top + 8) continue;
          const p = piles.get(s.el);
          if (!p) continue;
          const step = r.width / p.h.length;
          for (let i = 0; i < p.h.length; i++) {
            const cx = r.left + (i + 0.5) * step;
            if (Math.abs(cx - mouse.x) > BRUSH || p.h[i] < 0.6) continue;
            const take = p.h[i] * 0.55;
            p.h[i] -= take;
            if (loose.length < MAX_LOOSE && Math.random() < take / 2.5) {
              loose.push(spawn({ x: cx, y: r.top - p.h[i] - 2, vy: -0.4 + Math.random() * 0.6, vx: mouse.vx * 0.12 + (Math.random() - 0.5) * 1.2, r: 0.8 + Math.random() * 1.3 }));
            }
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      // ақшыл тақырыпта ақ қар көрінбейді — көкшіл реңк
      ctx.fillStyle = light ? 'rgba(110, 150, 190, 1)' : 'rgba(255, 255, 255, 1)';
      const step = (f: Flake, isLoose: boolean): boolean => {
        const py = f.y;
        // тышқанға жақын ұшқын ығысады
        const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < REPEL * REPEL && d2 > 1) { const d = Math.sqrt(d2), k = (1 - d / REPEL) * 0.9; f.vx += (dx / d) * k; f.vy += (dy / d) * k * 0.5; }
        f.vx *= 0.92;
        f.vy += (0.3 + f.r * 0.15 - f.vy) * 0.04; // бастапқы құлау жылдамдығына ақырын оралады
        f.y += f.vy * dt;
        f.x += (Math.sin(t * 1.3 + f.ph) * 0.35 + f.drift + wind + f.vx) * dt;
        if (!isLoose) { if (f.x < -10) f.x = w + 10; else if (f.x > w + 10) f.x = -10; }
        for (const s of surf) {
          const r = s.r;
          if (f.vy <= 0 || f.x < r.left + 2 || f.x > r.right - 2) continue;
          const p = pileOf(s.el, r.width);
          const c = Math.min(p.h.length - 1, Math.floor((f.x - r.left) / (r.width / p.h.length)));
          const top = r.top - p.h[c];
          if (py <= top && f.y >= top && r.top > 0) { deposit(p, c, f.r * 3.2); return true; }
        }
        ctx.globalAlpha = 0.3 + f.r * 0.2;
        if (f.r > 2.05) drawCrystal(f.x, f.y, f.r * 2.1, t * 0.6 + f.ph);   // ірі ұшқындар — алты бұрышты кристалл
        else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
        return f.y > h + 10 || f.x < -30 || f.x > w + 30;
      };
      for (const f of flakes) if (step(f, false)) Object.assign(f, spawn({ y: -10 - Math.random() * 40 }));
      for (let i = loose.length - 1; i >= 0; i--) if (step(loose[i], true)) loose.splice(i, 1);
      ctx.globalAlpha = 1;

      // ── трактор: кезектегі жиектің үстімен жүріп, қарды күрекпен шашады
      fxc.clearRect(0, 0, w, h);
      const job = plowQueue[0];
      if (job) {
        const r = job.el.getBoundingClientRect();
        const p = pileOf(job.el, r.width);
        job.x += 3 * dt;
        const front = r.left + job.x + 30;
        const stepw = r.width / p.h.length;
        for (let i = 0; i < p.h.length; i++) {
          const cx = r.left + (i + 0.5) * stepw;
          if (cx > front || p.h[i] < 0.2) continue;
          for (let k = 0; k < Math.min(3, p.h[i] / 2); k++) bits.push({ x: cx, y: r.top - p.h[i], vx: 1.5 + Math.random() * 3, vy: -1.5 - Math.random() * 2.5, r: 1 + Math.random() * 1.8, life: 1 });
          p.h[i] = 0;
        }
        // аққаланы итеріп жібереді
        if (snowman > 0 && job.el.matches('.hero-side .bracket-panel') && front > r.right - 46) {
          flying = { x: r.right - 34, y: r.top + 2, vx: 3.2, vy: -3.5, rot: 0, vr: 0.12 };
          snowman = 0;
        }
        drawTractor(r.left + job.x, r.top + 1, t);
        if (r.left + job.x > r.right + 30 || r.bottom < 0 || r.top > h) plowQueue.shift();
      }
      // шашыранды кесектер
      fxc.fillStyle = light ? '#ffffff' : '#f4f9ff';
      fxc.shadowColor = 'rgba(60, 110, 160, .5)'; fxc.shadowBlur = light ? 3 : 0;
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 0.25 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= 0.022 * dt;
        if (b.life <= 0 || b.y > h) { bits.splice(i, 1); continue; }
        fxc.globalAlpha = Math.min(1, b.life * 1.4);
        fxc.beginPath(); fxc.arc(b.x, b.y, b.r, 0, Math.PI * 2); fxc.fill();
      }
      fxc.globalAlpha = 1; fxc.shadowBlur = 0;
      if (flying) {
        flying.vy += 0.3 * dt; flying.x += flying.vx * dt; flying.y += flying.vy * dt; flying.rot += flying.vr * dt;
        drawSnowman(fxc, flying.x, flying.y, 0.8, light, flying.rot);
        if (flying.y > h + 80) flying = null;
      }

      // үйінділер: ақ, астында жұмсақ көкшіл көлеңке (ақшыл тақырыпта да көрінсін)
      ctx.fillStyle = '#fbfdff';
      ctx.shadowColor = light ? 'rgba(60, 110, 160, .55)' : 'rgba(60, 110, 160, .35)'; ctx.shadowBlur = light ? 6 : 4; ctx.shadowOffsetY = 1;
      for (const s of surf) { const p = piles.get(s.el); if (p) { relax(p, dt); drawPile(s.r, p); } }
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // аққала басты беттегі бірінші панельдің үстінде
      const host = surf.find((s) => s.el.matches('.hero-side .bracket-panel'));
      if (host && !flying) {
        const p = piles.get(host.el);
        if (avgOf(p) > SNOWMAN_AT || snowman > 0) snowman = Math.min(1, snowman + 0.03 * dt);
        if (snowman > 0) {
          const x = host.r.right - 34;
          const c = p ? Math.floor((x - host.r.left) / (host.r.width / p.h.length)) : 0;
          const bounce = snowman < 1 ? Math.sin(snowman * Math.PI) * 0.15 : 0;
          drawSnowman(ctx, x, host.r.top + 2 - (p ? p.h[c] * 0.6 : 0), (snowman + bounce) * 0.8, light);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      removeEventListener('organika-snow', onCmd);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      ctx.clearRect(0, 0, w, h); fxc.clearRect(0, 0, w, h);
      cmd.current = {};
    };
  }, [on]);

  if (!on) return null;
  return (
    <>
      <Garland />
      <canvas ref={ref} className="snow-canvas" aria-hidden="true" />
      <canvas ref={fxRef} className="snow-fx" aria-hidden="true" />
    </>
  );
}

/** Шапканың астындағы Жаңа жылдық гирлянда: толқынды сым және ақырын жыпылықтайтын түрлі-түсті шамдар. */
const BULBS = ['#ff4d5e', '#ffd23f', '#3ccf86', '#38c8ff', '#b37bff'];
function Garland() {
  const [width, setWidth] = useState(() => innerWidth);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    setHost(document.querySelector('header.top'));
    const on = () => setWidth(innerWidth);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  const gap = width < 700 ? 34 : 42, n = Math.ceil(width / gap) + 1, sag = 7;
  const pts = Array.from({ length: n }, (_, i) => ({ x: i * gap + gap / 2 }));
  if (!host) return null;
  // сым шамдардың арасында иіліп тұрады
  let d = 'M0 2';
  pts.forEach((p) => { d += ` Q${p.x - gap / 2} ${2 + sag} ${p.x} 3`; });
  return createPortal(
    <svg className="garland" width={width} height="24" viewBox={`0 0 ${width} 24`} aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="rgba(120, 130, 140, .55)" strokeWidth="1.2" />
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x - gap / 2} ${2 + sag * 0.75})`}>
          <rect x="-2" y="-1" width="4" height="4" rx="1" fill="#6b7280" />
          <ellipse cx="0" cy="8" rx="3.6" ry="5.2" fill={BULBS[i % BULBS.length]} className="bulb" style={{ animationDelay: `${(i * 0.37) % 2.4}s`, color: BULBS[i % BULBS.length] }} />
        </g>
      ))}
    </svg>,
    host,
  );
}

/** Шапкадағы ❄ мәзірінен қар эффектісіне команда жіберу */
export const snowCommand = (k: 'plow' | 'burst') => dispatchEvent(new CustomEvent('organika-snow', { detail: k }));
