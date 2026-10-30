import React from 'react';
import { SUB } from '../data/substances';
import { hillFormula } from './chem';
import type { Term } from '../data/types';

/** Формула жолын төменгі индекстер мен зарядтармен көрсету: C2H5OH → C₂H₅OH, CH3COO^- → CH₃COO⁻ */
export function F({ s, className }: { s: string; className?: string }) {
  const out: React.ReactNode[] = [];
  let i = 0, key = 0, buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '^') {
      flush();
      let sup = '';
      i++;
      while (i < s.length && /[0-9]/.test(s[i])) sup += s[i++];
      if (i < s.length && /[+-]/.test(s[i])) sup += s[i++] === '-' ? '−' : '+';
      out.push(<sup key={key++}>{sup}</sup>);
      continue;
    }
    const prev = s[i - 1] ?? '';
    if (/[0-9]/.test(ch) && /[A-Za-z)\]]/.test(prev) && !/[а-яәғқңөұүһі]/i.test(prev)) {
      flush();
      let d = '';
      while (i < s.length && /[0-9]/.test(s[i])) d += s[i++];
      out.push(<sub key={key++}>{d}</sub>);
      continue;
    }
    if (ch === '–' || ch === '=' || ch === '≡') {
      // ұзын жартылай құрылымдық формулалар тар экранда байланыс белгісінен кейін бөлінсін
      buf += ch;
      flush();
      out.push(<wbr key={key++} />);
      i++;
      continue;
    }
    if (ch === 'n' && /[)\]]/.test(prev)) {
      flush();
      out.push(<sub key={key++}>n</sub>);
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  // сөйлемдер (бос орны мен қазақ әріптері бар) жолға бөлінуі керек
  const prose = /\s/.test(s) && /[а-яәіңғүұқөһ]/i.test(s);
  return <span className={'f' + (prose ? ' wrap' : '') + (className ? ' ' + className : '')}>{out}</span>;
}

export type FormulaMode = 'sf' | 'cf' | 'hill';

export function formulaText(id: string, mode: FormulaMode = 'sf'): string {
  const s = SUB[id];
  if (!s) return id;
  if (mode === 'sf') return s.sf ?? s.cf;
  if (mode === 'hill') {
    if (/[а-яә]/i.test(s.cf)) return s.cf;
    try { return hillFormula(s.cf); } catch { return s.cf; }
  }
  return s.cf;
}

export function coefText(k: string) {
  return k;
}

export function TermView({ t, mode = 'sf' }: { t: Term; mode?: FormulaMode }) {
  return (
    <span className="term">
      {t.k && <span className="coef">{t.k}</span>}
      <F s={formulaText(t.id, mode)} />
      {t.mark && <span className="mark">{t.mark}</span>}
    </span>
  );
}

/** Таза мәтінді формула (aria, іздеу) */
export function plainFormula(s: string) {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return s.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + d.split('').map((c: string) => subs[+c]).join('')).replace(/\^(\d*)([+-])/g, (_, d, c) => d + (c === '-' ? '⁻' : '⁺'));
}

export function shortName(id: string) {
  const s = SUB[id];
  if (!s) return id;
  return s.name.replace(/\s*\([^()]*\)\s*$/, '');
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Реагент пен шартты бір жолға жинау; шарт реагенттен басталса, қайталамаймыз */
export function reagentText(terms: { k: string; id: string }[], cond?: string): string {
  let c = cond ?? '';
  const parts = terms.map((t) => (t.k || '') + formulaText(t.id, 'cf'));
  terms.forEach((t, i) => {
    const pf = plainFormula(formulaText(t.id, 'cf'));
    if (c && c.startsWith(pf)) { parts[i] = (t.k || '') + c; c = ''; }
  });
  const main = parts.length ? '+' + parts.join(' + ') : '';
  return main + (c ? (main ? '; ' : '') + c : '') || '—';
}
