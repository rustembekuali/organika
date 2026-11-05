import React, { useMemo, useState } from 'react';
import { RX, eqOf } from '../data/index';
import { SUB } from '../data/substances';
import { TYPE_NAMES } from '../data/topics';
import { Film, hasScene } from '../components/Film';
import { Structure, hasStructure } from '../components/Structure';
import { F, formulaText } from '../lib/format';
import { Icon } from '../components/ui';

interface Experiment { base: string; rid: string }

const BASES = ['ethene', 'ethyne', 'ethanol', 'benzene', 'ch4'];
const EXPERIMENTS: Experiment[] = [
  { base: 'ethene', rid: 'ethene-br2' },
  { base: 'ethene', rid: 'ethene-hydration' },
  { base: 'ethene', rid: 'ethene-h2' },
  { base: 'ethene', rid: 'ethene-hcl' },
  { base: 'ethyne', rid: 'ethyne-br2-1' },
  { base: 'ethyne', rid: 'kucherov-ethyne' },
  { base: 'ethyne', rid: 'ethyne-h2' },
  { base: 'ethyne', rid: 'ethyne-hcl' },
  { base: 'ethanol', rid: 'ethanol-na' },
  { base: 'ethanol', rid: 'ethanol-hcl' },
  { base: 'ethanol', rid: 'ethanol-cuo' },
  { base: 'benzene', rid: 'benzene-cl2' },
  { base: 'benzene', rid: 'benzene-h2' },
  { base: 'benzene', rid: 'benzene-nitration' },
  { base: 'ch4', rid: 'ch4-cl2-1' },
  { base: 'ch4', rid: 'methane-combustion' },
].filter((x) => RX[x.rid] && hasScene(x.rid));

function Molecule({ id, k, compact = false }: { id: string; k?: string; compact?: boolean }) {
  return (
    <span className={'student-molecule' + (compact ? ' compact' : '')}>
      {k && k !== '1' && <b className="student-coef">{k}</b>}
      {hasStructure(id) && SUB[id].cls !== 'inorg'
        ? <Structure id={id} maxH={compact ? 82 : 126} label={!compact} />
        : <span className="student-formula-pill"><F s={formulaText(id)} />{!compact && <small>{SUB[id].name}</small>}</span>}
    </span>
  );
}

function HeroMolecule() {
  return (
    <svg className="hero-molecule" viewBox="0 0 300 170" aria-hidden="true">
      <g className="hero-orbit">
        <ellipse cx="155" cy="84" rx="105" ry="45" />
        <ellipse cx="155" cy="84" rx="105" ry="45" transform="rotate(60 155 84)" />
      </g>
      <g className="hero-bonds">
        <path d="M78 105 120 52 180 48 226 96 190 137 117 137Z" />
        <path d="m120 52 17 25m43-29-13 28m59 20-32 2m-4 39-17-27m-56 27 15-28" />
      </g>
      <g className="hero-atoms">
        <circle cx="78" cy="105" r="18" /><circle cx="120" cy="52" r="18" />
        <circle className="oxygen" cx="180" cy="48" r="18" /><circle cx="226" cy="96" r="18" />
        <circle className="nitrogen" cx="190" cy="137" r="18" /><circle cx="117" cy="137" r="18" />
      </g>
      <g className="hero-letters">
        <text x="78" y="111">C</text><text x="120" y="58">C</text><text className="light" x="180" y="54">O</text>
        <text x="226" y="102">C</text><text className="light" x="190" y="143">N</text><text x="117" y="143">C</text>
      </g>
    </svg>
  );
}

