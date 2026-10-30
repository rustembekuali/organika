import React, { useEffect, useMemo, useState } from 'react';
import type { Reaction, ParsedEq, Term } from '../data/types';
import { eqOf, RX, BY_SUBSTANCE, isOrganic, usable } from '../data/index';
import { SUB, formulaOf } from '../data/substances';
import { TOPIC, CLASS_INFO, TYPE_NAMES, STATUS_NAMES } from '../data/topics';
import { NAMED_BY_ID } from '../data/named';
import { checkBalance } from '../lib/chem';
import { F, TermView, formulaText, shortName, FormulaMode } from '../lib/format';
import { Structure, HIGHLIGHTS, hasStructure } from './Structure';
import { A, ClassChip, LevelBadge, StatusBadge, TypeBadge, SourceBadge, Icon, subHash, go } from './ui';
import { useProgress, markViewed, toggleFav, update } from '../lib/store';
import { STATION_IDS, metroIntent } from '../lib/graph';
import { QuizBlock } from './Quiz';
import { productQ, reagentQ, PRODUCT_POOL, REAGENT_POOL } from '../lib/quiz';
import { defaultBond, defaultMistake } from '../lib/text';
import { Film, hasScene } from './Film';

// ───── Теңдеу
export function Equation({ r, mode = 'sf', big }: { r: Reaction; mode?: FormulaMode | 'struct'; big?: boolean }) {
  const e = eqOf(r);
  if (!e) return <div className={'eq scheme' + (big ? ' big' : '')}><F s={r.scheme ?? ''} /></div>;
  if (mode === 'struct') return <StructEquation r={r} e={e} />;
  const side = (ts: Term[]) => ts.map((t, i) => (
    <React.Fragment key={i}>{i > 0 && <span className="op">+</span>}<TermView t={t} mode={mode} /></React.Fragment>
  ));
  return (
    <div className={'eq' + (big ? ' big' : '')} aria-label={r.t}>
      {side(e.left)}
      <Arrow cond={r.c} rev={e.rev} />
      {side(e.right)}
    </div>
  );
}

export function Arrow({ cond, rev }: { cond?: string; rev?: boolean }) {
  return (
    <span className="arrow">
      {cond && <span className="cond">{cond}</span>}
      <span className="shaft" aria-label={rev ? 'қайтымды' : 'береді'}>{rev ? '⇌' : '⟶'}</span>
    </span>
  );
}

function StructEquation({ r, e, step = 2 }: { r: Reaction; e: ParsedEq; step?: number }) {
  const hl = HIGHLIGHTS[r.id] ?? {};
  const item = (t: Term, i: number, side: 'l' | 'r') => (
    <React.Fragment key={side + i}>
      {i > 0 && <span className="op">+</span>}
      <span className={'sterm ' + (side === 'l' ? (step >= 2 ? 'faded' : '') : step < 2 ? 'hidden-p' : 'shown-p')}>
        {t.k && <span className="coef big">{t.k}</span>}
        {hasStructure(t.id) ? (
          <Structure id={t.id} hl={side === 'l' ? (step >= 1 ? hl[t.id] : undefined) : (step >= 2 ? hl[t.id] : undefined)} hlColor={side === 'l' ? 'gold' : 'green'} pulse={side === 'l' && step === 1} maxH={150} />
        ) : (
          <span className="inorg-pill"><F s={formulaText(t.id, 'cf')} /></span>
        )}
      </span>
    </React.Fragment>
  );
  return (
    <div className="seq">
      {e.left.map((t, i) => item(t, i, 'l'))}
      <Arrow cond={r.c} rev={e.rev} />
      {e.right.map((t, i) => item(t, i, 'r'))}
    </div>
  );
}

// ───── Атомдық баланс плиткалары (видеодағы есептегіштерге ұқсас)
export function BalanceTiles({ r }: { r: Reaction }) {
  const e = eqOf(r);
  if (!e) return null;
  const b = checkBalance(e, formulaOf);
  const poly = /\bn\b|\dn\b/.test(r.eq ?? '');
  return (
    <div className="tiles" aria-label="Атомдық баланс">
      {b.elements.map((el) => (
        <div key={el} className={'tile ' + (b.left[el] === b.right[el] ? 'ok' : 'bad')}>
          <span className="tl">{el}</span>
          <span className="tv">{b.left[el] ?? 0}<span className="sep">|</span>{b.right[el] ?? 0}</span>
        </div>
      ))}
      {(b.lc !== 0 || b.rc !== 0) && <div className="tile ok"><span className="tl">заряд</span><span className="tv">{b.lc}<span className="sep">|</span>{b.rc}</span></div>}
      <div className={'tile verdict ' + (b.ok ? 'ok' : 'bad')}><span className="tl">{poly ? 'n = 1 үшін' : 'баланс'}</span><span className="tv">{b.ok ? '✓' : '✗'}</span></div>
    </div>
  );
}

