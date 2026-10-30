import React, { useEffect, useMemo, useRef, useState } from 'react';
import { METRO_ROWS, METRO_STATIONS, METRO_GEOM, METRO_PRESETS } from '../data/metro';
import { SUB } from '../data/substances';
import { RX } from '../data/index';
import { CLASS_INFO, TYPE_NAMES, LEVEL_NAMES } from '../data/topics';
import { EDGES, OUT, IN, findPaths, distTo, bestReaction, reagentOf, stationName, STATION_IDS, metroIntent, type Edge, type Path } from '../lib/graph';
import { F, formulaText, shuffle, reagentText } from '../lib/format';
import { searchSubstances } from '../lib/search';
import { FilmOverlay } from '../components/Film';
import { ReagentLabel } from '../components/Quiz';
import { A, Icon, subHash } from '../components/ui';


const POS: Record<string, { x: number; y: number }> = {};
for (const [id, c, r] of METRO_STATIONS) POS[id] = { x: METRO_GEOM.left + (c - 1) * METRO_GEOM.colW, y: METRO_GEOM.top + r * METRO_GEOM.rowH };
const W = METRO_GEOM.left + 12 * METRO_GEOM.colW + 110;
const H = METRO_GEOM.top + (METRO_ROWS.length - 1) * METRO_GEOM.rowH + 60;
const ekey = (e: Edge) => e.from + '>' + e.to;

function edgePath(e: Edge) {
  const a = POS[e.from], b = POS[e.to];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // қарсы бағыттағы жиектер екі жаққа иіледі
  const k = Math.min(160, Math.max(20, len * (Math.abs(dx) < 10 ? 0.34 : 0.2)));
  const nx = -dy / len, ny = dx / len;
  const cx = (a.x + b.x) / 2 + nx * k, cy = (a.y + b.y) / 2 + ny * k;
  // доғаны станция шеңберінен сәл қысқартамыз
  const t0 = 11 / len, t1 = 1 - 13 / len;
  const q = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y });
  const s = q(t0), en = q(t1);
  return { d: `M${s.x},${s.y} Q${cx},${cy} ${en.x},${en.y}`, mid: q(0.5) };
}

