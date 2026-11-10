import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DECKS, DECK_BY_ID, type Card, type Deck } from '../data/cards';
import { useProgress, rateCard, type Progress } from '../lib/store';
import { F } from '../lib/format';
import { A, Icon, go } from '../components/ui';

const KNOWN = 2; // осы қорапқа жеткен карта «меңгерілді» деп саналады

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const boxOf = (p: Progress, id: string) => p.cards?.[id]?.box;

function deckStats(p: Progress, d: Deck) {
  let known = 0, weak = 0, seen = 0;
  for (const c of d.cards) {
    const b = boxOf(p, c.id);
    if (b === undefined) continue;
    seen++;
    if (b >= KNOWN) known++; else if (b === 0) weak++;
  }
  return { known, weak, seen, total: d.cards.length, toRepeat: d.cards.length - known };
}

export function CardsPage({ deck }: { deck?: string }) {
  const d = deck ? DECK_BY_ID[deck.replace(/:.*$/, '')] : undefined;
  if (d) return <Session deck={d} onlyWeak={deck!.endsWith(':weak')} />;
  return <DeckList />;
}

function DeckList() {
  const prog = useProgress();
  return (
    <div className="page cards">
      <header className="phead">
        <h1>Флэш-карталар</h1>
        <p className="lead">Картаның бір жағында сұрақ, екінші жағында жауап. Алдымен өзің ойлап көр, сосын картаны бас — жауабы шығады. Білсең «Білемін», білмесең «Білмедім» таңда: білмеген карта кейін қайта келеді.</p>
      </header>
      <div className="deck-grid">
        {DECKS.map((d) => {
          const s = deckStats(prog, d);
          return (
            <article key={d.id} className="card deck">
              <span className="deck-ic" aria-hidden><Icon n={d.ic} size={24} /></span>
              <h2 className="deck-t">{d.title}</h2>
              <p className="muted small">{d.desc}</p>
              <div className="meter">
                <div className="meter-l"><span>Меңгерілді: {s.known}/{s.total}</span>{s.weak > 0 && <span className="deck-weak">Білмейтінім: {s.weak}</span>}</div>
                <div className="meter-b"><span style={{ width: `${(s.known / s.total) * 100}%` }} /></div>
              </div>
              <div className="row gap wrap">
                <A to={'cards-' + d.id} className="btn">{s.seen ? 'Жалғастыру' : 'Бастау'} <Icon n="arrow" size={16} /></A>
                {s.toRepeat > 0 && s.seen > 0 && <A to={'cards-' + d.id + ':weak'} className="btn ghost">Тек меңгерілмегендер ({s.toRepeat})</A>}
              </div>
            </article>
          );
        })}
      </div>
      <section className="card tips">
        <h2 className="h-card">Қалай жаттаған тиімді?</h2>
        <ul>
          <li>Жауапты көрмес бұрын <b>дауыстап айт</b> немесе қағазға жаз — сонда есте жақсы қалады.</li>
          <li>Бір отырыста 15–20 минут жеткілікті. Ертеңіне «Тек меңгерілмегендер» батырмасымен қайтала.</li>
          <li>Карта екі рет қатарынан «Білемін» деп белгіленсе, меңгерілді деп саналады.</li>
          <li>Пернетақта: <kbd>Бос орын</kbd> — аудару, <kbd>→</kbd> — білемін, <kbd>←</kbd> — білмедім. Телефонда картаны оңға немесе солға сырғыт.</li>
        </ul>
      </section>
    </div>
  );
}

