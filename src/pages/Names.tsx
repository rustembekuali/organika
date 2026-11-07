import React, { useMemo, useRef, useState } from 'react';
import { NAME_GROUPS, ALL_NAMES, ROOTS, ENDINGS, BUILD_CLS, buildName, type BuildCls, type NameItem, type NameGroup } from '../data/names';
import { SUBSTANCES } from '../data/substances';
import { F } from '../lib/format';
import { A, Icon, LearnTabs, subHash } from '../components/ui';
import { Structure, hasStructure } from '../components/Structure';

type Item = NameItem & { g: NameGroup };

// Атау бойынша базадағы затты табу (сілтеме және құрылым үшін)
const norm = (s: string) => s.toLowerCase().replace(/[\s\-–,]/g, '').replace(/ё/g, 'е');
const SUB_BY_NAME: Record<string, string> = {};
for (const s of SUBSTANCES) for (const n of [s.name, ...(s.alt ?? [])]) { const k = norm(n); if (!SUB_BY_NAME[k]) SUB_BY_NAME[k] = s.id; }
export function subOf(it: { sys: string; triv?: string }): string | undefined {
  const names = [it.sys, ...(it.triv ? it.triv.split(/,\s*/) : [])];
  for (const n of names) { const id = SUB_BY_NAME[norm(n)]; if (id) return id; }
  return undefined;
}

const PARTS: [string, string][] = [['all', 'Барлығы'], ['hc', 'Көмірсутектер'], ['o', 'Оттекті'], ['n', 'Азотты']];

export function NamesPage() {
  return (
    <div className="page names">
      <LearnTabs on="names" />
      <header className="phead">
        <h1>Атауларды үйрен</h1>
        <p className="lead">Органикалық заттың атауы екі бөліктен тұрады: <b>түбір</b> көміртек атомдарының санын, ал <b>жұрнақ</b> заттың класын көрсетеді. Осы екеуін білсең, жүздеген атауды жаттамай-ақ құрастырасың.</p>
      </header>
      <Roots />
      <Endings />
      <Builder />
      <Trainer />
      <NameTables />
    </div>
  );
}

function Roots() {
  return (
    <section className="card">
      <h2 className="h-card">1-қадам. Түбір — көміртек саны</h2>
      <div className="root-grid">
        {ROOTS.slice(1).map((r, i) => (
          <div key={r} className="root-cell">
            <span className="rc-n">C{i + 1}</span>
            <span className="rc-r">{r}-</span>
            <span className="rc-ex muted">{r}ан</span>
          </div>
        ))}
      </div>
      <p className="muted small">Алғашқы төртеуін жаттап ал: <b>мет</b>ан, <b>эт</b>ан, <b>проп</b>ан, <b>бут</b>ан. 5-тен бастап түбір грек санынан алынады: пента (5), гекса (6), гепта (7), окта (8), нона (9), дека (10).</p>
    </section>
  );
}

