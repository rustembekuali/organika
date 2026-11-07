import React, { useEffect, useRef } from 'react';

/**
 * ELEMENT / LAB сайтындағы деңгей сызықтары (marching squares) фоны:
 * баяу толқыған өріс. Көрінбей тұрғанда немесе «қозғалысты азайту» кезінде тоқтайды.
 */
const LINE_SCALE = 3.8, LINE_COUNT = 2.5, WAVE = 0.37, SPEED = 1.1, CELLS = 72;

export function Contours() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let w = 0, h = 0, raf = 0, visible = true, last = 0, drawnStatic = false;

    const resize = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      drawnStatic = false;
    };
    const ro = new ResizeObserver(resize); ro.observe(cv); resize();
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { rootMargin: '100px' }); io.observe(cv);

    const draw = (now: number) => {
      const t = now / 1000 * SPEED;
      const cols = w >= h ? CELLS : Math.max(8, Math.round(CELLS * w / h));
      const rows = Math.max(8, Math.round(cols * h / w));
      const sx = w / cols, sy = h / rows, aspect = w / h;
      const values = new Float32Array((cols + 1) * (rows + 1));
      const field = (x: number, y: number) => {
        let f = Math.sin(x + t * 0.6) * 0.5;
        f += Math.sin(y * 0.85 - t * 0.45) * 0.45;
        f += Math.sin((x + y) * 0.65 + t * 0.35) * 0.35;
        f += Math.sin((x - y) * 0.95 - t * 0.55) * 0.25;
        return f * 0.5 + 0.5;
      };
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
        const nx = (i / cols * 2 - 1) * aspect * LINE_SCALE, ny = (j / rows * 2 - 1) * LINE_SCALE;
        const qx = nx + Math.sin(ny * 0.8 + t * 0.7) * WAVE, qy = ny + Math.cos(nx * 0.7 - t * 0.6) * WAVE;
        values[j * (cols + 1) + i] = field(qx, qy) * LINE_COUNT;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = getComputedStyle(cv).color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const seg = (p: number[], q: number[]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
      for (let lev = 0.5; lev < LINE_COUNT; lev++) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = values[j * (cols + 1) + i], b = values[j * (cols + 1) + i + 1], c = values[(j + 1) * (cols + 1) + i + 1], d = values[(j + 1) * (cols + 1) + i];
        const idx = (a > lev ? 8 : 0) | (b > lev ? 4 : 0) | (c > lev ? 2 : 0) | (d > lev ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * sx, y = j * sy;
        const top = [x + sx * ((lev - a) / (b - a)), y], right = [x + sx, y + sy * ((lev - b) / (c - b))];
        const bottom = [x + sx * ((lev - d) / (c - d)), y + sy], left = [x, y + sy * ((lev - a) / (d - a))];
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 10: seg(left, bottom); seg(top, right); break;
        }
      }
      ctx.stroke();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || !w || !h || document.hidden) return;
      const reduced = document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { if (!drawnStatic) { draw(4000); drawnStatic = true; } return; }
      if (now - last < 42) return; // ~24 кадр/с
      last = now;
      draw(now);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} className="contours" aria-hidden="true" />;
}
