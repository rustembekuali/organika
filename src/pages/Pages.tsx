import React, { useMemo, useState, useEffect, useRef } from 'react';
import { REACTIONS, RX, reactionsOf, eqOf, BY_SUBSTANCE, usable, isOrganic } from '../data/index';
import { SUB, SUBSTANCES } from '../data/substances';
import { TOPICS, TOPIC, CLASS_INFO, TYPE_NAMES, LEVEL_NAMES, STATUS_NAMES } from '../data/topics';
import { NAMED, NAMED_BY_ID } from '../data/named';
import { SCHOOL, LEARNING_PATH } from '../data/school';
import { FIND_ERRORS, IDENTIFY } from '../data/exercises';
import type { Reaction } from '../data/types';
import { searchReactions } from '../lib/search';
import { F, formulaText, shortName } from '../lib/format';
import { useProgress, markTopic, resetProgress, isPersisted, setName, exportCode, importCode } from '../lib/store';
import { makeQ, fromKey, MODE_INFO, type Mode, type Question } from '../lib/quiz';
import { Equation, ReactionRow, Arrow } from '../components/Reaction';
import { QuizBlock } from '../components/Quiz';
import { Structure, hasStructure } from '../components/Structure';
import { Film, FilmOverlay, type FilmStep } from '../components/Film';
import { A, ClassChip, Icon, Empty, LevelBadge, StatusBadge, go, subHash, LearnTabs } from '../components/ui';
import { STATION_IDS, metroIntent } from '../lib/graph';

const usableCount = REACTIONS.filter(usable).length;

