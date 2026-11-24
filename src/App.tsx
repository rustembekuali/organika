import React, { useEffect, useRef, useState } from 'react';
import { useHash, A, Icon, subFromHash, BackButton } from './components/ui';
import { useProgress, update } from './lib/store';
import { ReactionPage } from './components/Reaction';
import { MetroPage } from './pages/Metro';
import { Home, Library, TopicPage, NamedList, NamedPage, School, SchoolPage, Practice, PracticeMode, ProgressPage, SubstancePage, Sources } from './pages/Pages';
import type { Mode } from './lib/quiz';
import { Lab } from './pages/Lab';
import { NamesPage } from './pages/Names';
import { GuidePage } from './pages/Guide';
import { CardsPage } from './pages/Cards';
import { Onboarding, reopenOnboarding } from './components/Onboarding';
import { Snow, snowCommand } from './components/Snow';

// Негізгі мәзір — 5 бөлім (телефонда төменгі панель)
const NAV: [string, string, string][] = [
  ['', 'Басты', 'home'], ['lib', 'Үйрену', 'book'], ['metro', 'Карта', 'map'], ['lab', 'Зертхана', 'flask'], ['practice', 'Жаттығу', 'target'],
];

function route(h: string) {
  if (!h || h === 'home') return <Home />;
  if (h === 'lib') return <Library />;
  if (h.startsWith('t-')) return <TopicPage id={h.slice(2)} />;
  if (h.startsWith('r-')) return <ReactionPage id={h.slice(2)} />;
  if (h === 'metro') return <MetroPage />;
  if (h === 'lab') return <Lab />;
  if (h.startsWith('lab-')) return <Lab key={h} base={h.slice(4)} />;
  if (h === 'practice') return <Practice />;
  if (h.startsWith('p-')) return <PracticeMode mode={h.slice(2) as Mode | 'review'} />;
  if (h === 'named') return <NamedList />;
  if (h === 'names') return <NamesPage key={h} />;
  if (h.startsWith('names-')) return <NamesPage key={h} part={h.slice(6)} />;
  if (h === 'guide') return <GuidePage />;
  if (h === 'cards') return <CardsPage key={h} />;
  if (h.startsWith('cards-')) return <CardsPage key={h} deck={h.slice(6)} />;
  if (h.startsWith('n-')) return <NamedPage id={h.slice(2)} />;
  if (h === 'school') return <School />;
  if (h.startsWith('s-')) return <SchoolPage id={h.slice(2)} />;
  if (h === 'progress') return <ProgressPage />;
  if (h === 'sources') return <Sources />;
  if (h.startsWith('z-')) return <SubstancePage id={subFromHash(h.slice(2))} />;
  return <Home />;
}

function section(h: string) {
  if (!h || h === 'home') return '';
  if (/^(t-|r-|z-|s-|n-)/.test(h) || ['lib', 'school', 'named', 'names', 'sources'].includes(h)) return 'lib';
  if (h.startsWith('p-') || h.startsWith('cards')) return 'practice';
  if (h.startsWith('lab')) return 'lab';
  if (h.startsWith('names') || h === 'guide') return 'lib';
  return h;
}

