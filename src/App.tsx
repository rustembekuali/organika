import React, { useEffect } from 'react';
import { useHash, A, Icon, subFromHash } from './components/ui';
import { useProgress, update } from './lib/store';
import { ReactionPage } from './components/Reaction';
import { MetroPage } from './pages/Metro';
import { Home, Library, TopicPage, NamedList, NamedPage, School, SchoolPage, Practice, PracticeMode, ProgressPage, SubstancePage, Sources } from './pages/Pages';
import type { Mode } from './lib/quiz';
import { Lab } from './pages/Lab';

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
  if (h === 'practice') return <Practice />;
  if (h.startsWith('p-')) return <PracticeMode mode={h.slice(2) as Mode | 'review'} />;
  if (h === 'named') return <NamedList />;
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
  if (/^(t-|r-|z-|s-|n-)/.test(h) || ['lib', 'school', 'named', 'sources'].includes(h)) return 'lib';
  if (h.startsWith('p-')) return 'practice';
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
      <main id="main" tabIndex={-1}>{route(h)}</main>
      <nav className="bottom-nav" aria-label="Негізгі мәзір (төменгі)">
        {NAV.map(([to, l, ic]) => <A key={to} to={to} className={sec === to ? 'on' : ''}><Icon n={ic} size={22} /><span>{l}</span></A>)}
      </nav>
      <footer className="foot">
        <div>Органика · қазақ тіліндегі органикалық химия реакцияларының оқу базасы</div>
        <div><A to="sources">Дереккөздер және тексеру журналы</A> · <kbd>/</kbd> — іздеу</div>
      </footer>
    </>
  );
}
