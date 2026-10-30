import React, { useEffect, useState } from 'react';
import type { Question, MCQ, ErrorQ, ChainQ } from '../lib/quiz';
import { RX } from '../data/index';
import { SUB } from '../data/substances';
import { F, TermView, formulaText, shortName, reagentText } from '../lib/format';
import { recordAnswer } from '../lib/store';
import { Arrow } from './Reaction';
import { A, Icon } from './ui';
import { reagentOf } from '../lib/graph';

export function QuizBlock({ q, compact, onNext }: { q: Question; compact?: boolean; onNext?: () => void }) {
  if (q.type === 'mcq') return <MCQView q={q} compact={compact} onNext={onNext} />;
  if (q.type === 'error') return <ErrorView q={q} onNext={onNext} />;
  return <ChainView q={q} onNext={onNext} />;
}

function Feedback({ ok, children, rid, onNext }: { ok: boolean; children: React.ReactNode; rid?: string; onNext?: () => void }) {
  return (
    <div className={'feedback ' + (ok ? 'ok' : 'bad')} role="status">
      <div className="fb-head"><Icon n={ok ? 'check' : 'x'} />{ok ? 'Дұрыс!' : 'Қате'}</div>
      <div>{children}</div>
      <div className="fb-actions">
        {rid && <A to={'r-' + rid} className="btn ghost sm">Реакция карточкасы</A>}
        {onNext && <button className="btn sm" onClick={onNext} autoFocus>Келесі сұрақ <Icon n="arrow" size={16} /></button>}
      </div>
    </div>
  );
}

