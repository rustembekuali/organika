// «Зертхана»: оқушы мен мұғалім реакцияны өздері визуалды түрде құрастырады
import React, { useMemo, useState, useEffect } from 'react';
import { REACTIONS, RX, eqOf, usable, isOrganic } from '../data/index';
import { SUB, SUBSTANCES, formulaOf } from '../data/substances';
import { CLASS_INFO, TYPE_NAMES } from '../data/topics';
import type { Reaction } from '../data/types';
import { checkBalance, coefValue, parseFormula } from '../lib/chem';
import { F, formulaText, shortName, plainFormula, shuffle } from '../lib/format';
import { searchSubstances } from '../lib/search';
import { STATION_IDS } from '../lib/graph';
import { useProgress, update, type CustomReaction } from '../lib/store';
import { Structure, hasStructure } from '../components/Structure';
import { Film, hasScene } from '../components/Film';
import { Equation, ReactionPlayer } from '../components/Reaction';
import { A, Icon, ClassChip } from '../components/ui';

const REAGENTS = ['h2', 'h2o', 'br2', 'cl2', 'hbr', 'hcl', 'hi', 'o2', 'o_ox', 'h_red', 'naoh', 'koh', 'na', 'cuo', 'ag2o', 'cuoh2', 'kmno4', 'hno3', 'h2so4', 'nh3', 'hcn', 'nahso3', 'fecl3', 'co', 'co2', 'c', 'cac2', 'al4c3', 'na2co3', 'cao', 'ca', 'na2o', 'nanh2'];
const CONDS = ['t°', 'hν', 'кат.', 'p', 'Ni', 'H₂SO₄ (конц.)', 'AlCl₃', 'HgSO₄', 'спирттегі ерітінді', 'сулы ерітінді', 'NH₃ (ерітінді)'];