export function MetroPage() {
  const [from, setFrom] = useState<string>(metroIntent.from ?? 'ethene');
  const [to, setTo] = useState<string>(metroIntent.to ?? 'ethyl_acetate');
  const [pick, setPick] = useState<'from' | 'to'>('from');
  const [view, setView] = useState<'map' | 'text' | 'build'>('map');
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<{ kind: 'station'; id: string } | { kind: 'edge'; e: Edge } | null>(null);
  const [pi, setPi] = useState(0);
  const [player, setPlayer] = useState<Path | null>(null);
  const [allRoutes, setAllRoutes] = useState(false);
  useEffect(() => { metroIntent.from = undefined; metroIntent.to = undefined; }, []);
  const paths = useMemo(() => findPaths(from, to, 5), [from, to]);
  useEffect(() => setPi(0), [from, to]);
  const path = paths[pi];
  const onPath = new Set(path ? path.edges.map(ekey) : []);
  const pathNodes = new Set(path?.nodes ?? []);
  const focus = sel?.kind === 'station' ? sel.id : null;

  const clickStation = (id: string) => {
    setSel({ kind: 'station', id });
    if (pick === 'from') { setFrom(id); setPick('to'); } else { setTo(id); setPick('from'); }
  };

  return (
    <div className="page metro">
      <header className="phead">
        <h1>Реакциялар картасы</h1>
        <p className="lead">Бір заттан екінші затты қалай алуға болады? Картада әр шеңбер — зат, түсті сызық — заттар класы, жебе — реакция.</p>
        <ol className="steps3">
          <li><b>1</b> Бастапқы затты таңда</li>
          <li><b>2</b> Соңғы затты таңда</li>
          <li><b>3</b> Жолды көр немесе «Қадамдап көру» бас</li>
        </ol>
      </header>
      <div className="route-form card">
        <StationSelect label="Бастапқы зат" value={from} onChange={setFrom} active={pick === 'from'} onFocus={() => setPick('from')} />
        <button className="btn ghost swap" onClick={() => { setFrom(to); setTo(from); }} aria-label="Орындарын ауыстыру">⇄</button>
        <StationSelect label="Соңғы зат" value={to} onChange={setTo} active={pick === 'to'} onFocus={() => setPick('to')} />
        <div className="presets">
          <span className="muted small">Мысалдар:</span>
          {METRO_PRESETS.map(([a, b]) => (
            <button key={a + b} className="chip" onClick={() => { setFrom(a); setTo(b); }}>{stationName(a)} → {stationName(b)}</button>
          ))}
        </div>
      </div>

      <div className="seg big-seg" role="tablist" aria-label="Көрініс">
        {([['map', 'Карта'], ['text', 'Мәтіндік тізбек'], ['build', 'Маршрутты өзің құрастыр']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>

      {view !== 'build' && (
        <section className="routes" aria-live="polite">
          {from === to ? <p className="muted">Бастапқы және соңғы зат бірдей.</p> : paths.length === 0 ? (
            <div className="warn">Базада <b>{stationName(from)}</b> → <b>{stationName(to)}</b> айналуына жол табылмады. Жоқ реакцияны ойдан құрмаймыз — басқа заттарды таңдап көр.</div>
          ) : (
            <>
              <h2 className="h-card">Табылған жолдар: {paths.length}{paths.length > 1 ? ' — салыстыру үшін біреуін таңда' : ''}</h2>
              <div className="route-list">
                {paths.slice(0, allRoutes ? 5 : 3).map((p, i) => (
                  <div key={i} className={'route' + (i === pi ? ' on' : '')}>
                    <button className="route-pick" onClick={() => setPi(i)} aria-pressed={i === pi}>
                      <span className="route-n">{i + 1}-жол · {p.edges.length} қадам</span>
                      <span className="route-chain">
                        {p.nodes.map((n, k) => (
                          <React.Fragment key={k}>
                            {k > 0 && <span className="rc-arrow"><small><ReagentLabel rid={bestReaction(p.edges[k - 1]).id} from={p.nodes[k - 1]} /></small>→</span>}
                            <span className="rc-node" style={{ ['--c' as string]: CLASS_INFO[SUB[n].cls].color }}>{stationName(n)}</span>
                          </React.Fragment>
                        ))}
                      </span>
                      <span className="route-meta">Деңгейлер: {p.edges.map((e) => LEVEL_NAMES[bestReaction(e).lv]).join(' · ')}</span>
                    </button>
                    <button className="btn sm" onClick={() => setPlayer(p)}><Icon n="play" size={16} />Қадамдап көру</button>
                  </div>
                ))}
              </div>
              {paths.length > 3 && !allRoutes && <button className="btn ghost sm" onClick={() => setAllRoutes(true)}>Тағы {paths.length - 3} жолды көрсету</button>}
            </>
          )}
        </section>
      )}

      {view === 'map' && (
        <section className="map-wrap card">
          <div className="map-tools">
            <span className="muted small">Шеңберді басқанда ол <b>{pick === 'from' ? 'бастапқы' : 'соңғы'}</b> зат болады.</span>
            <div className="zoom">
              <button className="btn ghost sm" onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)))} aria-label="Кішірейту"><Icon n="minus" /></button>
              <span className="small">{Math.round(zoom * 100)}%</span>
              <button className="btn ghost sm" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))} aria-label="Үлкейту"><Icon n="plus" /></button>
            </div>
          </div>
          <div className="map-scroll">
            <svg className="map" viewBox={`0 0 ${W} ${H}`} width={W * zoom} height={H * zoom} role="img" aria-label="Реакциялар картасы. Мәтіндік нұсқасы «Мәтіндік тізбек» қойындысында.">
              <defs>
                <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--edge)" /></marker>
                <marker id="ah-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
              </defs>
              {METRO_ROWS.map((row, i) => (
                <text key={i} x={12} y={METRO_GEOM.top + i * METRO_GEOM.rowH + 4} className="map-row">{row.label}</text>
              ))}
              {/* класс желілері */}
              {METRO_ROWS.map((_, ri) => {
                const st = METRO_STATIONS.filter((s) => s[2] === ri);
                const byCls: Record<string, number[]> = {};
                st.forEach(([id, c]) => (byCls[SUB[id].cls] ??= []).push(c));
                return Object.entries(byCls).map(([cls, cols]) => cols.length > 1 && (
                  <line key={ri + cls} x1={POS[METRO_STATIONS.find((s) => s[2] === ri && s[1] === Math.min(...cols))![0]].x} x2={POS[METRO_STATIONS.find((s) => s[2] === ri && s[1] === Math.max(...cols))![0]].x}
                    y1={METRO_GEOM.top + ri * METRO_GEOM.rowH} y2={METRO_GEOM.top + ri * METRO_GEOM.rowH} stroke={CLASS_INFO[cls as keyof typeof CLASS_INFO].color} strokeWidth={7} strokeLinecap="round" opacity={0.55} />
                ));
              })}
              {EDGES.map((e) => {
                const on = onPath.has(ekey(e));
                const near = focus && (e.from === focus || e.to === focus);
                const g = edgePath(e);
                return (
                  <g key={ekey(e)} className={'edge' + (on ? ' on' : near ? ' near' : '')} onClick={() => setSel({ kind: 'edge', e })}>
                    <path d={g.d} className="hit" />
                    <path d={g.d} className="vis" markerEnd={on ? 'url(#ah-on)' : 'url(#ah)'} />
                  </g>
                );
              })}
              {METRO_STATIONS.map(([id]) => {
                const p = POS[id];
                const c = CLASS_INFO[SUB[id].cls].color;
                const isEnd = id === from || id === to;
                return (
                  <g key={id} className={'station' + (pathNodes.has(id) ? ' on' : '') + (focus === id ? ' focus' : '')} transform={`translate(${p.x},${p.y})`}
                    role="button" tabIndex={0} aria-label={`${SUB[id].name}`} onClick={() => clickStation(id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clickStation(id); } }}>
                    <circle r={isEnd ? 10 : 8} fill={isEnd ? c : 'var(--bg)'} stroke={c} strokeWidth={3.2} />
                    {id === from && <text y={4} textAnchor="middle" className="st-mark">А</text>}
                    {id === to && <text y={4} textAnchor="middle" className="st-mark">Б</text>}
                    <text y={25} textAnchor="middle" className="st-name">{stationName(id)}</text>
                    <text y={38} textAnchor="middle" className="st-f">{plainSub(SUB[id].cf)}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {sel && <SelPanel sel={sel} onClose={() => setSel(null)} />}
        </section>
      )}

      {view === 'text' && <TextMap />}
      {view === 'build' && <BuildRoute initFrom={from} initTo={to} />}

      {player && <RoutePlayer path={player} onClose={() => setPlayer(null)} />}
    </div>
  );
}

