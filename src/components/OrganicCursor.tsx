import React, { useEffect, useRef } from 'react';
import { useProgress } from '../lib/store';

/**
 * Тышқанды ілестіретін «органикалық» тіршілік иесі: серіппелі желе тәрізді дене,
 * артынан ілесетін құйрық, айналатын атомдар мен байланыстар.
 * Тек тышқаны бар құрылғыда және «қозғалысты азайту» қосылмаған кезде жұмыс істейді.
 */
const N = 18; // контур нүктелері
const TAIL = 4; // құйрық бөліктері
const ATOMS = 3; // айналатын атомдар
const CYAN = '2, 210, 227';
const INK = '#0e0f14';

type Vec = { x: number; y: number };
type Mover = Vec & { vx: number; vy: number };
type Ripple = Vec & { age: number };

function blob(p: Path2D, cx: number, cy: number, r: number, ang: number, stretch: number, t: number, seed: number) {
  const cosA = Math.cos(ang), sinA = Math.sin(ang);
  const sq = Math.sqrt(stretch);
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.1 * Math.sin(a * 3 + t * 1.7 + seed) + 0.07 * Math.sin(a * 5 - t * 2.3 + seed * 1.7) + 0.05 * Math.sin(a * 2 + t * 1.1 + seed * 0.5);
    const x = Math.cos(a) * r * wob, y = Math.sin(a) * r * wob;
    const u = (x * cosA + y * sinA) * stretch, v = (-x * sinA + y * cosA) / sq; // созылу мен қысылу
    pts.push([cx + u * cosA - v * sinA, cy + u * sinA + v * cosA]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const m = mid(pts[i], pts[(i + 1) % N]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
}

export function OrganicCursor() {
  const ref = useRef<HTMLCanvasElement>(null);
  const prog = useProgress();
  const off = prog.motion === 'reduce';

  useEffect(() => {
    if (off) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Телефон мен планшетте тышқан жоқ: жаратылыс басты беттің жоғарғы бөлігінде өздігінен жүзеді, саусаққа ілеседі
    const touchMode = !matchMedia('(hover: hover) and (pointer: fine)').matches;
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;

    let w = 0, h = 0, raf = 0, last = 0;
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();

    const target: Vec = { x: -300, y: -300 };
    const head: Mover = { x: -300, y: -300, vx: 0, vy: 0 };
    const tail: Vec[] = Array.from({ length: TAIL }, () => ({ x: -300, y: -300 }));
    const atoms = Array.from({ length: ATOMS }, (_, i) => ({ x: -300, y: -300, vx: 0, vy: 0, phase: (i / ATOMS) * Math.PI * 2, r: 4.5 + i * 1.4 }));
    const ripples: Ripple[] = [];
    let seen = false, vis = 0, visT = 0, size = 1, sizeT = 1;
    let touchUntil = 0;

    const place = (x: number, y: number) => {
      head.x = x; head.y = y; head.vx = head.vy = 0;
      tail.forEach((s) => { s.x = x; s.y = y; });
      atoms.forEach((a) => { a.x = x; a.y = y; a.vx = a.vy = 0; });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      target.x = e.clientX; target.y = e.clientY;
      if (!seen) { seen = true; place(target.x, target.y); }
      visT = 1;
      const el = e.target instanceof Element ? e.target : null;
      // реакция анимациясының үстінде курсорды жасырамыз — көрінуге де, жеңіл жүруге де кедергі болмасын
      if (el?.closest('.film, .player, .hero-film')) { visT = 0; return; }
      sizeT = el?.closest('a, button, input, select, textarea, label, [role=button]') ? 1.65 : 1;
    };
    const onLeave = () => { visT = 0; };
    const onDown = (e: PointerEvent) => { if (e.pointerType === 'mouse') ripples.push({ x: e.clientX, y: e.clientY, age: 0 }); };
    // саусақ: басқанда толқын, жүргізгенде (бетті айналдырғанда да) ілеседі
    const fingerIn = (x: number, y: number) => {
      const hero = document.querySelector('.hero-lab');
      const r = hero?.getBoundingClientRect();
      return !!r && y >= r.top && y <= r.bottom;
    };
    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0];
      if (!p || !fingerIn(p.clientX, p.clientY)) return;
      target.x = p.clientX; target.y = p.clientY; touchUntil = performance.now() + 1600;
      ripples.push({ x: p.clientX, y: p.clientY, age: 0 });
    };
    const onTouchMove = (e: TouchEvent) => {
      const p = e.touches[0];
      if (!p || !fingerIn(p.clientX, p.clientY)) return;
      target.x = p.clientX; target.y = p.clientY; touchUntil = performance.now() + 1600;
    };
    if (touchMode) {
      addEventListener('touchstart', onTouchStart, { passive: true });
      addEventListener('touchmove', onTouchMove, { passive: true });
    }
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    addEventListener('resize', resize);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(3, Math.max(0.2, (now - (last || now)) / 16.67));
      last = now;
      const t = now / 1000;

      if (touchMode) {
        // басты беттің жоғарғы бөлігінде (hero) ғана: төмен айналдырғанда жоғалады
        const hero = document.querySelector('.hero-lab');
        const r = hero?.getBoundingClientRect();
        const top = Math.max(r ? r.top : 0, 70) + 30, bottom = Math.min(r ? r.bottom : 0, h - 80) - 30; // шапка мен төменгі мәзірге шықпасын
        visT = r && bottom - top > 80 ? 0.92 : 0;
        if (r && now > touchUntil) {
          // баяу «жүзу»: бір-біріне қабаттасқан синустар табиғи, қайталанбайтын жол береді
          target.x = r.left + r.width * (0.5 + 0.34 * Math.sin(t * 0.31) * Math.cos(t * 0.17 + 0.6) + 0.08 * Math.sin(t * 0.83));
          target.y = top + (bottom - top) * (0.5 + 0.38 * Math.sin(t * 0.23 + 1.3) + 0.06 * Math.cos(t * 0.71));
        }
        if (!seen && visT > 0) { seen = true; place(target.x, target.y); }
        sizeT = now < touchUntil ? 1.25 : 1.1;
      }
      vis += (visT - vis) * Math.min(1, 0.12 * dt);
      size += (sizeT - size) * Math.min(1, 0.14 * dt);
      ctx.clearRect(0, 0, w, h);
      if (vis < 0.01) return;

      // Жеңіл серіппе: бас тышқан артынан кішкене «желедей» тербеліп жетеді
      head.vx += (target.x - head.x) * 0.085 * dt; head.vy += (target.y - head.y) * 0.085 * dt;
      const damp = Math.pow(0.8, dt);
      head.vx *= damp; head.vy *= damp;
      head.x += head.vx * dt; head.y += head.vy * dt;
      const speed = Math.hypot(head.vx, head.vy);
      const ang = Math.atan2(head.vy, head.vx);
      const stretch = 1 + Math.min(speed * 0.045, 0.75);

      const R = 20 * size;
      const path = new Path2D();
      const headPath = new Path2D();
      blob(headPath, head.x, head.y, R, ang, stretch, t, 0);
      path.addPath(headPath);

      // құйрық бөліктері алдыңғысын қуады — бір тұтас қосылып кетеді
      let prev: Vec = head;
      tail.forEach((s, i) => {
        const k = Math.min(1, (0.5 - i * 0.06) * dt);
        s.x += (prev.x - s.x) * k; s.y += (prev.y - s.y) * k;
        const a = Math.atan2(prev.y - s.y, prev.x - s.x);
        blob(path, s.x, s.y, R * (0.78 - i * 0.14), a, 1 + Math.min(speed * 0.03, 0.5), t, i + 1);
        prev = s;
      });

      ctx.globalAlpha = vis;
      // жарқыраған мембрана
      const g = ctx.createRadialGradient(head.x - R * 0.35, head.y - R * 0.4, R * 0.1, head.x, head.y, R * 1.7);
      g.addColorStop(0, `rgba(${CYAN}, .78)`);
      g.addColorStop(1, `rgba(${CYAN}, .3)`);
      const halo = ctx.createRadialGradient(head.x, head.y, R * 0.6, head.x, head.y, R * 2.4);
      halo.addColorStop(0, `rgba(${CYAN}, .28)`);
      halo.addColorStop(1, `rgba(${CYAN}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(head.x - R * 2.4, head.y - R * 2.4, R * 4.8, R * 4.8);
      ctx.fillStyle = g;
      ctx.fill(path, 'nonzero');
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${CYAN}, .95)`;
      ctx.stroke(headPath);

      // атомдар: байланыспен тартылып, бас айналасында орбитамен жүреді
      atoms.forEach((a, i) => {
        const d = R * (1.9 + i * 0.35);
        const w2 = 1 + i * 0.25;
        const ox = head.x + Math.cos(t * 0.9 * w2 + a.phase) * d;
        const oy = head.y + Math.sin(t * 0.9 * w2 + a.phase) * d;
        a.vx += (ox - a.x) * 0.05 * dt; a.vy += (oy - a.y) * 0.05 * dt;
        const dm = Math.pow(0.84, dt);
        a.vx *= dm; a.vy *= dm;
        a.x += a.vx * dt; a.y += a.vy * dt;
        ctx.strokeStyle = `rgba(${CYAN}, .55)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        ctx.fillStyle = INK;
        ctx.strokeStyle = `rgba(${CYAN}, 1)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (0.9 + size * 0.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // ядро: қозғалыс бағытына қарай сәл ығысады
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(ang) * Math.min(speed, 6) * 0.8, head.y + Math.sin(ang) * Math.min(speed, 6) * 0.8, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${CYAN}, 1)`;
      ctx.beginPath(); ctx.arc(head.x - R * 0.06, head.y - R * 0.08, R * 0.1, 0, Math.PI * 2); ctx.fill();

      // басқанда тарайтын толқын
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt * 0.035;
        if (r.age >= 1) { ripples.splice(i, 1); continue; }
        ctx.globalAlpha = vis * (1 - r.age) * 0.8;
        ctx.strokeStyle = `rgba(${CYAN}, 1)`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, R * (0.6 + r.age * 3.2), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      removeEventListener('resize', resize);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
    };
  }, [off]);

  return <canvas ref={ref} className="organic-cursor" aria-hidden="true" />;
}