/** Палитра: сүйреп апаруға немесе басып қосуға болатын заттар */
function Palette({ onPick, hint }: { onPick: (id: string) => void; hint: string }) {
  const [q, setQ] = useState('');
  const [cls, setCls] = useState<'common' | 'reag' | 'all'>('common');
  const base = cls === 'reag' ? REAGENTS : cls === 'common' ? STATION_IDS : SUBSTANCES.filter((s) => s.cls !== 'inorg').map((s) => s.id);
  const list = useMemo(() => searchSubstances(q, q ? SUBSTANCES.map((s) => s.id) : base), [q, cls]);
  return (
    <aside className="palette card" aria-label="Заттар палитрасы">
      <h2 className="h-sm">Заттар</h2>
      <input type="search" placeholder="Іздеу: этанол, C2H4, Br2…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Зат іздеу" />
      <div className="seg" role="group" aria-label="Топ">
        {([['common', 'Негізгі'], ['reag', 'Реагенттер'], ['all', 'Барлығы']] as const).map(([k, l]) => (
          <button key={k} className={cls === k ? 'on' : ''} aria-pressed={cls === k} onClick={() => { setCls(k); setQ(''); }}>{l}</button>
        ))}
      </div>
      <p className="muted small">{hint}</p>
      <div className="pal-list">
        {list.slice(0, 120).map((id) => (
          <button key={id} className="pal-chip" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => onPick(id)} title={SUB[id].name} style={{ ['--c' as string]: CLASS_INFO[SUB[id].cls].color }}>
            <span className="pc-f"><F s={formulaText(id)} /></span>
            <span className="pc-n">{shortName(id)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function DropZone({ label, children, onDrop, active, onActivate, className }: { label: string; children: React.ReactNode; onDrop: (id: string) => void; active?: boolean; onActivate?: () => void; className?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div className={'dropzone' + (over ? ' over' : '') + (active ? ' active' : '') + (className ? ' ' + className : '')}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/plain'); if (SUB[id]) onDrop(id); }}
      onClick={onActivate} aria-label={label}>
      <span className="dz-label">{label}</span>
      {children}
    </div>
  );
}

function Token({ id, k, onRemove, onK }: { id: string; k?: string; onRemove: () => void; onK?: (d: number) => void }) {
  return (
    <div className="token">
      {onK && (
        <div className="coefctl">
          <button onClick={(e) => { e.stopPropagation(); onK(-1); }} aria-label="Коэффициентті азайту">−</button>
          <span>{k || '1'}</span>
          <button onClick={(e) => { e.stopPropagation(); onK(1); }} aria-label="Коэффициентті арттыру">+</button>
        </div>
      )}
      {hasStructure(id) ? <Structure id={id} maxH={110} /> : <span className="inorg-pill big"><F s={SUB[id].cf} /><small>{SUB[id].name}</small></span>}
      <button className="tk-x" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={SUB[id].name + ' — алып тастау'}><Icon n="x" size={14} /></button>
    </div>
  );
}

// ───────────────────────── 1. Реакцияны өзің жүргіз
function RunLab() {
  const [sel, setSel] = useState<string[]>([]);
  const [cond, setCond] = useState<string[]>([]);
  const [guess, setGuess] = useState<string | null>(null);
  const [zone, setZone] = useState<'react' | 'guess'>('react');
  const [ran, setRan] = useState<{ matches: Reaction[]; partial: { r: Reaction; missing: string[] }[] } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const add = (id: string) => {
    setRan(null); setPick(null);
    if (zone === 'guess') { setGuess(id); setZone('react'); return; }
    setSel((s) => (s.includes(id) ? s : [...s, id]));
  };
  const run = () => {
    const S = new Set(sel);
    const pool = REACTIONS.filter((r) => usable(r) && r.eq);
    const matches = pool.filter((r) => {
      const L = new Set(eqOf(r)!.left.map((t) => t.id));
      return L.size === S.size && [...S].every((x) => L.has(x));
    });
    const score = (r: Reaction) => cond.filter((c) => (r.c ?? '').toLowerCase().includes(c.toLowerCase().replace(/[()]/g, '').split(' ')[0])).length;
    matches.sort((a, b) => score(b) - score(a));
    const partial = matches.length ? [] : pool
      .filter((r) => { const L = eqOf(r)!.left.map((t) => t.id); return sel.every((x) => L.includes(x)); })
      .map((r) => ({ r, missing: eqOf(r)!.left.map((t) => t.id).filter((x) => !sel.includes(x)) }))
      .slice(0, 6);
    setRan({ matches, partial });
    setPick(matches[0]?.id ?? null);
  };
  const chosen = pick ? RX[pick] : null;
  const prods = chosen ? eqOf(chosen)!.right.map((t) => t.id) : [];
  return (
    <div className="lab-grid">
      <Palette onPick={add} hint={zone === 'guess' ? 'Енді болжаған өнімді таңда.' : 'Затты сахнаға сүйреп апар немесе басып қос.'} />
      <section className="lab-main">
        <div className="lab-stage">
          <DropZone label="Реакцияға түсетін заттар" onDrop={(id) => { setZone('react'); add(id); }} active={zone === 'react'} onActivate={() => setZone('react')} className="react-zone">
            <div className="tokens">
              {sel.length === 0 && <span className="dz-empty">Заттарды осында әкел (мысалы, этилен + бром)</span>}
              {sel.map((id, i) => <React.Fragment key={id}>{i > 0 && <span className="op big">+</span>}<Token id={id} onRemove={() => { setSel(sel.filter((x) => x !== id)); setRan(null); }} /></React.Fragment>)}
            </div>
          </DropZone>
          <div className="lab-arrow">
            <div className="conds">
              {CONDS.map((c) => <button key={c} className={'chip sm' + (cond.includes(c) ? ' on' : '')} aria-pressed={cond.includes(c)} onClick={() => setCond(cond.includes(c) ? cond.filter((x) => x !== c) : [...cond, c])}>{c}</button>)}
            </div>
            <span className="big-arrow">⟶</span>
          </div>
          <DropZone label="Болжам (міндетті емес)" onDrop={(id) => setGuess(id)} active={zone === 'guess'} onActivate={() => setZone('guess')} className="guess-zone">
            <div className="tokens">
              {guess ? <Token id={guess} onRemove={() => setGuess(null)} /> : <span className="dz-empty">Қандай өнім түзіледі деп ойлайсың? Басып, палитрадан таңда.</span>}
            </div>
          </DropZone>
        </div>
        <div className="row gap wrap">
          <button className="btn big" onClick={run} disabled={!sel.length}><Icon n="flask" />Реакцияны жүргізу</button>
          <button className="btn ghost" onClick={() => { setSel([]); setGuess(null); setRan(null); setCond([]); }}>Тазалау</button>
          <button className="btn ghost" onClick={() => { const r = shuffle(REACTIONS.filter((x) => usable(x) && hasScene(x.id) && eqOf(x)!.left.length <= 3))[0]; setSel([...new Set(eqOf(r)!.left.map((t) => t.id))]); setGuess(null); setRan(null); }}>Кездейсоқ тапсырма</button>
        </div>

        {ran && (
          <div className="lab-result" aria-live="polite">
            {ran.matches.length === 0 ? (
              <div className="warn">
                <b>Базада бұл заттардың реакциясы жоқ.</b> Жоқ реакцияны ойдан құрмаймыз.
                {ran.partial.length > 0 && (
                  <>
                    <p className="small">Бұл заттар мына реакцияларға қатысады — жетіспейтін затты қосып көр:</p>
                    <ul className="plain">{ran.partial.map(({ r, missing }) => (
                      <li key={r.id}><button className="chip sm" onClick={() => { setSel([...sel, ...missing.filter((m) => !sel.includes(m))]); setRan(null); }}>+ {missing.map((m) => plainFormula(SUB[m].cf)).join(', ')}</button> → <A to={'r-' + r.id}>{r.t}</A></li>
                    ))}</ul>
                  </>
                )}
              </div>
            ) : (
              <>
                {ran.matches.length > 1 && (
                  <div className="card">
                    <p><b>Бұл заттар бірнеше жолмен әрекеттеседі</b> — нәтиже шартқа байланысты. Біреуін таңда:</p>
                    <div className="chips">{ran.matches.map((m) => <button key={m.id} className={'chip' + (pick === m.id ? ' on' : '')} onClick={() => setPick(m.id)}>{m.c ?? 'шартсыз'} → {shortName(eqOf(m)!.right.map((t) => t.id).find(isOrganic) ?? eqOf(m)!.right[0].id)}</button>)}</div>
                  </div>
                )}
                {chosen && guess && (
                  <div className={'feedback ' + (prods.includes(guess) ? 'ok' : 'bad')}>
                    <div className="fb-head"><Icon n={prods.includes(guess) ? 'check' : 'x'} />{prods.includes(guess) ? 'Болжамың дұрыс!' : 'Болжам сәйкес келмеді'}</div>
                    <p>{prods.includes(guess) ? `${shortName(guess)} шынымен түзіледі.` : `Сен ${shortName(guess)} деп болжадың, ал бұл жағдайда ${prods.filter(isOrganic).map(shortName).join(', ') || prods.map(shortName).join(', ')} түзіледі.`}</p>
                  </div>
                )}
                {chosen && (hasScene(chosen.id) ? <Film key={chosen.id} steps={[{ rid: chosen.id }]} autoplay /> : <><div className="card"><Equation r={chosen} big /></div><ReactionPlayer r={chosen} /></>)}
                {chosen && <p className="muted">{chosen.x} <A to={'r-' + chosen.id}>Толық карточка →</A></p>}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────────────────── 2. Өз реакцияңды қос
function autoBalance(left: { k: string; id: string }[], right: { k: string; id: string }[]): { left: string[]; right: string[] } | null {
  const all = [...left, ...right];
  if (all.length < 2 || all.length > 6) return null;
  let atoms: Record<string, number>[];
  try { atoms = all.map((t) => parseFormula(formulaOf(t.id)).atoms); } catch { return null; }
  const els = [...new Set(atoms.flatMap((a) => Object.keys(a)))];
  const n = all.length, max = n <= 4 ? 12 : n === 5 ? 9 : 6;
  const c = new Array(n).fill(1);
  let best: number[] | null = null, bestSum = Infinity;
  const rec = (i: number, sum: number) => {
    if (sum >= bestSum) return;
    if (i === n) {
      for (const el of els) {
        let s = 0;
        for (let j = 0; j < n; j++) s += (j < left.length ? 1 : -1) * c[j] * (atoms[j][el] || 0);
        if (s !== 0) return;
      }
      best = c.slice(); bestSum = sum; return;
    }
    for (let v = 1; v <= max; v++) { c[i] = v; rec(i + 1, sum + v); }
  };
  rec(0, 0);
  if (!best) return null;
  const b = best as number[];
  const f = (v: number) => (v === 1 ? '' : String(v));
  return { left: b.slice(0, left.length).map(f), right: b.slice(left.length).map(f) };
}

function EditorLab() {
  const prog = useProgress();
  const [left, setLeft] = useState<{ k: string; id: string }[]>([]);
  const [right, setRight] = useState<{ k: string; id: string }[]>([]);
  const [zone, setZone] = useState<'L' | 'R'>('L');
  const [t, setT] = useState('');
  const [c, setC] = useState('');
  const [ty, setTy] = useState('add');
  const [x, setX] = useState('');
  const [msg, setMsg] = useState('');
  const [play, setPlay] = useState<CustomReaction | null>(null);
  const add = (id: string) => {
    const set = zone === 'L' ? setLeft : setRight;
    set((s) => (s.some((q) => q.id === id) ? s : [...s, { k: '', id }]));
  };
  const bump = (side: 'L' | 'R', i: number, d: number) => {
    const set = side === 'L' ? setLeft : setRight;
    set((s) => s.map((q, j) => (j === i ? { ...q, k: (() => { const v = Math.max(1, coefValue(q.k) + d); return v === 1 ? '' : String(v); })() } : q)));
  };
  const eq = { left, right, rev: false };
  const bal = left.length && right.length ? checkBalance(eq, formulaOf) : null;
  const existing = useMemo(() => {
    if (!left.length || !right.length) return null;
    const L = new Set(left.map((q) => q.id)), R = new Set(right.map((q) => q.id));
    return REACTIONS.find((r) => { const e = eqOf(r); if (!e) return false; const l = new Set(e.left.map((q) => q.id)), rr = new Set(e.right.map((q) => q.id)); return l.size === L.size && rr.size === R.size && [...L].every((q) => l.has(q)) && [...R].every((q) => rr.has(q)); }) ?? null;
  }, [left, right]);
  const save = () => {
    if (!bal?.ok) { setMsg('Алдымен теңдеуді теңестір: атомдар саны екі жақта бірдей болуы керек.'); return; }
    const title = t.trim() || `${shortName(left.find((q) => isOrganic(q.id))?.id ?? left[0].id)} → ${shortName(right.find((q) => isOrganic(q.id))?.id ?? right[0].id)}`;
    const cr: CustomReaction = { id: 'u' + Date.now().toString(36), t: title, left, right, c: c.trim() || undefined, ty, x: x.trim() || undefined, ts: Date.now() };
    update((p) => { p.custom = [cr, ...(p.custom ?? [])]; });
    setMsg('Сақталды: «' + title + '». Төмендегі «Менің реакцияларым» тізімінде.');
  };
  const json = (r: CustomReaction) => JSON.stringify({ id: r.id, t: r.t, eq: [r.left.map((q) => (q.k ? q.k + ' ' : '') + q.id).join(' + '), r.right.map((q) => (q.k ? q.k + ' ' : '') + q.id).join(' + ')].join(' -> '), c: r.c, ty: r.ty, x: r.x, src: 0, st: 'check' }, null, 2);
  const side = (arr: { k: string; id: string }[], s: 'L' | 'R') => arr.map((q, i) => (
    <React.Fragment key={q.id}>{i > 0 && <span className="op big">+</span>}<Token id={q.id} k={q.k} onK={(d) => bump(s, i, d)} onRemove={() => (s === 'L' ? setLeft : setRight)(arr.filter((z) => z.id !== q.id))} /></React.Fragment>
  ));
  return (
    <div className="lab-grid">
      <Palette onPick={add} hint={`Басқанда зат ${zone === 'L' ? 'реагенттерге' : 'өнімдерге'} қосылады. Аймақты ауыстыру үшін оны бас.`} />
      <section className="lab-main">
        <div className="lab-stage editor">
          <DropZone label="Реагенттер" onDrop={(id) => { setZone('L'); setLeft((s) => (s.some((q) => q.id === id) ? s : [...s, { k: '', id }])); }} active={zone === 'L'} onActivate={() => setZone('L')}>
            <div className="tokens">{left.length ? side(left, 'L') : <span className="dz-empty">Реагенттерді осында әкел</span>}</div>
          </DropZone>
          <div className="lab-arrow"><span className="small muted">{c || 'шарт'}</span><span className="big-arrow">⟶</span></div>
          <DropZone label="Өнімдер" onDrop={(id) => { setZone('R'); setRight((s) => (s.some((q) => q.id === id) ? s : [...s, { k: '', id }])); }} active={zone === 'R'} onActivate={() => setZone('R')}>
            <div className="tokens">{right.length ? side(right, 'R') : <span className="dz-empty">Өнімдерді осында әкел</span>}</div>
          </DropZone>
        </div>
        {bal && (
          <div className="row gap wrap">
            <div className="tiles">
              {bal.elements.map((el) => <div key={el} className={'tile ' + ((bal.left[el] ?? 0) === (bal.right[el] ?? 0) ? 'ok' : 'bad')}><span className="tl">{el}</span><span className="tv">{bal.left[el] ?? 0}<span className="sep">|</span>{bal.right[el] ?? 0}</span></div>)}
              <div className={'tile verdict ' + (bal.ok ? 'ok' : 'bad')}><span className="tl">баланс</span><span className="tv">{bal.ok ? '✓' : '✗'}</span></div>
            </div>
            <button className="btn ghost" onClick={() => { const b = autoBalance(left, right); if (b) { setLeft(left.map((q, i) => ({ ...q, k: b.left[i] }))); setRight(right.map((q, i) => ({ ...q, k: b.right[i] }))); setMsg(''); } else setMsg('Автоматты теңестіру мүмкін болмады: заттар құрамын тексер (кейбір элемент тек бір жақта болуы мүмкін).'); }}>Автоматты теңестіру</button>
          </div>
        )}
        {existing && <div className="note">Бұл реакция базада бар: <A to={'r-' + existing.id}>{existing.t}</A>{hasScene(existing.id) ? ' — оның атомдық анимациясы бар.' : '.'}</div>}
        <div className="form-grid card">
          <label>Атауы<input value={t} onChange={(e) => setT(e.target.value)} placeholder="мысалы: Пропенді бромдау" /></label>
          <label>Шарттар<input value={c} onChange={(e) => setC(e.target.value)} placeholder="мысалы: t°, Ni" /></label>
          <label>Реакция түрі<select value={ty} onChange={(e) => setTy(e.target.value)}>{Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="wide">Түсіндірме<textarea value={x} onChange={(e) => setX(e.target.value)} rows={2} placeholder="Неге осылай жүреді? Қысқаша жаз." /></label>
          <div className="row gap wrap wide">
            <button className="btn" onClick={save} disabled={!left.length || !right.length}>Сақтау</button>
            <button className="btn ghost" onClick={() => { setLeft([]); setRight([]); setT(''); setC(''); setX(''); setMsg(''); }}>Тазалау</button>
            {msg && <span className="small" role="status">{msg}</span>}
          </div>
        </div>

        <h2 className="h-md">Менің реакцияларым ({prog.custom?.length ?? 0})</h2>
        <p className="muted small">Бұл реакциялар тек осы браузерде сақталады және «тексерілмеген» деп белгіленеді. Базаға қосу үшін JSON-ды көшіріп, әкімшіге (мұғалімге) жібер.</p>
        {(prog.custom ?? []).length === 0 && <p className="muted">Әлі жоқ.</p>}
        <div className="rlist">
          {(prog.custom ?? []).map((r) => (
            <div key={r.id} className="rrow custom">
              <div className="rrow-top"><span className="rrow-t">{r.t}</span><span className="rrow-b"><span className="badge st-check">Тексерілмеген</span><span className="badge ty">{TYPE_NAMES[r.ty]}</span></span></div>
              <div className="eq">{r.left.map((q, i) => <React.Fragment key={i}>{i > 0 && <span className="op">+</span>}<span className="term">{q.k && <span className="coef">{q.k}</span>}<F s={formulaText(q.id)} /></span></React.Fragment>)}
                <span className="arrow">{r.c && <span className="cond">{r.c}</span>}<span className="shaft">⟶</span></span>
                {r.right.map((q, i) => <React.Fragment key={i}>{i > 0 && <span className="op">+</span>}<span className="term">{q.k && <span className="coef">{q.k}</span>}<F s={formulaText(q.id)} /></span></React.Fragment>)}
              </div>
              {r.x && <p className="small muted">{r.x}</p>}
              <div className="row gap wrap">
                <button className="btn sm" onClick={() => setPlay(play?.id === r.id ? null : r)}><Icon n="play" size={16} />Анимация</button>
                <button className="btn ghost sm" onClick={() => { try { navigator.clipboard.writeText(json(r)).then(() => setMsg('JSON көшірілді.'), () => setMsg('Көшіру мүмкін болмады — төмендегі мәтінді белгілеп ал.')); } catch { setMsg('Көшіру мүмкін болмады.'); } }}>JSON көшіру</button>
                <button className="btn ghost sm" onClick={() => update((p) => { p.custom = p.custom.filter((z) => z.id !== r.id); })}>Өшіру</button>
              </div>
              {play?.id === r.id && <CustomFilm r={r} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Қолмен қосылған реакцияның анимациясы. Базада бар болса — атомдық сахна; болмаса — заттар ортаға жиналып, өнімдер пайда болады. */
function CustomFilm({ r }: { r: CustomReaction }) {
  const base = REACTIONS.find((q) => { const e = eqOf(q); return e && hasScene(q.id) && e.left.map((z) => z.id).sort().join() === r.left.map((z) => z.id).sort().join() && e.right.map((z) => z.id).sort().join() === r.right.map((z) => z.id).sort().join(); });
  const [phase, setPhase] = useState(0);
  const prog = useProgress();
  useEffect(() => {
    if (base || prog.motion === 'reduce') return;
    const id = setTimeout(() => setPhase((p) => (p + 1) % 4), phase === 3 ? 2600 : 1500);
    return () => clearTimeout(id);
  }, [phase, base]);
  if (base) return <Film steps={[{ rid: base.id }]} autoplay />;
  const bal = checkBalance({ left: r.left, right: r.right, rev: false }, formulaOf);
  return (
    <div className={'film lite ph' + phase}>
      <header className="film-head">
        <div className="film-left">
          <div className="film-crumb"><span className="stage" style={{ ['--c' as string]: '#f2b544' }}>{['Бастапқы заттар', 'Реакция орталығы', 'Айналу', 'Өнімдер'][phase]}</span><span className="crumb-t">Пайдаланушы қосқан реакция · атомдық сәйкестік көрсетілмейді</span></div>
          <h3 className="film-title"><span className="num">①</span> {r.t}</h3>
          <p className="film-sub">{TYPE_NAMES[r.ty]}{r.c ? ' · ' + r.c : ''}</p>
        </div>
        <div className="film-tiles"><div className="ftile"><span className="tl">баланс</span><span className="tv">{bal.ok ? '✓' : '✗'}</span></div></div>
      </header>
      <div className="lite-stage">
        <div className="lite-row L">{r.left.map((q, i) => <React.Fragment key={i}>{i > 0 && <span className="f-plus-h">+</span>}<span className="lite-mol">{q.k && <b className="lite-k">{q.k}</b>}{hasStructure(q.id) ? <Structure id={q.id} maxH={120} /> : <span className="lite-pill">{plainFormula(SUB[q.id].cf)}</span>}</span></React.Fragment>)}</div>
        <div className="lite-row R">{r.right.map((q, i) => <React.Fragment key={i}>{i > 0 && <span className="f-plus-h">+</span>}<span className="lite-mol">{q.k && <b className="lite-k">{q.k}</b>}{hasStructure(q.id) ? <Structure id={q.id} maxH={120} /> : <span className="lite-pill">{plainFormula(SUB[q.id].cf)}</span>}</span></React.Fragment>)}</div>
      </div>
      <div className="film-ctl"><button className="fbtn" onClick={() => setPhase((p) => (p + 1) % 4)}><Icon n="next" />Келесі кезең</button></div>
      <div className="film-bar" aria-hidden>{[0, 1, 2, 3].map((k) => <span key={k}><i style={{ width: k <= phase ? '100%' : '0%', background: '#f2b544' }} /></span>)}</div>
    </div>
  );
}

export function Lab() {
  const [tab, setTab] = useState<'run' | 'edit'>('run');
  return (
    <div className="page lab">
      <header className="phead">
        <h1>Зертхана</h1>
        <p className="lead">Реакцияны өзің құрастыр: заттарды сахнаға сүйреп әкел (телефонда — басу жеткілікті). Базада осындай реакция болса, ол видеодағыдай анимациямен көрсетіледі. Өз реакцияңды қосып, теңестіріп, сақтауға да болады.</p>
      </header>
      <div className="seg big-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'run'} className={tab === 'run' ? 'on' : ''} onClick={() => setTab('run')}>Реакцияны өзің жүргіз</button>
        <button role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Өз реакцияңды қос</button>
      </div>
      {tab === 'run' ? <RunLab /> : <EditorLab />}
    </div>
  );
}