const plainSub = (s: string) => s.replace(/(\d+)/g, (d) => d.split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('')).replace(/\)n$/, ')ₙ');

function StationSelect({ label, value, onChange, active, onFocus }: { label: string; value: string; onChange: (v: string) => void; active: boolean; onFocus: () => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => searchSubstances(q, STATION_IDS), [q]);
  return (
    <label className={'ssel' + (active ? ' active' : '')} onFocus={onFocus}>
      <span className="ssel-l">{label}</span>
      <input type="search" placeholder="Атауы не формуласы…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={label + ': іздеу'} />
      <select value={value} onChange={(e) => { onChange(e.target.value); setQ(''); }} aria-label={label}>
        {(list.includes(value) ? list : [value, ...list]).map((id) => <option key={id} value={id}>{stationName(id)} — {plainSub(SUB[id].cf)}</option>)}
      </select>
    </label>
  );
}

function SelPanel({ sel, onClose }: { sel: { kind: 'station'; id: string } | { kind: 'edge'; e: Edge }; onClose: () => void }) {
  if (sel.kind === 'edge') {
    const e = sel.e;
    return (
      <div className="selpanel" role="dialog" aria-label="Реакциялар">
        <button className="x" onClick={onClose} aria-label="Жабу"><Icon n="x" /></button>
        <h3>{stationName(e.from)} → {stationName(e.to)}</h3>
        <ul className="plain">
          {e.rids.map((rid) => (
            <li key={rid}><A to={'r-' + rid}>{RX[rid].t}</A><div className="small muted"><ReagentLabel rid={rid} from={e.from} /> · {TYPE_NAMES[RX[rid].ty]}</div></li>
          ))}
        </ul>
      </div>
    );
  }
  const id = sel.id;
  return (
    <div className="selpanel" role="dialog" aria-label={SUB[id].name}>
      <button className="x" onClick={onClose} aria-label="Жабу"><Icon n="x" /></button>
      <h3>{SUB[id].name} <F s={SUB[id].cf} /></h3>
      <A to={subHash(id)} className="small">Зат карточкасы →</A>
      <p className="small muted">Шығатын бағыттар: {(OUT[id] ?? []).length}, кіретін: {(IN[id] ?? []).length}</p>
      <ul className="plain">
        {(OUT[id] ?? []).map((e) => (
          <li key={e.to}>→ <b>{stationName(e.to)}</b>: {e.rids.map((r, i) => <React.Fragment key={r}>{i > 0 && ', '}<A to={'r-' + r}>{RX[r].t}</A></React.Fragment>)}</li>
        ))}
      </ul>
    </div>
  );
}