function Endings() {
  return (
    <section className="card">
      <h2 className="h-card">2-қадам. Жұрнақ — заттың класы</h2>
      <div className="tablewrap"><table className="tbl">
        <thead><tr><th>Класс</th><th>Жұрнақ</th><th>Нені білдіреді</th><th>Мысал</th></tr></thead>
        <tbody>{ENDINGS.map((e) => <tr key={e.cls}><td>{e.cls}</td><td><b className="end-hl">{e.ending}</b></td><td><F s={e.group} /></td><td><F s={e.example} /></td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

function Builder() {
  const [n, setN] = useState(3);
  const [cls, setCls] = useState<BuildCls>('alkane');
  const min = BUILD_CLS.find((c) => c.id === cls)!.min;
  const nn = Math.max(n, min);
  const res = buildName(cls, nn);
  const sid = res ? subOf({ sys: res.name }) : undefined;
  return (
    <section className="card builder">
      <h2 className="h-card">3-қадам. Өзің құрастыр</h2>
      <div className="builder-ctl">
        <div>
          <div className="bp-eyebrow">Көміртек саны</div>
          <div className="seg">{ROOTS.slice(1).map((_, i) => <button key={i} className={nn === i + 1 ? 'on' : ''} disabled={i + 1 < min} onClick={() => setN(i + 1)}>{i + 1}</button>)}</div>
        </div>
        <div>
          <div className="bp-eyebrow">Класс</div>
          <div className="seg">{BUILD_CLS.map((c) => <button key={c.id} className={cls === c.id ? 'on' : ''} onClick={() => setCls(c.id)}>{c.label}</button>)}</div>
        </div>
      </div>
      {res && (
        <div className="builder-out">
          <div className="bo-main">
            <div className="bo-f"><F s={res.f} /></div>
            <div className="bo-name">{res.parts.map((p, i) => <span key={i} className={'bo-part p' + Math.min(i, 2)}>{p}</span>)}</div>
            <div className="bo-res">= <b>{res.name}</b></div>
            <div className="muted small">Жалпы формула: <F s={res.gen} /></div>
            {sid && <A to={subHash(sid)} className="btn ghost sm">Зат карточкасы <Icon n="arrow" size={14} /></A>}
          </div>
          {sid && hasStructure(sid) && <div className="bo-struct"><Structure id={sid} maxH={150} /></div>}
        </div>
      )}
    </section>
  );
}

// ───────── Жаттығу: атауын тап / формуласын тап
type Mode = 'f2n' | 'n2f' | 'mix';
interface Q { it: Item; mode: 'f2n' | 'n2f'; options: Item[]; answer: number }

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const keyOf = (x: NameItem) => x.f + '|' + x.sys;

function makeQ(pool: Item[], mode: Mode, asked: string[] = []): Q {
  // бір раундта сұрақ қайталанбасын
  const fresh = pool.filter((x) => !asked.includes(keyOf(x)));
  const from = fresh.length ? fresh : pool;
  const it = from[Math.floor(Math.random() * from.length)];
  const m: 'f2n' | 'n2f' = mode === 'mix' ? (Math.random() < 0.5 ? 'f2n' : 'n2f') : mode;
  // алдымен сол топтан, жетпесе — сол бөлімнен, сосын барлығынан
  const cands = [...shuffle(it.g.items.map((x) => ({ ...x, g: it.g }))), ...shuffle(ALL_NAMES.filter((x) => x.g.part === it.g.part)), ...shuffle(ALL_NAMES)];
  const opts: Item[] = [it];
  for (const c of cands) {
    if (opts.length >= 4) break;
    if (c.f === it.f) continue; // изомерлер шатастырмасын
    if (opts.some((o) => o.sys === c.sys || o.f === c.f)) continue;
    opts.push(c);
  }
  const options = shuffle(opts);
  return { it, mode: m, options, answer: options.indexOf(it) };
}

const ROUND = 10;

function Trainer() {
  const [part, setPart] = useState('all');
  const [mode, setMode] = useState<Mode>('f2n');
  const pool = useMemo(() => (ALL_NAMES.filter((x) => (part === 'all' || x.g.part === part) && !x.f.includes('n)'))), [part]);
  const q0 = useRef<Q>(makeQ(pool, mode));
  const [q, setQ] = useState<Q>(q0.current);
  const [k, setK] = useState(0);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [wrong, setWrong] = useState<Item[]>([]);
  const [asked, setAsked] = useState<string[]>(() => [keyOf(q0.current.it)]);
  const restart = (p = part, m = mode) => {
    const pl = ALL_NAMES.filter((x) => (p === 'all' || x.g.part === p) && !x.f.includes('n)'));
    const nq = makeQ(pl, m);
    setQ(nq); setAsked([keyOf(nq.it)]); setK(0); setScore(0); setPick(null); setWrong([]);
  };
  const choose = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    if (i === q.answer) setScore((s) => s + 1); else setWrong((w) => [...w, q.it]);
  };
  const nextQ = () => {
    const nq = makeQ(pool, mode, asked);
    setK((x) => x + 1); setPick(null); setQ(nq); setAsked((a) => [...a, keyOf(nq.it)]);
  };
  const done = k >= ROUND;
  const nm = (x: Item) => x.sys + (x.triv ? ' (' + x.triv + ')' : '');

  return (
    <section className="card trainer" aria-live="polite">
      <h2 className="h-card">4-қадам. Өзіңді тексер</h2>
      <div className="row gap wrap trainer-ctl">
        <div className="seg">{PARTS.map(([id, l]) => <button key={id} className={part === id ? 'on' : ''} onClick={() => { setPart(id); restart(id, mode); }}>{l}</button>)}</div>
        <div className="seg">{([['f2n', 'Формула → атау'], ['n2f', 'Атау → формула'], ['mix', 'Аралас']] as [Mode, string][]).map(([id, l]) => <button key={id} className={mode === id ? 'on' : ''} onClick={() => { setMode(id); restart(part, id); }}>{l}</button>)}</div>
      </div>
      {done ? (
        <div className="trainer-done">
          <div className="td-score"><b>{score}</b>/{ROUND}</div>
          <p>{score === ROUND ? 'Керемет! Барлығы дұрыс.' : score >= 7 ? 'Жақсы нәтиже. Қателерді тағы бір қарап шық.' : 'Түбір мен жұрнақ кестесін қайта қарап, тағы байқап көр.'}</p>
          {wrong.length > 0 && <ul className="plain">{wrong.map((w, i) => <li key={i}><F s={w.f} /> — <b>{nm(w)}</b> <span className="muted small">· {w.g.title}</span></li>)}</ul>}
          <button className="btn" onClick={() => restart()}>Қайтадан бастау</button>
        </div>
      ) : (
        <>
          <div className="muted small">Сұрақ {k + 1}/{ROUND} · дұрыс: {score}</div>
          <div className="trainer-q">
            {q.mode === 'f2n' ? <>Бұл заттың атауы қандай? <span className="tq-big"><F s={q.it.f} /></span></> : <>Формуласын тап: <span className="tq-big">{nm(q.it)}</span></>}
          </div>
          <div className="opts">
            {q.options.map((o, i) => (
              <button key={i} className={'opt' + (pick === null ? '' : i === q.answer ? ' right' : i === pick ? ' wrong' : ' dim')} disabled={pick !== null} onClick={() => choose(i)}>
                <span className="opt-k">{'ABCD'[i]}</span>
                <span className="opt-l">{q.mode === 'f2n' ? <>{o.sys}{o.triv && <span className="opt-name">{o.triv}</span>}</> : <F s={o.f} />}</span>
              </button>
            ))}
          </div>
          {pick !== null && (
            <div className={'feedback ' + (pick === q.answer ? 'ok' : 'bad')}>
              <div className="fb-head">{pick === q.answer ? <><Icon n="check" size={18} /> Дұрыс</> : 'Қате'}</div>
              <p><F s={q.it.f} /> — <b>{nm(q.it)}</b>. {q.it.g.rule.split(/(?<=\.)\s/)[0]}</p>
              {q.it.fix && <p className="muted small">Ескерту: {q.it.fix}.</p>}
              <div className="fb-actions"><button className="btn" onClick={nextQ}>{k + 1 >= ROUND ? 'Нәтиже' : 'Келесі'} <Icon n="arrow" size={16} /></button></div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NameTables() {
  const [s, setS] = useState('');
  const t = norm(s);
  const groups = NAME_GROUPS.map((g) => ({ g, items: t ? g.items.filter((x) => norm(x.sys + (x.triv ?? '') + x.f).includes(t)) : g.items })).filter((x) => x.items.length);
  return (
    <section>
      <h2 className="h-md">Атаулар кестесі</h2>
      <div className="bigsearch"><Icon n="search" /><input type="search" value={s} onChange={(e) => setS(e.target.value)} placeholder="Іздеу: пропан, C3H8, сірке…" aria-label="Атауларды іздеу" /></div>
      {groups.length === 0 && <p className="muted">Ештеңе табылмады.</p>}
      <div className="name-groups">
        {groups.map(({ g, items }) => (
          <details key={g.id} className="card name-group" open={!!t || g.id === 'alkanes'}>
            <summary><span className="ng-t">{g.title}</span>{g.gen && <span className="ng-gen"><F s={g.gen} /></span>}<span className="muted small">{items.length}</span></summary>
            <p className="muted small"><F s={g.rule} /></p>
            <div className="tablewrap"><table className="tbl">
              <thead><tr><th>Формула</th><th>Жүйелік атауы</th><th>Тривиал атауы</th></tr></thead>
              <tbody>{items.map((x, i) => {
                const sid = subOf(x);
                return (
                  <tr key={i}>
                    <td><F s={x.f} /></td>
                    <td>{sid ? <A to={subHash(sid)}>{x.sys}</A> : x.sys}{x.fix && <div className="name-fix">Түзетілді: {x.fix}</div>}</td>
                    <td>{x.triv ?? <span className="muted">—</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </details>
        ))}
      </div>
    </section>
  );
}