function Session({ deck, onlyWeak }: { deck: Deck; onlyWeak: boolean }) {
  const prog = useProgress();
  const canReverse = deck.id.startsWith('names');
  const [rev, setRev] = useState(false);
  const build = () => {
    const pool = onlyWeak ? deck.cards.filter((c) => (boxOf(prog, c.id) ?? 0) < KNOWN) : deck.cards;
    return shuffle(pool.length ? pool : deck.cards);
  };
  const [queue, setQueue] = useState<Card[]>(build);
  const [pos, setPos] = useState(0);
  const [flip, setFlip] = useState(false);
  const [res, setRes] = useState({ known: 0, again: 0 });
  const [missed, setMissed] = useState<Card[]>([]);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const total = useMemo(() => new Set(queue.map((c) => c.id)).size, [queue]);
  const card = queue[pos];
  const done = pos >= queue.length;

  const restart = (cards?: Card[]) => { setQueue(shuffle(cards ?? deck.cards)); setPos(0); setFlip(false); setRes({ known: 0, again: 0 }); setMissed([]); };
  const rate = (known: boolean) => {
    if (!card || !flip) return;
    rateCard(card.id, known);
    setRes((r) => ({ known: r.known + (known ? 1 : 0), again: r.again + (known ? 0 : 1) }));
    if (!known) {
      setMissed((m) => (m.some((x) => x.id === card.id) ? m : [...m, card]));
      // білмеген карта 3 картадан кейін қайта шығады
      setQueue((q) => { const n = [...q]; n.splice(Math.min(pos + 4, n.length), 0, card); return n; });
    }
    setFlip(false); setDrag(0); setPos((p) => p + 1);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || done) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlip((f) => !f); }
      if (e.key === 'ArrowRight') rate(true);
      if (e.key === 'ArrowLeft') rate(false);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });

  const front = card ? (rev ? card.back : card.front) : '';
  const back = card ? (rev ? card.front : card.back) : '';
  const hint = card ? (rev ? 'Формуласы қандай?' : card.hint) : '';
  const left = queue.length - pos;

  return (
    <div className="page cards session">
      <header className="sess-head">
        <div>
          <span className="page-kicker">Флэш-карталар{onlyWeak ? ' · меңгерілмегендер' : ''}</span>
          <h1 className="sess-t">{deck.title}</h1>
        </div>
        {canReverse && (
          <div className="seg" role="group" aria-label="Бағыты">
            <button className={!rev ? 'on' : ''} onClick={() => { setRev(false); setFlip(false); }}>Формула → атау</button>
            <button className={rev ? 'on' : ''} onClick={() => { setRev(true); setFlip(false); }}>Атау → формула</button>
          </div>
        )}
      </header>

      {done ? (
        <section className="card sess-done">
          <div className="sd-score"><b>{res.known}</b> білдің · <b className="bad">{missed.length}</b> қайталау керек</div>
          <p>{missed.length === 0 ? 'Тамаша! Бұл колоданың барлық картасын білдің.' : 'Төмендегі карталарды тағы бір қайтала — ертең оларды «Тек меңгерілмегендер» арқылы ашуға болады.'}</p>
          {missed.length > 0 && <ul className="plain">{missed.map((c) => <li key={c.id}><F s={rev ? c.back : c.front} /> → <b><F s={rev ? c.front : c.back} /></b></li>)}</ul>}
          <div className="row gap wrap">
            {missed.length > 0 && <button className="btn" onClick={() => restart(missed)}>Қателерді қайталау ({missed.length})</button>}
            <button className={'btn' + (missed.length ? ' ghost' : '')} onClick={() => restart()}>Колоданы қайта бастау</button>
            <button className="btn ghost" onClick={() => go('cards')}>Барлық колода</button>
          </div>
        </section>
      ) : (
        <>
          <div className="sess-bar">
            <div className="meter-b"><span style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
            <span className="muted small">{pos + 1}/{queue.length} · білдің: {res.known} · қайталау: {res.again}{queue.length > total ? ` · ${queue.length - total} қайталанған` : ''}</span>
          </div>
          <div className="fc-wrap">
            <div
              className={'fc' + (flip ? ' flipped' : '') + (drag > 60 ? ' to-know' : drag < -60 ? ' to-again' : '')}
              role="button" tabIndex={0} aria-label={flip ? `Жауап: ${back}. Бағалау үшін төмендегі батырмаларды бас.` : `Сұрақ: ${front}. Жауабын көру үшін бас.`}
              style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 18}deg)` } : undefined}
              onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
              onPointerMove={(e) => { if (start.current && flip && e.pointerType !== 'mouse') setDrag(e.clientX - start.current.x); }}
              onPointerUp={(e) => {
                const s = start.current; start.current = null;
                if (!s) return;
                const dx = e.clientX - s.x, dy = e.clientY - s.y;
                if (flip && Math.abs(dx) > 90) { rate(dx > 0); return; }
                setDrag(0);
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) setFlip((f) => !f);
              }}
              onPointerCancel={() => { start.current = null; setDrag(0); }}
            >
              <div className="fc-inner">
                <div className="fc-face fc-front">
                  <span className="fc-hint">{hint}</span>
                  <div className={'fc-main' + (front.length > 18 ? ' long' : '')}><F s={front} /></div>
                  <span className="fc-tap">Жауабын көру үшін бас</span>
                </div>
                <div className="fc-face fc-back">
                  <span className="fc-hint">Жауабы</span>
                  <div className={'fc-main' + (back.length > 18 ? ' long' : '')}><F s={back} /></div>
                  {card?.extra && <p className="fc-extra"><F s={card.extra} /></p>}
                </div>
              </div>
            </div>
          </div>
          <div className="fc-actions">
            {flip ? (
              <>
                <button className="fc-btn again" onClick={() => rate(false)}><span aria-hidden>✗</span> Білмедім</button>
                <button className="fc-btn know" onClick={() => rate(true)}><span aria-hidden>✓</span> Білемін</button>
              </>
            ) : (
              <button className="btn big" onClick={() => setFlip(true)}>Жауабын көру</button>
            )}
          </div>
          <p className="muted small center">{flip ? 'Шынымен білдің бе? Өзіңе адал бол — білмеген карта кейін қайта келеді.' : `Ойланып көр, сосын картаны бас. Қалды: ${left}`}</p>
        </>
      )}
    </div>
  );
}