// ───── Видео стиліндегі қадамдық анимация
const STEPS = ['Бастапқы заттар', 'Үзілетін байланыстар', 'Түзілетін өнімдер'];
export function ReactionPlayer({ r }: { r: Reaction }) {
  const e = eqOf(r);
  const prog = useProgress();
  const reduce = prog.motion === 'reduce' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setStep(0); setPlaying(false); }, [r.id]);
  useEffect(() => {
    if (!playing) return;
    if (step >= 2) { setPlaying(false); return; }
    const t = setTimeout(() => setStep((s) => s + 1), reduce ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [playing, step, reduce]);
  if (!e) return null;
  const from = e.left.map((t) => t.id).find(isOrganic);
  const to = e.right.map((t) => t.id).find(isOrganic);
  const c1 = from ? CLASS_INFO[SUB[from].cls].color : '#888';
  const c2 = to ? CLASS_INFO[SUB[to].cls].color : '#888';
  const segColors = [c1, '#f2b544', c2];
  return (
    <section className={'player' + (reduce ? ' reduce' : '')} aria-label="Реакцияны қадамдап көру">
      <header className="player-head">
        <div>
          <span className="stage" style={{ ['--c' as string]: segColors[step] }}>{step + 1}-қадам · {STEPS[step]}</span>
          <h3 className="player-title">{from && <F s={formulaText(from)} />}{from && to && <span className="pa">→</span>}{to && <F s={formulaText(to)} />}</h3>
          <p className="player-sub" aria-live="polite">
            {step === 0 && (r.c ? `Шарттар: ${r.c}` : 'Реакцияға түсетін заттарды қара.')}
            {step === 1 && (r.b ?? defaultBond(r))}
            {step === 2 && (r.ob ?? r.x.split('. ')[0] + '.')}
          </p>
        </div>
        <BalanceTiles r={r} />
      </header>
      <StructEquation r={r} e={e} step={step} />
      <div className="player-ctl">
        <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label="Алдыңғы қадам"><Icon n="prev" /></button>
        <button className="btn" onClick={() => { if (step >= 2) setStep(0); setPlaying((p) => !p); }} aria-label={playing ? 'Тоқтату' : 'Ойнату'}><Icon n={playing ? 'pause' : 'play'} />{playing ? 'Тоқтату' : step >= 2 ? 'Қайта көру' : 'Ойнату'}</button>
        <button className="btn ghost" onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={step === 2} aria-label="Келесі қадам"><Icon n="next" /></button>
      </div>
      <div className="segbar" aria-hidden>
        {STEPS.map((_, i) => <span key={i} style={{ background: i <= step ? segColors[i] : undefined }} />)}
      </div>
    </section>
  );
}

// ───── Реакция тізімінің жолы
export function ReactionRow({ r }: { r: Reaction }) {
  const prog = useProgress();
  return (
    <A to={'r-' + r.id} className={'rrow' + (prog.viewed[r.id] ? ' seen' : '')}>
      <div className="rrow-top">
        <span className="rrow-t">{r.t}</span>
        <span className="rrow-b">
          {r.q && <span className="badge q">Сапалық</span>}
          {r.nm && <span className="badge nm">Атаулы</span>}
          <LevelBadge lv={r.lv} />
          {r.st !== 'ok' && <StatusBadge st={r.st} />}
        </span>
      </div>
      <Equation r={r} mode={prog.formula} />
    </A>
  );
}

// ───── Реакция карточкасы (толық бет)
export function ReactionPage({ id }: { id: string }) {
  const r = RX[id];
  const prog = useProgress();
  const [mode, setMode] = useState<FormulaMode | 'struct'>(prog.formula);
  useEffect(() => { if (r) markViewed(r.id); }, [r?.id]);
  const quiz = useMemo(() => {
    if (!r || !usable(r)) return null;
    if (PRODUCT_POOL.includes(r)) return productQ(r.id);
    if (REAGENT_POOL.includes(r)) return reagentQ(r.id);
    return null;
  }, [r?.id]);
  if (!r) return <div className="page"><p>Реакция табылмады.</p><A to="lib">Үйрену бөліміне оралу</A></div>;
  const e = eqOf(r);
  const fav = prog.favorites.includes(r.id);
  const ids = e ? [...e.left.map((t) => ['Реагент', t.id] as const), ...e.right.map((t) => ['Өнім', t.id] as const)] : [];
  const anyStruct = e ? [...e.left, ...e.right].some((t) => hasStructure(t.id)) : false;
  const from = e?.left.map((t) => t.id).find(isOrganic);
  const to = e?.right.map((t) => t.id).find(isOrganic);
  const onMetro = from && to && STATION_IDS.includes(from) && STATION_IDS.includes(to) && usable(r);
  const related = from ? (BY_SUBSTANCE[from]?.asReactant ?? []).filter((x) => x !== r.id).slice(0, 8) : [];
  const summary = r.x.split(/(?<=\.)\s/)[0];
  return (
    <article className="page rpage">
      <nav className="crumbs" aria-label="Жол">
        <A to="lib">Үйрену</A>
        {r.at.map((a) => { const [t, s] = a.split(':'); return <A key={a} to={'t-' + t}>{TOPIC[t].name} · {s === 'get' ? 'алыну' : 'қасиеті'}</A>; })}
      </nav>
      <header className="rhead">
        <div>
          <h1>{r.t}</h1>
          <p className="lead">{summary}</p>
          <div className="badges">
            <TypeBadge ty={r.ty} /><LevelBadge lv={r.lv} />
            {r.st !== 'ok' && <StatusBadge st={r.st} />}
            {r.q && <span className="badge q">Сапалық реакция</span>}
            {r.nm && <A to={'n-' + r.nm} className="badge nm">{NAMED_BY_ID[r.nm].name}</A>}
            {r.rule && <A to={'n-' + r.rule} className="badge nm">{NAMED_BY_ID[r.rule].name}</A>}
          </div>
        </div>
        <button className={'btn ghost fav' + (fav ? ' on' : '')} onClick={() => toggleFav(r.id)} aria-pressed={fav}><Icon n="star" />{fav ? 'Сақталды' : 'Сақтау'}</button>
      </header>

      {r.st === 'check' && <div className="warn" role="note"><b>Тексеруді қажет етеді.</b> {r.n}</div>}

      <section className="card eqcard">
        <Equation r={r} mode={mode} big />
        {e && (
          <div className="eqbar">
            <span className="muted small">Формула түрі:</span>
            <div className="seg" role="group" aria-label="Формула түрі">
              {([['sf', 'Құрылымдық жазба'], ['hill', 'Молекулалық'], ...(anyStruct ? [['struct', 'Сызба']] : [])] as [string, string][]).map(([m, l]) => (
                <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => { setMode(m as FormulaMode); if (m !== 'struct') update((p) => { p.formula = m as 'sf' | 'hill'; }); }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {e && !anyStruct && <BalanceTiles r={r} />}
      </section>

      {hasScene(r.id) ? <Film steps={[{ rid: r.id }]} /> : anyStruct && e && <ReactionPlayer r={r} />}

      <section className="card explain">
        <h2 className="h-card">Не болады?</h2>
        <div className="exp-list">
          <div className="exp-item"><span className="exp-ic" aria-hidden>💡</span><div><b>Түсіндірме</b><p>{r.x}</p>{r.rule && <p className="muted small">Ереже: <A to={'n-' + r.rule}>{NAMED_BY_ID[r.rule].name}</A> — {NAMED_BY_ID[r.rule].memo}</p>}</div></div>
          <div className="exp-item"><span className="exp-ic" aria-hidden>🔗</span><div><b>Байланыстар</b><p>{r.b ?? defaultBond(r)}</p></div></div>
          {r.ob && <div className="exp-item"><span className="exp-ic" aria-hidden>👁</span><div><b>Не байқалады</b><p>{r.ob}</p></div></div>}
          <div className="exp-item warnish"><span className="exp-ic" aria-hidden>⚠️</span><div><b>Жиі жіберілетін қате</b><p>{r.m ?? defaultMistake(r)}</p></div></div>
        </div>
      </section>

      <section className="card">
        <h2 className="h-card">Өзіңді тексер</h2>
        {quiz ? <QuizBlock q={quiz} compact /> : <p className="muted">Бұл реакция үшін жаттығу жоқ. <A to="practice">Жаттығу бөліміне өту</A></p>}
      </section>

      <details className="card more">
        <summary>Толығырақ: заттар, реакция түрі, дереккөз</summary>
        {e && (
          <div className="tablewrap"><table className="subs">
            <thead><tr><th>Рөлі</th><th>Атауы</th><th>Формула</th><th>Класы</th></tr></thead>
            <tbody>
              {ids.map(([role, sid], i) => (
                <tr key={i}>
                  <td>{role}</td>
                  <td>{isOrganic(sid) ? <A to={subHash(sid)}>{SUB[sid].name}</A> : SUB[sid].name}</td>
                  <td><F s={formulaText(sid, 'hill')} />{SUB[sid].sf && SUB[sid].sf !== SUB[sid].cf && <div className="muted small"><F s={SUB[sid].sf!} /></div>}</td>
                  <td><ClassChip cls={SUB[sid].cls} small /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p><b>Реакция түрі:</b> {TYPE_NAMES[r.ty]}</p>
        <p><b>Дереккөз:</b> {r.src > 0 ? `«Органика реакциялар жинағы» (PDF), ${r.src}-бет` : 'Жинақта жоқ — мектеп курсынан қосылды'}. <b>Мәртебесі:</b> {STATUS_NAMES[r.st]}. {e ? 'Атомдық баланс автоматты түрде тексерілді.' : 'Сипаттамалық сапалық реакция (теңдеусіз).'}</p>
        {r.n && <p className="note">{r.n}</p>}
      </details>

      <div className="rel">
        {onMetro && <button className="btn ghost" onClick={() => { metroIntent.from = from; metroIntent.to = to; go('metro'); }}><Icon n="map" />Картадан көру</button>}
        {related.length > 0 && (
          <div>
            <h2 className="h-card">{shortName(from!)} қатысатын басқа реакциялар</h2>
            <div className="chips">{related.map((x) => <A key={x} to={'r-' + x} className="chip">{RX[x].t}</A>)}</div>
          </div>
        )}
      </div>
    </article>
  );
}