function MCQView({ q, compact, onNext }: { q: MCQ; compact?: boolean; onNext?: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [q.key]);
  const answered = sel !== null;
  const choose = (i: number) => {
    if (answered) return;
    setSel(i);
    recordAnswer(q.mode, q.key, i === q.answer);
  };
  const s = q.stem;
  return (
    <div className={'quiz' + (compact ? ' compact' : '')}>
      <div className="q-stem">
        {s.clues && <ul className="clues">{s.clues.map((c, i) => <li key={i}><F s={c} /></li>)}</ul>}
        {s.text && <p className="muted">{s.text}</p>}
        {s.left && (
          <div className="eq big">
            {s.left.map((t, i) => <React.Fragment key={i}>{i > 0 && <span className="op">+</span>}<TermView t={t} /></React.Fragment>)}
            {q.mode === 'product' ? <Arrow cond={s.cond} /> : <span className="arrow"><span className="cond qmark">?</span><span className="shaft">⟶</span></span>}
            {s.askRight ? <span className="qbox">?</span> : s.right?.map((t, i) => <React.Fragment key={i}>{i > 0 && <span className="op">+</span>}<TermView t={t} /></React.Fragment>)}
          </div>
        )}
      </div>
      <p className="q-text">{q.question}</p>
      <div className="opts" role="group" aria-label="Жауап нұсқалары">
        {q.options.map((o, i) => {
          const cls = !answered ? '' : i === q.answer ? ' right' : i === sel ? ' wrong' : ' dim';
          return (
            <button key={i} className={'opt' + cls} onClick={() => choose(i)} disabled={answered && i !== sel && i !== q.answer} aria-pressed={sel === i}>
              <span className="opt-k" aria-hidden>{'АӘБВ'[i]}</span>
              <span className="opt-l">
                {o.kind === 'sub' ? <F s={o.label} /> : o.kind === 'reagent' ? <F s={o.label} /> : o.label}
                {answered && o.kind === 'sub' && o.id && <span className="opt-name">{SUB[o.id].name}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <Feedback ok={sel === q.answer} rid={q.rid} onNext={onNext}>
          {sel !== q.answer && q.options[sel!].why && <p><b>Сен таңдаған нұсқа:</b> {q.options[sel!].why}</p>}
          {q.mode === 'product' && <p><b>Дұрыс жауап:</b> <F s={q.options[q.answer].label} /> — {SUB[q.options[q.answer].id!].name}.</p>}
          <p>{q.explain}</p>
        </Feedback>
      )}
    </div>
  );
}

function ErrorView({ q, onNext }: { q: ErrorQ; onNext?: () => void }) {
  const [sel, setSel] = useState<number | 'cond' | null>(null);
  useEffect(() => setSel(null), [q.key]);
  const answered = sel !== null;
  const choose = (i: number | 'cond') => {
    if (answered) return;
    setSel(i);
    recordAnswer('error', q.key, i === q.bad);
  };
  const isOp = (p: string) => p === '+' || p === '→' || p === '⇌';
  const arrowIdx = q.parts.findIndex((p) => p === '→' || p === '⇌');
  const cls = (i: number | 'cond') => (!answered ? '' : i === q.bad ? ' right' : i === sel ? ' wrong' : '');
  return (
    <div className="quiz">
      <p className="q-text">Теңдеудің қай бөлігі қате? Қате деп ойлаған бөлікті бас.</p>
      <div className="eq big errq">
        {q.parts.map((p, i) => {
          if (isOp(p)) {
            if (i === arrowIdx) {
              return (
                <span key={i} className="arrow">
                  {q.cond && <button className={'cond tok' + cls('cond')} onClick={() => choose('cond')} disabled={answered}>{q.cond}</button>}
                  <span className="shaft">{p === '⇌' ? '⇌' : '⟶'}</span>
                </span>
              );
            }
            return <span key={i} className="op">{p}</span>;
          }
          return <button key={i} className={'tok' + cls(i)} onClick={() => choose(i)} disabled={answered}><F s={p} /></button>;
        })}
      </div>
      {answered && (
        <Feedback ok={sel === q.bad} rid={q.rid} onNext={onNext}>
          <p><b>Қате бөлік:</b> {q.bad === 'cond' ? q.cond : <F s={q.parts[q.bad]} />} → <b>дұрысы:</b> <F s={q.fix} /></p>
          <p>{q.why}</p>
        </Feedback>
      )}
    </div>
  );
}

function ChainView({ q, onNext }: { q: ChainQ; onNext?: () => void }) {
  const [ans, setAns] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  useEffect(() => { setAns({}); setDone(false); }, [q.key]);
  const current = q.hidden.find((h) => !ans[h]);
  const choose = (h: number, id: string) => {
    if (ans[h]) return;
    const next = { ...ans, [h]: id };
    setAns(next);
    if (q.hidden.every((x) => next[x])) {
      const ok = q.hidden.every((x) => next[x] === q.nodes[x]);
      recordAnswer('chain', q.key, ok);
      setDone(true);
    }
  };
  const allOk = q.hidden.every((x) => ans[x] === q.nodes[x]);
  return (
    <div className="quiz">
      <p className="q-text">Тізбектегі белгісіз заттарды тап. Реагенттер мен шарттар жебелердің үстінде берілген.</p>
      <div className="chain">
        {q.nodes.map((n, i) => {
          const hidden = q.hidden.includes(i);
          const shown = !hidden || done;
          const wrong = hidden && ans[i] && ans[i] !== n;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="arrow chain-arrow">
                  <span className="cond"><ReagentLabel rid={q.rids[i - 1]} from={q.nodes[i - 1]} /></span>
                  <span className="shaft">⟶</span>
                </span>
              )}
              <span className={'cnode' + (hidden ? ' hid' : '') + (wrong ? ' wrong' : hidden && ans[i] ? ' right' : '') + (current === i ? ' cur' : '')}>
                {shown ? <><F s={formulaText(n)} /><small>{shortName(n)}</small></> : ans[i] ? <><F s={formulaText(ans[i])} /><small>{shortName(ans[i])}</small></> : <span className="qbox">{'XY'[q.hidden.indexOf(i)]}</span>}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      {current !== undefined && (
        <>
          <p className="q-text">{'XY'[q.hidden.indexOf(current)]} заты қандай?</p>
          <div className="opts">
            {q.options[current].map((id, k) => (
              <button key={id} className="opt" onClick={() => choose(current, id)}>
                <span className="opt-k" aria-hidden>{'АӘБВ'[k]}</span><span className="opt-l"><F s={formulaText(id)} /></span>
              </button>
            ))}
          </div>
        </>
      )}
      {done && (
        <Feedback ok={allOk} onNext={onNext}>
          <ol className="chain-exp">
            {q.rids.map((rid, i) => (
              <li key={i}><A to={'r-' + rid}>{RX[rid].t}</A>: <F s={formulaText(q.nodes[i])} /> → <F s={formulaText(q.nodes[i + 1])} /></li>
            ))}
          </ol>
          {!allOk && <p>Әр қадамда реагент пен шартқа қара: олар бастапқы заттың қай реакцияға түсетінін анықтайды.</p>}
        </Feedback>
      )}
    </div>
  );
}

export function ReagentLabel({ rid, from }: { rid: string; from: string }) {
  const g = reagentOf(RX[rid], from);
  return <F s={reagentText(g.terms, g.cond)} className="wrap" />;
}
