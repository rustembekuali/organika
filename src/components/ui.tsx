import React, { useEffect, useState } from 'react';
import { CLASS_INFO, LEVEL_NAMES, STATUS_NAMES, TYPE_NAMES } from '../data/topics';
import type { ClassId, Reaction } from '../data/types';

// ───── Маршрутизация (тек #атау түріндегі хэштер)
export function useHash(): string {
  const [h, setH] = useState(() => location.hash.slice(1));
  useEffect(() => {
    const on = () => { setH(location.hash.slice(1)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return h;
}
export const go = (h: string) => { location.hash = h; };
export const subHash = (id: string) => 'z-' + id.replace(/_/g, '-');
export const subFromHash = (h: string) => h.replace(/-/g, '_');

export function A({ to, children, className, title }: { to: string; children: React.ReactNode; className?: string; title?: string }) {
  return <a href={'#' + to} className={className} title={title}>{children}</a>;
}

// ───── Белгілер
export function ClassChip({ cls, small }: { cls: ClassId; small?: boolean }) {
  const c = CLASS_INFO[cls];
  return (
    <span className={'chip cls' + (small ? ' sm' : '')} style={{ ['--c' as string]: c.color }}>
      <span className="dot" aria-hidden />{c.name}
    </span>
  );
}

export function LevelBadge({ lv }: { lv: string }) {
  return <span className={'badge lv-' + lv}>{LEVEL_NAMES[lv]}</span>;
}

export function StatusBadge({ st }: { st: string }) {
  const icon = st === 'ok' ? '✓' : st === 'fix' ? '✎' : st === 'simp' ? '≈' : '?';
  return <span className={'badge st-' + st} title={STATUS_NAMES[st]}><span aria-hidden>{icon} </span>{STATUS_NAMES[st]}</span>;
}

export function TypeBadge({ ty }: { ty: string }) {
  return <span className="badge ty">{TYPE_NAMES[ty]}</span>;
}

export function SourceBadge({ r }: { r: Reaction }) {
  return <span className="badge src">{r.src > 0 ? `PDF, ${r.src}-бет` : 'Қосымша'}</span>;
}

// ───── Иконкалар (қарапайым SVG)
const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z',
  moon: 'M14.5 3A9 9 0 1 0 21 15.5 7 7 0 0 1 14.5 3z',
  play: 'M8 5v14l11-7z', pause: 'M7 5h4v14H7zm6 0h4v14h-4z', prev: 'M6 6h2v12H6zm3.5 6L18 18V6z', next: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z',
  plus: 'M11 5h2v14h-2zM5 11h14v2H5z', minus: 'M5 11h14v2H5z', arrow: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
  motion: 'M4 12h3l2-6 4 12 2-6h5', check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z', x: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z',
  map: 'M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zm0 2.2 6 2v11.6l-6-2z', book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zm16 0h-4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h4z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  flask: 'M9 2h6v2h-1v5.3l5.6 9.4A2 2 0 0 1 17.9 22H6.1a2 2 0 0 1-1.7-3.3L10 9.3V4H9z',
  home: 'M12 3 2 12h3v8h6v-6h2v6h6v-8h3z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  download: 'M11 3h2v10l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4L11 13zM5 19h14v2H5z',
  upload: 'M11 21h2V11l3.6 3.6 1.4-1.4-6-6-6 6 1.4 1.4L11 11zM5 3h14v2H5z',
  copy: 'M8 3h11a2 2 0 0 1 2 2v11h-2V5H8zM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h10V9z',
};
export function Icon({ n, size = 18 }: { n: keyof typeof P | string; size?: number }) {
  if (n === 'motion') return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P.motion} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P[n]} fill="currentColor" /></svg>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** «Үйрену» бөлімінің ішкі қойындылары */
export function LearnTabs({ on }: { on: 'lib' | 'school' | 'named' }) {
  const t: [string, string][] = [['lib', 'Тақырыптар'], ['school', 'Негіздер'], ['named', 'Атаулы реакциялар']];
  return (
    <nav className="learn-tabs" aria-label="Үйрену бөлімдері">
      {t.map(([k, l]) => <A key={k} to={k} className={on === k ? 'on' : ''}>{l}</A>)}
    </nav>
  );
}