export default function App() {
  const h = useHash();
  const prog = useProgress();
  const sec = section(h);
  const dark = prog.theme === 'dark' || (prog.theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.motion = prog.motion;
  }, [dark, prog.motion]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        if (section(location.hash.slice(1)) !== 'lib' || location.hash.length > 4) location.hash = 'lib';
        setTimeout(() => (document.querySelector('.lib input[type=search]') as HTMLInputElement | null)?.focus(), 50);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  return (
    <>
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Негізгі мазмұнға өту</a>
      <header className="top">
        <div className="top-in">
          <A to="" className="logo" title="Органика — басты бет">
            <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden><polygon points="14,2 25,8.5 25,19.5 14,26 3,19.5 3,8.5" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="14" cy="14" r="4.2" fill="var(--accent)" /></svg>
            <span>Органика</span>
          </A>
          <nav className="nav" aria-label="Негізгі мәзір">
            {NAV.map(([to, l, ic]) => <A key={to} to={to} className={sec === to ? 'on' : ''}><Icon n={ic} size={20} /><span>{l}</span></A>)}
          </nav>
          <div className="top-tools">
            <SnowMenu on={prog.snow !== false} />
            <button className="icon-btn" onClick={() => update((p) => { p.motion = p.motion === 'reduce' ? 'auto' : 'reduce'; })} aria-pressed={prog.motion === 'reduce'} title={prog.motion === 'reduce' ? 'Анимацияны қосу' : 'Қозғалысты азайту'}>
              <Icon n="motion" /><span className="sr">{prog.motion === 'reduce' ? 'Анимация азайтылған' : 'Қозғалысты азайту'}</span>
            </button>
            <button className="icon-btn" onClick={() => update((p) => { p.theme = dark ? 'light' : 'dark'; })} title={dark ? 'Ақшыл тақырып' : 'Қараңғы тақырып'}>
              <Icon n={dark ? 'sun' : 'moon'} /><span className="sr">{dark ? 'Ақшыл тақырыпқа ауысу' : 'Қараңғы тақырыпқа ауысу'}</span>
            </button>
            <A to="progress" className={'profile-chip' + (sec === 'progress' ? ' on' : '')} title="Профиль және прогресс">
              <span className="avatar" aria-hidden>{(prog.name ?? '').trim().charAt(0).toUpperCase() || <Icon n="user" size={16} />}</span>
              <span className="pc-name">{prog.name ?? 'Профиль'}</span>
            </A>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{h && h !== 'home' && <BackButton />}{route(h)}</main>
      <nav className="bottom-nav" aria-label="Негізгі мәзір (төменгі)">
        {NAV.map(([to, l, ic]) => <A key={to} to={to} className={sec === to ? 'on' : ''}><Icon n={ic} size={22} /><span>{l}</span></A>)}
      </nav>
      <Onboarding />
      <Snow />
      <footer className="foot">
        <div>Органика · қазақ тіліндегі органикалық химия реакцияларының оқу базасы · Авторы: <b>Уали Рустембек</b></div>
        <div><button className="linkish" onClick={reopenOnboarding}>Сайт туралы нұсқаулық</button> · <A to="sources">Дереккөздер және тексеру журналы</A> · <kbd>/</kbd> — іздеу</div>
      </footer>
    </>
  );
}

/** Шапкадағы ❄: қар өшірулі болса қосады; қосулы болса мәзір ашады — трактор, қалың қар, өшіру */
function SnowMenu({ on }: { on: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', out); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (f: () => void) => () => { f(); setOpen(false); };
  return (
    <div className="snow-menu" ref={box}>
      <button className="icon-btn" aria-pressed={on} aria-haspopup={on ? 'menu' : undefined} aria-expanded={on ? open : undefined}
        onClick={() => (on ? setOpen(!open) : update((p) => { p.snow = true; }))} title={on ? 'Қар' : 'Қарды қосу'}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2 3-2M9 20.5l3-2 3 2M4 10.6l3.4-.2-1.5-3M20 13.4l-3.4.2 1.5 3M4 13.4l3.4.2-1.5 3M20 10.6l-3.4-.2 1.5-3" /></svg>
        <span className="sr">{on ? 'Қар мәзірі' : 'Қар өшірулі, қосу'}</span>
      </button>
      {open && (
        <div className="snow-pop" role="menu">
          <button role="menuitem" onClick={pick(() => snowCommand('plow'))}><span aria-hidden>🚜</span> Трактормен тазалау</button>
          <button role="menuitem" onClick={pick(() => snowCommand('burst'))}><span aria-hidden>❄️</span> Қалың қар жаусын</button>
          <button role="menuitem" onClick={pick(() => update((p) => { p.snow = false; }))}><span aria-hidden>⏻</span> Қарды өшіру</button>
        </div>
      )}
    </div>
  );
}