export function StudentLab({ onAdvanced }: { onAdvanced: () => void }) {
  const [base, setBase] = useState('ethene');
  const [rid, setRid] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const options = useMemo(() => EXPERIMENTS.filter((x) => x.base === base), [base]);
  const reaction = rid ? RX[rid] : null;
  const equation = reaction ? eqOf(reaction) : null;
  const activeStep = reaction ? 3 : 2;

  const chooseBase = (id: string) => {
    setBase(id);
    setRid(null);
    setStarted(false);
  };
  const chooseReaction = (id: string) => {
    setRid(id);
    setStarted(false);
  };
  const restart = () => {
    setRunKey((k) => k + 1);
    setStarted(true);
  };

  return (
    <div className="student-lab">
      <section className="student-hero">
        <div className="student-hero-copy">
          <span className="student-eyebrow"><span />2D ИНТЕРАКТИВТІ ЗЕРТХАНА</span>
          <h1>Реакцияны өзің жасап көр</h1>
          <p>Заттарды таңда, реакцияны жүргіз және атомдардың қалай қозғалатынын бақыла.</p>
          <div className="student-hero-tags"><span>16 тәжірибе</span><span>Тек қажетті қадамдар</span><span>Қазақша түсіндірме</span></div>
        </div>
        <HeroMolecule />
        <button className="student-advanced" onClick={onAdvanced}>Қосымша құралдар <span>↗</span></button>
      </section>

      <ol className="student-steps" aria-label="Тәжірибе қадамдары">
        {['Негізгі затты таңда', 'Реагентті қос', 'Реакцияны жүргіз'].map((label, i) => (
          <li key={label} className={i + 1 < activeStep ? 'done' : i + 1 === activeStep ? 'active' : ''} aria-current={i + 1 === activeStep ? 'step' : undefined}>
            <span>{i + 1 < activeStep ? '✓' : i + 1}</span><b>{label}</b>
          </li>
        ))}
      </ol>

      <section className="student-picker" aria-labelledby="base-title">
        <div className="student-section-head">
          <div><span className="student-number">1</span><h2 id="base-title">Негізгі затты таңда</h2></div>
          <p>Басқанда төменде оған сай реагенттер шығады</p>
        </div>
        <div className="base-grid">
          {BASES.map((id) => (
            <button key={id} className={'base-card' + (base === id ? ' selected' : '')} aria-pressed={base === id} onClick={() => chooseBase(id)}>
              <span className="base-check">{base === id ? '✓' : ''}</span>
              <Molecule id={id} compact />
              <strong>{SUB[id].name}</strong>
              <span className="base-formula"><F s={formulaText(id)} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="student-picker reagent-picker" aria-labelledby="reagent-title">
        <div className="student-section-head">
          <div><span className="student-number">2</span><h2 id="reagent-title">{SUB[base].name}ға не қосасыз?</h2></div>
          <p>Бір реагентті таңда</p>
        </div>
        <div className="reagent-grid">
          {options.map((option) => {
            const e = eqOf(RX[option.rid])!;
            const reagents = e.left.filter((t) => t.id !== base);
            return (
              <button key={option.rid} className={'reagent-card' + (rid === option.rid ? ' selected' : '')} aria-pressed={rid === option.rid} onClick={() => chooseReaction(option.rid)}>
                <span className="reagent-plus">+</span>
                <span className="reagent-formulas">
                  {reagents.map((t) => <span key={t.id}>{t.k && t.k !== '1' ? t.k : ''}<F s={formulaText(t.id)} /></span>)}
                </span>
                <span className="reagent-name">{reagents.map((t) => SUB[t.id].name).join(' + ')}</span>
                <span className="reagent-check">{rid === option.rid ? '✓' : '→'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="student-experiment" aria-labelledby="experiment-title">
        <div className="student-section-head experiment-heading">
          <div><span className="student-number">3</span><h2 id="experiment-title">{reaction ? reaction.t : 'Реакцияны жүргізу'}</h2></div>
          {reaction && <span className="experiment-type">{TYPE_NAMES[reaction.ty]}</span>}
        </div>

        {!reaction && (
          <div className="experiment-empty">
            <Molecule id={base} />
            <span className="empty-plus">+</span>
            <span className="empty-reagent">2-қадамда<br />реагентті таңда</span>
          </div>
        )}

        {reaction && equation && !started && (
          <div className="experiment-ready">
            <div className="ready-stage">
              <div className="ready-reactants">
                {equation.left.map((t, i) => <React.Fragment key={t.id}>{i > 0 && <span className="ready-plus">+</span>}<Molecule id={t.id} k={t.k} /></React.Fragment>)}
              </div>
              <div className="ready-arrow"><span>{reaction.c || 'шартсыз'}</span><b>⟶</b></div>
              <div className="product-question"><span>?</span><small>Қандай өнім<br />түзіледі?</small></div>
            </div>
            <button className="run-reaction" onClick={() => setStarted(true)}><Icon n="flask" size={22} />Реакцияны жүргізу<span>→</span></button>
            <p className="run-hint">Батырманы басқанда атомдардың қозғалысы басталады</p>
          </div>
        )}

        {reaction && started && (
          <div className="experiment-playing">
            <Film key={reaction.id + '-' + runKey} steps={[{ rid: reaction.id }]} autoplay simple />
            <div className="student-explanation">
              <span className="explanation-icon">✓</span>
              <div><strong>Не өзгерді?</strong><p>{reaction.x.split(/(?<=\.)\s/)[0]}</p></div>
              <button onClick={restart}><Icon n="play" size={16} />Қайта жүргізу</button>
            </div>
          </div>
        )}
      </section>

      <p className="student-safety"><span>i</span>Бұл — виртуалды зертхана. Нақты реактивтермен тек мұғалімнің нұсқауымен жұмыс істе.</p>
    </div>
  );
}