function TextMap() {
  return (
    <section className="card textmap">
      <h2 className="h-sm">Картаның мәтіндік нұсқасы</h2>
      {METRO_ROWS.map((row, ri) => (
        <div key={ri} className="tm-row">
          <h3>{row.label}</h3>
          <ul className="plain">
            {METRO_STATIONS.filter((s) => s[2] === ri).map(([id]) => (
              <li key={id}>
                <b>{stationName(id)}</b> <F s={SUB[id].cf} />
                {(OUT[id] ?? []).length > 0 ? (
                  <ul>
                    {(OUT[id] ?? []).map((e) => (
                      <li key={e.to}>→ {stationName(e.to)} (<ReagentLabel rid={bestReaction(e).id} from={id} />) — <A to={'r-' + bestReaction(e).id}>{bestReaction(e).t}</A></li>
                    ))}
                  </ul>
                ) : <span className="muted small"> — базада бұл заттан шығатын бағыт жоқ</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ───── Видео стиліндегі маршрут «фильмі»
function RoutePlayer({ path, onClose }: { path: Path; onClose: () => void }) {
  const steps = path.edges.map((e) => ({ rid: bestReaction(e).id, from: e.from, to: e.to }));
  return <FilmOverlay steps={steps} crumb={`${stationName(path.nodes[0])} → ${stationName(path.nodes[path.nodes.length - 1])} · ${steps.length} саты`} onClose={onClose} />;
}

// ───── «Маршрутты өзің құрастыр»
interface Opt { label: React.ReactNode; edge?: Edge; foreign?: string; key: string }
function BuildRoute({ initFrom, initTo }: { initFrom: string; initTo: string }) {
  const [start, setStart] = useState(initFrom);
  const [target, setTarget] = useState(initTo);
  const [cur, setCur] = useState(initFrom);
  const [steps, setSteps] = useState<Edge[]>([]);
  const [tried, setTried] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<'reagent' | 'product'>('reagent');
  const [mistakes, setMistakes] = useState(0);
  const d = useMemo(() => distTo(target), [target]);
  const reset = (a = start, b = target) => { setStart(a); setTarget(b); setCur(a); setSteps([]); setTried({}); setMistakes(0); };
  const reachable = start in d;
  const done = cur === target;
  const options: Opt[] = useMemo(() => {
    const outs = OUT[cur] ?? [];
    const good = shuffle(outs.filter((e) => d[e.to] === d[cur] - 1));
    const bad = shuffle(outs.filter((e) => !(d[e.to] === d[cur] - 1)));
    const chosen = [...good.slice(0, 1), ...bad.slice(0, 3)];
    const opts: Opt[] = chosen.map((e) => ({ edge: e, key: ekey(e), label: null }));
    if (opts.length < 3) {
      const foreign = shuffle(EDGES.filter((x) => x.from !== cur && !outs.some((o) => o.to === x.to)));
      for (const f of foreign) {
        if (opts.length >= 3) break;
        if (opts.some((o) => o.key === 'f' + f.to)) continue;
        opts.push({ foreign: bestReaction(f).id, edge: f, key: 'f' + ekey(f), label: null });
      }
    }
    return shuffle(opts);
  }, [cur, target, steps.length]);
  const choose = (o: Opt) => {
    if (tried[o.key]) return;
    if (o.foreign) {
      setTried({ ...tried, [o.key]: `Базада ${stationName(cur)} үшін мұндай реакция жоқ. Бұл ${choice === 'reagent' ? 'реагент' : 'өнім'} «${RX[o.foreign].t}» реакциясына тиесілі.` });
      setMistakes((m) => m + 1);
      return;
    }
    const e = o.edge!;
    if (d[e.to] === d[cur] - 1) {
      setSteps([...steps, e]); setCur(e.to); setTried({});
    } else {
      const left = e.to in d ? `${stationName(e.to)}-дан мақсатқа дейін ${d[e.to]} қадам қалады (қазір ${d[cur]}).` : `Базада ${stationName(e.to)}-дан ${stationName(target)}-ке жол жоқ.`;
      setTried({ ...tried, [o.key]: `Реакция жүреді: ${stationName(cur)} → ${stationName(e.to)} («${bestReaction(e).t}»), бірақ мақсатқа жақындатпайды. ${left}` });
      setMistakes((m) => m + 1);
    }
  };
  return (
    <section className="card build">
      <h2 className="h-sm">Маршрутты өзің құрастыр</h2>
      <p className="muted">Әр қадамда {choice === 'reagent' ? 'реагент пен шартты' : 'келесі затты'} таңда. Дұрыс қадам мақсатқа ең қысқа жолмен жақындатады.</p>
      <div className="build-bar">
        <div className="seg" role="group" aria-label="Не таңдаймыз">
          <button className={choice === 'reagent' ? 'on' : ''} aria-pressed={choice === 'reagent'} onClick={() => setChoice('reagent')}>Реагентті таңдау</button>
          <button className={choice === 'product' ? 'on' : ''} aria-pressed={choice === 'product'} onClick={() => setChoice('product')}>Өнімді таңдау</button>
        </div>
        <div className="presets">
          {METRO_PRESETS.slice(0, 5).map(([a, b]) => <button key={a + b} className="chip" onClick={() => reset(a, b)}>{stationName(a)} → {stationName(b)}</button>)}
        </div>
      </div>
      <p className="build-goal">Мақсат: <b>{stationName(start)}</b> → <b>{stationName(target)}</b>{reachable && <span className="muted"> (ең қысқа жол: {d[start]} қадам)</span>}</p>
      {!reachable ? <div className="warn">Базада бұл айналуға жол жоқ. Басқа мысалды таңда.</div> : (
        <>
          <div className="chain">
            {[start, ...steps.map((s) => s.to)].map((n, k) => (
              <React.Fragment key={k}>
                {k > 0 && <span className="arrow chain-arrow"><span className="cond"><ReagentLabel rid={bestReaction(steps[k - 1]).id} from={steps[k - 1].from} /></span><span className="shaft">⟶</span></span>}
                <span className="cnode right"><F s={formulaText(n)} /><small>{stationName(n)}</small></span>
              </React.Fragment>
            ))}
            {!done && <><span className="arrow chain-arrow"><span className="shaft">⟶</span></span><span className="cnode hid cur"><span className="qbox">?</span></span><span className="op">…</span><span className="cnode"><F s={formulaText(target)} /><small>{stationName(target)}</small></span></>}
          </div>
          {done ? (
            <div className="feedback ok" role="status">
              <div className="fb-head"><Icon n="check" />Маршрут құрастырылды!</div>
              <p>{steps.length} қадам, қате таңдау: {mistakes}. {steps.length === d[start] ? 'Бұл — ең қысқа жол.' : ''}</p>
              <button className="btn sm" onClick={() => reset()}>Қайта бастау</button>
            </div>
          ) : (
            <div className="opts">
              {options.map((o, k) => {
                const e = o.edge!;
                const lab = choice === 'reagent' ? <ReagentLabel rid={o.foreign ?? bestReaction(e).id} from={o.foreign ? e.from : cur} /> : <><F s={formulaText(e.to)} /><span className="opt-name">{stationName(e.to)}</span></>;
                return (
                  <button key={o.key} className={'opt' + (tried[o.key] ? ' wrong' : '')} onClick={() => choose(o)} disabled={!!tried[o.key]}>
                    <span className="opt-k" aria-hidden>{'АӘБВ'[k]}</span>
                    <span className="opt-l">{lab}{tried[o.key] && <span className="opt-why">{tried[o.key]}</span>}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