// ───────────────────────── Басты бет
export function Home() {
  const prog = useProgress();
  const [q, setQ] = useState('');
  const day = Math.floor(Date.now() / 86400000);
  const pool = REACTIONS.filter((r) => usable(r) && (r.q || r.nm) && r.eq);
  const today = pool[day % pool.length];
  const viewed = Object.keys(prog.viewed).length;
  const last = prog.lastTopic ? TOPIC[prog.lastTopic] : null;
  const lastCount = last ? reactionsOf(last.id).length : 0;
  const lastSeen = last ? reactionsOf(last.id).filter((r) => prog.viewed[r.id]).length : 0;
  const nextTopic = LEARNING_PATH.find((p) => { const rs = reactionsOf(p.topic); return rs.some((r) => !prog.viewed[r.id]); });
  const classes = Object.entries(CLASS_INFO).filter(([k]) => !['inorg', 'other', 'salt', 'nitro'].includes(k));
  const tiles: [string, string, string, string][] = [
    ['lib', 'book', 'Үйрену', 'Тақырыптар, түсіндірмелер, атаулы реакциялар'],
    ['metro', 'map', 'Реакциялар картасы', 'Бір заттан екіншісіне қалай жетуге болады'],
    ['lab', 'flask', 'Зертхана', 'Заттарды қосып, реакцияны өзің жүргіз'],
    ['practice', 'target', 'Жаттығу', '6 түрлі тапсырма және қайталау'],
  ];
  return (
    <div className="page home">
      <section className="hero">
        <h1>{prog.name ? <>Сәлем, {prog.name}!</> : <>Органикалық реакцияларды <span className="hl">көріп, түсініп</span> үйрен</>}</h1>
        <p className="lead">Әр реакцияда атомдардың қалай жылжитынын анимациямен көр, неге солай жүретінін оқы, кейін өзіңді тексер.</p>
        <form className="bigsearch" role="search" onSubmit={(e) => { e.preventDefault(); sessionStorageSet('q', q); go('lib'); }}>
          <Icon n="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Реакцияны іздеу: этанол, C2H4, бромдау…" aria-label="Реакцияны іздеу" />
          <button className="btn">Іздеу</button>
        </form>
      </section>

      {!prog.name ? <NameCard /> : (
        <section className="card continue">
          <div className="continue-main">
            <h2 className="h-card">Жалғастыр</h2>
            {last ? <p>Соңғы тақырып: <A to={'t-' + last.id}><b>{last.name}</b></A> — {lastSeen}/{lastCount} реакция қаралды.</p> : <p>Бастау үшін ұсынылатын тақырып:</p>}
            {nextTopic && <A to={'t-' + (last && lastSeen < lastCount ? last.id : nextTopic.topic)} className="btn">{last && lastSeen < lastCount ? 'Тақырыпты жалғастыру' : TOPIC[nextTopic.topic].name + ' тақырыбын бастау'} <Icon n="arrow" size={16} /></A>}
          </div>
          <div className="continue-side">
            <Meter v={viewed} max={REACTIONS.length} label={`Барлығы: ${viewed}/${REACTIONS.length}`} />
            {prog.review.length > 0 && <A to="p-review" className="btn ghost sm">Қайталау керек: {prog.review.length}</A>}
          </div>
        </section>
      )}

      <section className="tiles4" aria-label="Негізгі бөлімдер">
        {tiles.map(([to, ic, t, d]) => (
          <A key={to} to={to} className="tile4">
            <span className="t4-ic"><Icon n={ic} size={26} /></span>
            <span className="t4-t">{t}</span>
            <span className="t4-d">{d}</span>
          </A>
        ))}
      </section>

      <h2 className="h-md">Реакция қалай жүреді? Көріп ал</h2>
      <HeroFilm />

      <div className="home-grid">
        <section className="card today">
          <span className="eyebrow">Күн реакциясы</span>
          <h2><A to={'r-' + today.id}>{today.t}</A></h2>
          <Equation r={today} mode={prog.formula} />
          <p className="muted">{today.x.split(/(?<=\.)\s/)[0]}</p>
          <A to={'r-' + today.id} className="btn sm">Ашу <Icon n="arrow" size={16} /></A>
        </section>
        <section className="card">
          <h2 className="h-card">Заттар кластары</h2>
          <div className="class-grid">
            {classes.map(([k, c]) => {
              const topic = TOPICS.find((t) => t.cls === k);
              return (
                <A key={k} to={topic ? 't-' + topic.id : 'lib'} className="class-card">
                  <span className="cc-sym" style={{ background: c.color }} aria-hidden>{c.short}</span>
                  <span className="cc-name">{c.name}</span>
                </A>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Бірінші кіргенде: аты-жөнін сұрау (тіркелусіз) */
function NameCard() {
  const [v, setV] = useState('');
  return (
    <section className="card namecard">
      <div>
        <h2 className="h-card">Танысайық</h2>
        <p className="muted">Атыңды жаз — прогресің осы құрылғыда сақталады. Тіркелу мен құпиясөз қажет емес.</p>
      </div>
      <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); if (v.trim()) setName(v); }}>
        <input className="name-in" value={v} onChange={(e) => setV(e.target.value)} placeholder="Атың, мысалы: Айгерім" aria-label="Атың" maxLength={40} />
        <button className="btn" disabled={!v.trim()}>Бастау</button>
      </form>
    </section>
  );
}

const sessionStorageSet = (k: string, v: string) => { try { sessionStorage.setItem('organika-' + k, v); } catch { memQ[k] = v; } };
const sessionStorageGet = (k: string) => { try { return sessionStorage.getItem('organika-' + k) ?? ''; } catch { return memQ[k] ?? ''; } };
const memQ: Record<string, string> = {};

export function Meter({ v, max, label }: { v: number; max: number; label: string }) {
  const p = max ? Math.round((v / max) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter-l"><span>{label}</span><span>{p}%</span></div>
      <div className="meter-b" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}><span style={{ width: p + '%' }} /></div>
    </div>
  );
}

// ───────────────────────── Кітапхана (іздеу + сүзгілер)
interface Filters { topic: string; type: string; level: string; section: string; flag: string; src: string; st: string }
const EMPTY_F: Filters = { topic: '', type: '', level: '', section: '', flag: '', src: '', st: '' };

export function Library() {
  const [q, setQ] = useState(() => { const v = sessionStorageGet('q'); sessionStorageSet('q', ''); return v; });
  const [f, setF] = useState<Filters>(EMPTY_F);
  const [showF, setShowF] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (q) inputRef.current?.focus(); }, []);
  const active = q.trim() !== '' || Object.values(f).some(Boolean);
  const results = useMemo(() => {
    let base = REACTIONS.filter((r) => {
      if (f.topic && !r.at.some((a) => a.startsWith(f.topic + ':'))) return false;
      if (f.type && r.ty !== f.type) return false;
      if (f.level && r.lv !== f.level) return false;
      if (f.section === 'qual' && !r.q) return false;
      if ((f.section === 'get' || f.section === 'prop') && !r.at.some((a) => a.endsWith(':' + f.section) && (!f.topic || a.startsWith(f.topic + ':')))) return false;
      if (f.flag === 'named' && !r.nm) return false;
      if (f.flag === 'rule' && !r.rule) return false;
      if (f.src === 'pdf' && r.src === 0) return false;
      if (f.src === 'add' && r.src > 0) return false;
      if (f.st && r.st !== f.st) return false;
      return true;
    });
    return searchReactions(q, base);
  }, [q, f]);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const groups = [...new Set(TOPICS.filter((t) => t.id !== 'inorg').map((t) => t.group))];
  return (
    <div className="page lib">
      <LearnTabs on="lib" />
      <header className="phead">
        <h1>Үйрену</h1>
        <p className="lead">Тақырыпты таңда немесе реакцияны ізде. Әр тақырыпта: алыну жолдары, қасиеттері, сапалық реакциялар және жиі қателер.</p>
      </header>
      <div className="searchbar">
        <div className="row gap">
          <div className="bigsearch grow">
            <Icon n="search" />
            <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Зат, формула немесе ғалым: этанол, C6H6, Кучеров…" aria-label="Реакцияларды іздеу" />
          </div>
          <button className={'btn ghost' + (showF || Object.values(f).some(Boolean) ? ' on' : '')} onClick={() => setShowF(!showF)} aria-expanded={showF}><Icon n="filter" size={16} />Сүзгі{Object.values(f).filter(Boolean).length ? ` (${Object.values(f).filter(Boolean).length})` : ''}</button>
        </div>
        {showF && (
          <div className="filters card">
            <label>Тақырып<select value={f.topic} onChange={set('topic')}><option value="">Барлығы</option>{TOPICS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Реакция түрі<select value={f.type} onChange={set('type')}><option value="">Барлығы</option>{Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Деңгей<select value={f.level} onChange={set('level')}><option value="">Барлығы</option>{Object.entries(LEVEL_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Бөлім<select value={f.section} onChange={set('section')}><option value="">Барлығы</option><option value="get">Алыну жолдары</option><option value="prop">Химиялық қасиеттері</option><option value="qual">Сапалық реакциялар</option></select></label>
            <label>Атаулы<select value={f.flag} onChange={set('flag')}><option value="">Барлығы</option><option value="named">Атаулы реакциялар</option><option value="rule">Ережеге бағынатын</option></select></label>
            <label>Дереккөз<select value={f.src} onChange={set('src')}><option value="">Барлығы</option><option value="pdf">PDF жинақ</option><option value="add">Қосымша</option></select></label>
            <label>Мәртебе<select value={f.st} onChange={set('st')}><option value="">Барлығы</option>{Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            {active && <button className="btn ghost sm" onClick={() => { setF(EMPTY_F); setQ(''); }}>Тазалау</button>}
          </div>
        )}
      </div>
      {active ? (
        <section aria-live="polite">
          <p className="muted">Табылды: {results.length}</p>
          {results.length === 0 ? <Empty>Ештеңе табылмады. Басқа сөзбен немесе формуламен іздеп көр (мысалы, «этилен» немесе «C2H4»).</Empty> : (
            <div className="rlist">{results.slice(0, 120).map((r) => <ReactionRow key={r.id} r={r} />)}</div>
          )}
          {results.length > 120 && <p className="muted">Алғашқы 120 нәтиже көрсетілді — сүзгілерді нақтыла.</p>}
        </section>
      ) : (
        groups.map((g) => (
          <section key={g}>
            <h2 className="h-md">{g}</h2>
            <div className="topic-grid">
              {TOPICS.filter((t) => t.group === g).map((t) => <TopicCard key={t.id} id={t.id} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function TopicCard({ id }: { id: string }) {
  const t = TOPIC[id];
  const prog = useProgress();
  const rs = reactionsOf(id);
  const seen = rs.filter((r) => prog.viewed[r.id]).length;
  const c = CLASS_INFO[t.cls].color;
  return (
    <A to={'t-' + id} className="topic-card" title={t.name}>
      <span className="tc-bar" style={{ background: c }} aria-hidden />
      <span className="tc-name">{t.name}</span>
      <span className="tc-meta">{reactionsOf(id, 'get').length} алыну · {reactionsOf(id, 'prop').length} қасиет · {reactionsOf(id, 'qual').length} сапалық</span>
      <span className="tc-prog"><span style={{ width: (rs.length ? (seen / rs.length) * 100 : 0) + '%', background: c }} /></span>
    </A>
  );
}

// ───────────────────────── Тақырып беті
export function TopicPage({ id }: { id: string }) {
  const t = TOPIC[id];
  useEffect(() => { if (t) markTopic(id); }, [id]);
  if (!t) return <div className="page">Тақырып табылмады.</div>;
  const sections: [string, Reaction[]][] = [
    ['Алыну жолдары', reactionsOf(id, 'get')],
    ['Химиялық қасиеттері', reactionsOf(id, 'prop')],
    ['Сапалық реакциялар', reactionsOf(id, 'qual')],
  ];
  const idx = TOPICS.findIndex((x) => x.id === id);
  const prev = TOPICS[idx - 1], next = TOPICS[idx + 1];
  return (
    <div className="page topic">
      <nav className="crumbs"><A to="lib">Үйрену</A><span>{t.group}</span></nav>
      <header className="phead">
        <span className="stage" style={{ ['--c' as string]: CLASS_INFO[t.cls].color }}>{CLASS_INFO[t.cls].name}</span>
        <h1>{t.name}</h1>
        <p className="lead">{t.intro}</p>
      </header>
      <nav className="toc" aria-label="Бөлімдер">
        {sections.map(([n, rs], i) => <a key={n} href={'#t-' + id} onClick={(e) => { e.preventDefault(); document.getElementById('sec' + i)?.scrollIntoView({ behavior: 'smooth' }); }}>{n} ({rs.length})</a>)}
        <a href={'#t-' + id} onClick={(e) => { e.preventDefault(); document.getElementById('sec3')?.scrollIntoView({ behavior: 'smooth' }); }}>Жиі қателер</a>
      </nav>
      {sections.map(([n, rs], i) => (
        <section key={n} id={'sec' + i} className="tsec">
          <h2 className="h-md">{n}</h2>
          {i === 2 && t.notes && <ul className="notes">{t.notes.map((x, k) => <li key={k}><F s={x} /></li>)}</ul>}
          {rs.length === 0 ? <Empty>{i === 2 ? 'Бұл тақырыпқа тән теңдеулі сапалық реакция базада жоқ; белгілері жоғарыда сипатталған.' : 'Бұл бөлімде реакция жоқ.'}</Empty> : <div className="rlist">{rs.map((r) => <ReactionRow key={r.id} r={r} />)}</div>}
        </section>
      ))}
      <section id="sec3" className="tsec">
        <h2 className="h-md">Жиі жіберілетін қателер</h2>
        <ol className="mistakes">{t.mistakes.map((m, k) => <li key={k}><F s={m} /></li>)}</ol>
      </section>
      <nav className="pager">
        {prev && <A to={'t-' + prev.id} className="btn ghost">← {prev.name}</A>}
        {next && <A to={'t-' + next.id} className="btn ghost">{next.name} →</A>}
      </nav>
    </div>
  );
}

// ───────────────────────── Атаулы реакциялар
export function NamedList() {
  return (
    <div className="page named">
      <LearnTabs on="named" />
      <header className="phead">
        <h1>Атаулы реакциялар</h1>
        <p className="lead">Ғалымдардың атымен аталған реакциялар: қысқа тарихи мәлімет, жалпы сызба, базадағы нақты мысал және жаттығу. Марковников пен Зайцев ережелері реакциялардан бөлек берілген.</p>
      </header>
      <h2 className="h-md">Реакциялар</h2>
      <div className="named-grid">{NAMED.filter((n) => n.kind === 'reaction').map((n) => <NamedCard key={n.id} id={n.id} />)}</div>
      <h2 className="h-md">Ережелер</h2>
      <div className="named-grid">{NAMED.filter((n) => n.kind === 'rule').map((n) => <NamedCard key={n.id} id={n.id} />)}</div>
    </div>
  );
}
function NamedCard({ id }: { id: string }) {
  const n = NAMED_BY_ID[id];
  return (
    <A to={'n-' + id} className="named-card">
      <span className="nc-name">{n.name}</span>
      <span className="nc-sci muted">{n.scientist}</span>
      <span className="nc-scheme"><F s={n.scheme} /></span>
      <span className="nc-memo">{n.memo}</span>
    </A>
  );
}
export function NamedPage({ id }: { id: string }) {
  const n = NAMED_BY_ID[id];
  const prog = useProgress();
  const q = useMemo(() => makeQ('named', 'named:' + id), [id]);
  if (!n) return <div className="page">Табылмады.</div>;
  return (
    <article className="page npage">
      <nav className="crumbs"><A to="lib">Үйрену</A><A to="named">Атаулы реакциялар</A><span>{n.kind === 'rule' ? 'Ережелер' : 'Реакциялар'}</span></nav>
      <header className="phead">
        <h1>{n.name}</h1>
        <p className="lead">{n.scientist}</p>
      </header>
      <div className="rgrid">
        <section className="card"><h2 className="h-sm">Тарихи мәлімет</h2><p>{n.history}</p></section>
        <section className="card"><h2 className="h-sm">Жалпы сызба</h2><p className="scheme-big"><F s={n.scheme} /></p><p><b>Шарттары:</b> {n.conditions}</p><p><b>Заттар класы:</b> {n.classes}</p></section>
        <section className="card hint"><h2 className="h-sm">Есте сақтау тірегі</h2><p className="memo">{n.memo}</p>{n.confuse && <p className="muted"><b>Шатастырма:</b> {n.confuse}</p>}</section>
      </div>
      <section className="card">
        <h2 className="h-sm">Нақты мысалдар (базадан)</h2>
        <div className="rlist">{n.examples.map((x) => <ReactionRow key={x} r={RX[x]} />)}</div>
      </section>
      <section className="card"><h2 className="h-sm">Жаттығу</h2><QuizBlock q={q} compact /></section>
    </article>
  );
}

// ───────────────────────── Мектеп базасы
export function School() {
  const prog = useProgress();
  return (
    <div className="page school">
      <LearnTabs on="school" />
      <header className="phead">
        <h1>Негіздер</h1>
        <p className="lead">Органиканы түсінуге қажетті бастапқы білім және тақырыптарды өту реті.</p>
      </header>
      <section>
        <h2 className="h-md">Негіздер</h2>
        <div className="school-grid">
          {SCHOOL.map((s, i) => (
            <A key={s.id} to={'s-' + s.id} className="school-card"><span className="sc-n">{i + 1}</span><span className="sc-t">{s.title}</span><span className="sc-s muted">{s.short}</span></A>
          ))}
          <A to="t-inorg" className="school-card"><span className="sc-n">+</span><span className="sc-t">Органикаға қажет бейорганикалық реакциялар</span><span className="sc-s muted">Cu(OH)₂, Ag₂O, CaC₂, әк суы…</span></A>
        </div>
      </section>
      <section>
        <h2 className="h-md">Оқу бағыты: мектеп органикасының реакциялары</h2>
        <p className="muted">Тақырыптарды осы ретпен өту ұсынылады — әр келесі тақырып алдыңғысына сүйенеді.</p>
        <ol className="path">
          {LEARNING_PATH.map((p, i) => {
            const rs = reactionsOf(p.topic);
            const seen = rs.filter((r) => prog.viewed[r.id]).length;
            const done = rs.length > 0 && seen === rs.length;
            return (
              <li key={p.topic} className={done ? 'done' : prog.topics[p.topic] ? 'started' : ''}>
                <A to={'t-' + p.topic}><b>{TOPIC[p.topic].name}</b></A>
                <span className="muted"> — {p.why}</span>
                <span className="path-p">{seen}/{rs.length}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function SchoolPage({ id }: { id: string }) {
  const s = SCHOOL.find((x) => x.id === id);
  if (!s) return <div className="page">Табылмады.</div>;
  const idx = SCHOOL.indexOf(s);
  return (
    <article className="page spage">
      <nav className="crumbs"><A to="lib">Үйрену</A><A to="school">Негіздер</A></nav>
      <header className="phead"><h1>{s.title}</h1><p className="lead">{s.short}</p></header>
      {s.blocks.map((b, i) => (
        <div key={i} className="sblock">
          {b.h && <h2 className="h-sm">{b.h}</h2>}
          {b.p && <p><F s={b.p} /></p>}
          {b.list && <ul>{b.list.map((x, k) => <li key={k}><F s={x} /></li>)}</ul>}
          {b.table && (
            <div className="tablewrap"><table className="tbl"><thead><tr>{b.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{b.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><F s={c} /></td>)}</tr>)}</tbody></table></div>
          )}
          {b.chain && (
            <div className="chain gen">
              {b.chain.map((st, k) => (
                <React.Fragment key={k}>
                  {k > 0 && <A to={'r-' + b.chain![k - 1].r} className="arrow chain-arrow link"><span className="cond">{RX[b.chain![k - 1].r!].c ?? ''}</span><span className="shaft">⟶</span></A>}
                  <A to={subHash(st.s)} className="cnode"><F s={formulaText(st.s)} /><small>{shortName(st.s)}</small></A>
                </React.Fragment>
              ))}
            </div>
          )}
          {b.chain && <ChainPlay chain={b.chain} />}
          {b.links && <div className="chips"><span className="muted small">Базадан мысалдар:</span>{b.links.map((l) => <A key={l} to={'r-' + l} className="chip">{RX[l].t}</A>)}</div>}
          {b.tool === 'combustion' && <CombustionTool />}
        </div>
      ))}
      {id === 'genetic' && <p><A to="metro" className="btn"><Icon n="map" />Реакциялар картасын ашу</A></p>}
      <nav className="pager">
        {SCHOOL[idx - 1] && <A to={'s-' + SCHOOL[idx - 1].id} className="btn ghost">← {SCHOOL[idx - 1].title}</A>}
        {SCHOOL[idx + 1] && <A to={'s-' + SCHOOL[idx + 1].id} className="btn ghost">{SCHOOL[idx + 1].title} →</A>}
      </nav>
    </article>
  );
}

function CombustionTool() {
  const [c, setC] = useState(3), [h, setH] = useState(8), [o, setO] = useState(0);
  const valid = c > 0 && h > 0 && h % 2 === 0 && h <= 2 * c + 2 && o >= 0;
  // 2·CxHyOz + (2x + y/2 − z) O2 → 2x CO2 + y H2O
  let k = 1, o2 = (2 * c + h / 2 - o) / 2, co2 = c, h2o = h / 2;
  if (!Number.isInteger(o2)) { k = 2; o2 *= 2; co2 *= 2; h2o *= 2; }
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = [k, o2, co2, h2o].reduce(g);
  const fm = `C${c > 1 ? c : ''}H${h}${o ? 'O' + (o > 1 ? o : '') : ''}`;
  const kk = (n: number) => (n / d === 1 ? '' : String(n / d));
  return (
    <div className="card tool">
      <h3 className="h-sm">Жану теңдеуін теңестіргіш (CₓHᵧO_z)</h3>
      <div className="row gap wrap">
        <label>C <input type="number" min={1} max={20} value={c} onChange={(e) => setC(+e.target.value)} /></label>
        <label>H <input type="number" min={2} max={42} step={2} value={h} onChange={(e) => setH(+e.target.value)} /></label>
        <label>O <input type="number" min={0} max={6} value={o} onChange={(e) => setO(+e.target.value)} /></label>
      </div>
      {valid && o2 > 0 ? (
        <p className="eq big" aria-live="polite"><F s={`${kk(k)}${fm} + ${kk(o2)}O2`} /><Arrow cond="t°" /><F s={`${kk(co2)}CO2 + ${kk(h2o)}H2O`} /></p>
      ) : <p className="muted">H саны жұп және 2C + 2-ден аспауы керек (мысалы, C₃H₈, C₂H₆O).</p>}
    </div>
  );
}

// ───────────────────────── Жаттығу
const MODES: Mode[] = ['product', 'reagent', 'error', 'identify', 'chain', 'named'];
export function Practice() {
  const prog = useProgress();
  const count: Record<Mode, string> = {
    product: 'автоматты түрде базадан', reagent: 'автоматты түрде базадан', error: `${FIND_ERRORS.length} қолмен + автоматты`,
    identify: `${IDENTIFY.length} тапсырма`, chain: 'реакциялар картасынан', named: `${NAMED.length} сұрақ`,
  };
  return (
    <div className="page practice">
      <header className="phead">
        <h1>Өзіңді тексер</h1>
        <p className="lead">Әр жауаптан кейін қысқа түсіндірме беріледі. Қате жауаптар қайталау тізіміне түседі және дұрыс жауап бергенде одан шығады.</p>
      </header>
      <div className="mode-grid">
        {MODES.map((m) => {
          const r = prog.results[m];
          return (
            <A key={m} to={'p-' + m} className="mode-card">
              <span className="mc-t">{MODE_INFO[m].title}</span>
              <span className="mc-d">{MODE_INFO[m].desc}</span>
              <span className="mc-s muted small">{count[m]}{r ? ` · ${r.ok}/${r.total} дұрыс` : ''}</span>
            </A>
          );
        })}
        <A to="p-review" className={'mode-card review' + (prog.review.length ? '' : ' empty-card')}>
          <span className="mc-t">Қайталау тізімі</span>
          <span className="mc-d">Қате орындалған тапсырмалар қайта ұсынылады.</span>
          <span className="mc-s small"><b>{prog.review.length}</b> тапсырма күтуде</span>
        </A>
      </div>
    </div>
  );
}

export function PracticeMode({ mode }: { mode: Mode | 'review' }) {
  const prog = useProgress();
  const [n, setN] = useState(0);
  const [stats, setStats] = useState({ ok: 0, total: 0 });
  const q: Question | null = useMemo(() => {
    if (mode === 'review') {
      const keys = prog.review;
      if (!keys.length) return null;
      try { return fromKey(keys[n % keys.length]); } catch { return null; }
    }
    return makeQ(mode);
  }, [mode, n]);
  const lastLen = useRef(prog.history.length);
  useEffect(() => {
    if (prog.history.length > lastLen.current) {
      const h = prog.history[0];
      setStats((s) => ({ ok: s.ok + (h.ok ? 1 : 0), total: s.total + 1 }));
    }
    lastLen.current = prog.history.length;
  }, [prog.history.length]);
  const title = mode === 'review' ? 'Қайталау тізімі' : MODE_INFO[mode].title;
  return (
    <div className="page pmode">
      <nav className="crumbs"><A to="practice">Жаттығу</A></nav>
      <header className="phead row between">
        <div><h1>{title}</h1><p className="lead">{mode === 'review' ? 'Бұрын қате жауап берген тапсырмалар.' : MODE_INFO[mode].desc}</p></div>
        <div className="tiles"><div className="tile"><span className="tl">сессия</span><span className="tv">{stats.ok}/{stats.total}</span></div></div>
      </header>
      {q ? (
        <section className="card"><QuizBlock key={q.key + n} q={q} onNext={() => setN((x) => x + 1)} /></section>
      ) : <Empty>Қайталау тізімі бос. Жаттығу орындағанда қате жауаптар осында жиналады.</Empty>}
    </div>
  );
}

// ───────────────────────── Прогресс
export function ProgressPage() {
  const prog = useProgress();
  const favs = prog.favorites.map((id) => RX[id]).filter(Boolean);
  const viewed = Object.keys(prog.viewed).length;
  const totalAns = Object.values(prog.results).reduce((s, r) => s + r.total, 0);
  const totalOk = Object.values(prog.results).reduce((s, r) => s + r.ok, 0);
  const started = TOPICS.filter((t) => reactionsOf(t.id).some((r) => prog.viewed[r.id]));
  return (
    <div className="page progress">
      <header className="phead profile-head">
        <span className="avatar big" aria-hidden>{(prog.name ?? '?').charAt(0).toUpperCase()}</span>
        <div>
          <h1>{prog.name ?? 'Профиль'}</h1>
          <p className="lead">Прогресің осы браузерде сақталады — тіркелу қажет емес.{!isPersisted() && ' Қазір браузер сақтауға рұқсат бермей тұр: прогресс бет жабылғанда жоғалады.'}</p>
        </div>
      </header>
      <section className="stat-row">
        <div className="stat"><b>{viewed}</b><span>реакция қаралды</span></div>
        <div className="stat"><b>{started.length}</b><span>тақырып басталды</span></div>
        <div className="stat"><b>{totalAns ? Math.round((totalOk / totalAns) * 100) + '%' : '—'}</b><span>дұрыс жауап</span></div>
        <div className="stat"><b>{prog.review.length}</b><span>қайталау керек</span></div>
      </section>
      <div className="rgrid">
        <NameEdit />
        <TransferCard />
      </div>
      <div className="rgrid">
        <section className="card">
          <h2 className="h-card">Тақырыптар</h2>
          {TOPICS.map((t) => {
            const rs = reactionsOf(t.id);
            const seen = rs.filter((r) => prog.viewed[r.id]).length;
            return <div key={t.id} className="prog-row"><A to={'t-' + t.id}>{t.name}</A><Meter v={seen} max={rs.length} label={`${seen}/${rs.length}`} /></div>;
          })}
        </section>
        <section className="card">
          <h2 className="h-card">Жаттығу нәтижелері</h2>
          {MODES.map((m) => { const r = prog.results[m]; return <div key={m} className="prog-row"><span>{MODE_INFO[m].title}</span><Meter v={r?.ok ?? 0} max={r?.total || 1} label={r ? `${r.ok}/${r.total} дұрыс` : 'әлі жоқ'} /></div>; })}
          <p><A to="p-review" className="btn sm">Қайталау тізімі ({prog.review.length})</A></p>
        </section>
      </div>
      <section className="card">
        <h2 className="h-card">Сақталған реакциялар ({favs.length})</h2>
        {favs.length ? <div className="rlist">{favs.map((r) => <ReactionRow key={r.id} r={r} />)}</div> : <p className="muted">Реакция бетіндегі «Сақтау» батырмасымен қос.</p>}
      </section>
      <ResetButton />
    </div>
  );
}

function NameEdit() {
  const prog = useProgress();
  const [v, setV] = useState(prog.name ?? '');
  const [ok, setOk] = useState(false);
  return (
    <section className="card">
      <h2 className="h-card">Атың</h2>
      <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); setName(v); setOk(true); }}>
        <input className="name-in" value={v} onChange={(e) => { setV(e.target.value); setOk(false); }} placeholder="Атың" aria-label="Атың" maxLength={40} />
        <button className="btn">Сақтау</button>
        {ok && <span className="small" role="status">Сақталды</span>}
      </form>
    </section>
  );
}

/** Прогресті басқа құрылғыға көшіру: код немесе файл */
function TransferCard() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [inp, setInp] = useState('');
  const download = () => {
    try {
      const blob = new Blob([code || exportCode()], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'organika-progress.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { setMsg('Файлды жүктеу мүмкін болмады — кодты көшіріп ал.'); }
  };
  return (
    <section className="card">
      <h2 className="h-card">Басқа құрылғыға көшіру</h2>
      <p className="muted small">Телефоннан компьютерге (немесе керісінше) ауысқанда: мұнда кодты ал, ал жаңа құрылғыда осы бетке кодты қой.</p>
      <div className="row gap wrap">
        <button className="btn sm" onClick={() => { const c = exportCode(); setCode(c); try { navigator.clipboard.writeText(c).then(() => setMsg('Код көшірілді.'), () => setMsg('Кодты төменнен белгілеп көшір.')); } catch { setMsg('Кодты төменнен белгілеп көшір.'); } }}><Icon n="copy" size={16} />Кодты көшіру</button>
        <button className="btn ghost sm" onClick={download}><Icon n="download" size={16} />Файл ретінде</button>
      </div>
      {code && <textarea className="code-out" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Прогресс коды" />}
      <form className="import" onSubmit={(e) => { e.preventDefault(); setMsg(importCode(inp) ? 'Прогресс қосылды!' : 'Код танылмады. Толық көшірілгенін тексер.'); }}>
        <textarea value={inp} onChange={(e) => setInp(e.target.value)} rows={2} placeholder="Басқа құрылғыдан алған кодты осында қой" aria-label="Прогресс кодын енгізу" />
        <div className="row gap wrap">
          <button className="btn sm" disabled={!inp.trim()}><Icon n="upload" size={16} />Прогресті қосу</button>
          <label className="btn ghost sm filebtn">Файлдан<input type="file" accept=".txt,.json" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; f.text().then((t) => setMsg(importCode(t) ? 'Прогресс қосылды!' : 'Файл танылмады.')); }} /></label>
        </div>
      </form>
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  );
}

// ───────────────────────── Зат карточкасы
export function SubstancePage({ id }: { id: string }) {
  const s = SUB[id];
  const prog = useProgress();
  if (!s) return <div className="page">Зат табылмады.</div>;
  const bs = BY_SUBSTANCE[id] ?? { asReactant: [], asProduct: [] };
  const onMetro = STATION_IDS.includes(id);
  return (
    <article className="page subpage">
      <header className="phead">
        <ClassChip cls={s.cls} />
        <h1>{s.name}</h1>
        <p className="lead"><F s={s.cf} />{s.sf && s.sf !== s.cf && <> · <F s={s.sf} /></>}{s.alt && s.alt.length > 0 && <span className="muted"> · {s.alt.join(', ')}</span>}</p>
      </header>
      {hasStructure(id) && <section className="card center"><Structure id={id} maxH={260} /></section>}
      <div className="rgrid">
        <section className="card"><h2 className="h-sm">Алыну жолдары ({bs.asProduct.length})</h2><div className="rlist">{bs.asProduct.map((r) => <ReactionRow key={r} r={RX[r]} />)}</div>{!bs.asProduct.length && <p className="muted">Базада жоқ.</p>}</section>
        <section className="card"><h2 className="h-sm">Химиялық қасиеттері ({bs.asReactant.length})</h2><div className="rlist">{bs.asReactant.map((r) => <ReactionRow key={r} r={RX[r]} />)}</div>{!bs.asReactant.length && <p className="muted">Базада жоқ.</p>}</section>
      </div>
      {onMetro && <p><button className="btn" onClick={() => { metroIntent.from = id; go('metro'); }}><Icon n="map" />Картадан осы заттан жол іздеу</button></p>}
    </article>
  );
}

// ───────────────────────── Дереккөздер және тексеру журналы
export function Sources() {
  const fixes = REACTIONS.filter((r) => r.st === 'fix');
  const simp = REACTIONS.filter((r) => r.st === 'simp');
  const check = REACTIONS.filter((r) => r.st === 'check');
  const added = REACTIONS.filter((r) => r.src === 0);
  const pages = [...new Set(REACTIONS.filter((r) => r.src > 0).map((r) => r.src))].sort((a, b) => a - b);
  return (
    <div className="page sources">
      <header className="phead">
        <h1>Дереккөздер және тексеру журналы</h1>
        <p className="lead">Негізгі дереккөз — «Химия пәнінен органикалық реакциялардың жинағы» (құраст. Т.Д. Қайратұлы, PDF, 24 бет). Жинақтағы мәтін тексерусіз көшірілмеді: әр теңдеу атомдар мен зарядтар бойынша автоматты түрде тексерілді, құрылымдық сызбалар мәтіндік жазбамен салыстырылды.</p>
      </header>
      <section className="card stats">
        <div><b>{REACTIONS.length}</b><span>барлық жазба</span></div>
        <div><b>{REACTIONS.length - added.length}</b><span>PDF-тен ({pages.length} бет)</span></div>
        <div><b>{added.length}</b><span>мектеп курсынан қосылды</span></div>
        <div><b>{fixes.length}</b><span>түзетілді</span></div>
        <div><b>{simp.length}</b><span>оңайлатылған жазба</span></div>
        <div><b>{check.length}</b><span>тексеруді қажет етеді</span></div>
      </section>
      <section className="card">
        <h2 className="h-sm">Мәртебелер</h2>
        <ul>
          <li><StatusBadge st="ok" /> — теңдеу теңестірілген, химиялық мазмұны стандартты мектеп курсына сай.</li>
          <li><StatusBadge st="fix" /> — жинақта қате болған (формула, коэффициент, атау немесе шарт); не өзгергені карточкада жазылған.</li>
          <li><StatusBadge st="simp" /> — мектепте қабылданған шартты жазба (мысалы, Ag₂O арқылы күміс айна); нақты процестің ерекшелігі ескертілген.</li>
          <li><StatusBadge st="check" /> — күмәнді жазба; ойдан толықтырылмады, жаттығулар мен реакциялар картасына енгізілмеді.</li>
        </ul>
        <p className="muted">Жинақтың соңындағы жеке үндеулер мен қаржылай көмек туралы мәтін сайт мазмұнына енгізілмеді.</p>
      </section>
      <LogTable title="Тексеруді қажет етеді" rs={check} />
      <LogTable title="Жинақтан түзетілгендер" rs={fixes} />
      <LogTable title="Оңайлатылған мектептік жазбалар" rs={simp} />
      <section className="card">
        <h2 className="h-sm">Жинақта жоқ, мектеп курсынан қосылған реакциялар ({added.length})</h2>
        <div className="chips">{added.map((r) => <A key={r.id} to={'r-' + r.id} className="chip">{r.t}</A>)}</div>
        <p className="muted">Сонымен қатар «Галогентуындылар» және «Полимерлер» тақырыптары жинақта бөлек берілмеген — олар бар реакцияларды біріктіріп, толықтыру арқылы құрылды.</p>
      </section>
      <section className="card">
        <h2 className="h-sm">Жинақтың әдебиеттер тізімі (PDF, 24-бет)</h2>
        <ul className="small">
          <li>Химия 9 (2 бөлім) — М.Қ. Оспанова, Қ.С. Аухадиева, Т.Г. Белоусова. Алматы: Мектеп, 2019.</li>
          <li>Химия 10 (2 бөлім, ЖМБ) — М.Қ. Оспанова, Қ.С. Аухадиева, Т.Г. Белоусова. Алматы: Мектеп, 2019.</li>
          <li>Химия 11 (1 бөлім, ЖМБ) — М.Қ. Оспанова, Қ.С. Аухадиева, Т.Г. Белоусова. Алматы: Мектеп, 2020.</li>
          <li>Химия 11 (1–2 бөлім, ҚГБ) — М.Б. Усманова, Б.С. Тантыбаева, З.С. Даутова, М.В. Попова. Алматы: Атамұра, 2020.</li>
        </ul>
        <p className="muted small">Деңгей белгілері («Базалық», «ҰБТ», «Тереңдетілген») — әдістемелік бағалау. Сыныпқа сәйкестігі ресми оқу бағдарламасымен салыстырылмағандықтан көрсетілмеді.</p>
      </section>
    </div>
  );
}

function LogTable({ title, rs }: { title: string; rs: Reaction[] }) {
  return (
    <section className="card">
      <h2 className="h-sm">{title} ({rs.length})</h2>
      <div className="log">
        {rs.map((r) => (
          <div key={r.id} className="log-row">
            <div><A to={'r-' + r.id}><b>{r.t}</b></A> <span className="muted small">{r.src > 0 ? `PDF ${r.src}-бет` : 'қосымша'}</span></div>
            <p className="small">{r.n}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResetButton() {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <p className="row gap"><span>Барлық прогресс өшіріледі. Растайсың ба?</span><button className="btn sm danger" onClick={() => { resetProgress(); setAsk(false); }}>Иә, тазалау</button><button className="btn ghost sm" onClick={() => setAsk(false)}>Жоқ</button></p>
  ) : <p><button className="btn ghost sm" onClick={() => setAsk(true)}>Прогресті тазалау</button></p>;
}

const HERO_FILMS: { label: string; crumb: string; steps: FilmStep[] }[] = [
  { label: 'Этилен → этилацетат', crumb: 'Этилен → этилацетат · генетикалық байланыс', steps: [
    { rid: 'ethene-hydration', from: 'ethene', to: 'ethanol' }, { rid: 'ethanol-cuo', from: 'ethanol', to: 'ethanal' },
    { rid: 'ethanal-oxidation', from: 'ethanal', to: 'acetic' }, { rid: 'esterification-ethyl-acetate', from: 'acetic', to: 'ethyl_acetate' }] },
  { label: 'Глюкоза → этанол + CO₂', crumb: 'Глюкозаның спирттік ашуы · C1/C6 → CH₃, C2/C5 → CH₂OH, C3/C4 → CO₂', steps: [{ rid: 'glucose-alcoholic' }] },
  { label: 'Метан → анилин', crumb: 'Метан → анилин · ароматты тізбек', steps: [
    { rid: 'ch4-ethyne', from: 'ch4', to: 'ethyne' }, { rid: 'ethyne-trimerization', from: 'ethyne', to: 'benzene' },
    { rid: 'benzene-nitration', from: 'benzene', to: 'nitrobenzene' }, { rid: 'zinin', from: 'nitrobenzene', to: 'aniline' }] },
  { label: 'Этилен → полиэтилен', crumb: 'Полимерлену', steps: [{ rid: 'ethene-polymerization' }] },
];

function HeroFilm() {
  const [k, setK] = useState(0);
  const f = HERO_FILMS[k];
  return (
    <section className="hero-film" aria-label="Реакциялар анимациясы">
      <div className="film-tabs" role="tablist" aria-label="Анимация таңдау">
        {HERO_FILMS.map((x, i) => <button key={x.label} role="tab" aria-selected={i === k} className={'chip' + (i === k ? ' on' : '')} onClick={() => setK(i)}>{x.label}</button>)}
      </div>
      <Film key={k} steps={f.steps} crumb={f.crumb} autoplay loop />
    </section>
  );
}

export function ChainPlay({ chain }: { chain: { s: string; r?: string }[] }) {
  const [open, setOpen] = useState(false);
  const steps = chain.slice(0, -1).map((c, i) => ({ rid: c.r!, from: c.s, to: chain[i + 1].s }));
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}><Icon n="play" size={16} />Анимациямен көру</button>
      {open && <FilmOverlay steps={steps} crumb={`${shortName(chain[0].s)} → ${shortName(chain[chain.length - 1].s)}`} onClose={() => setOpen(false)} />}
    </>
  );
}
