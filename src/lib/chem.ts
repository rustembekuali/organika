// Формулаларды талдау және атомдық/зарядтық балансты тексеру
import type { ParsedEq, Term } from '../data/types';

export type Counts = Record<string, number>;

/** "C3H5(C17H35COO)3", "[Ag(NH3)2]OH", "(C2H4)n", "CH3COO^-", "Ca^2+" */
export function parseFormula(raw: string, n = 1): { atoms: Counts; charge: number } {
  let f = raw.replace(/[↑↓\s]/g, '');
  let charge = 0;
  const ci = f.indexOf('^');
  if (ci >= 0) {
    const ch = f.slice(ci + 1);
    f = f.slice(0, ci);
    const m = ch.match(/^(\d*)([+-])$/);
    if (!m) throw new Error('Заряд қате: ' + raw);
    charge = (m[1] ? parseInt(m[1], 10) : 1) * (m[2] === '+' ? 1 : -1);
  }
  let i = 0;
  const readMult = (): number => {
    let s = '';
    while (i < f.length && /[0-9]/.test(f[i])) s += f[i++];
    let mult = s ? parseInt(s, 10) : 1;
    if (f[i] === 'n') { i++; mult = (s ? mult : 1) * n; }
    return mult;
  };
  const group = (close?: string): Counts => {
    const acc: Counts = {};
    const add = (c: Counts, k: number) => { for (const e in c) acc[e] = (acc[e] || 0) + c[e] * k; };
    while (i < f.length) {
      const ch = f[i];
      if (ch === '(' || ch === '[') {
        i++;
        const inner = group(ch === '(' ? ')' : ']');
        add(inner, readMult());
      } else if (ch === ')' || ch === ']') {
        if (ch !== close) throw new Error('Жақша сәйкес емес: ' + raw);
        i++;
        return acc;
      } else if (/[A-Z]/.test(ch)) {
        let el = ch; i++;
        while (i < f.length && /[a-z]/.test(f[i]) && f[i] !== 'n') el += f[i++];
        // 'n' кіші әрпі тек полимерлік көбейткіш; Zn, Mn, Sn сияқты элементтерді ажыратамыз
        if (f[i] === 'n' && /^(Z|M|S|I)$/.test(el) && (i + 1 >= f.length || !/[0-9]/.test(f[i + 1]))) { el += 'n'; i++; }
        const k = readMult();
        acc[el] = (acc[el] || 0) + k;
      } else {
        throw new Error(`Таныс емес таңба "${ch}" формулада: ${raw}`);
      }
    }
    if (close) throw new Error('Жақша жабылмаған: ' + raw);
    return acc;
  };
  return { atoms: group(), charge };
}

export function coefValue(k: string, n = 1): number {
  if (!k) return 1;
  const m = k.match(/^(\d*)(n?)$/);
  if (!m) throw new Error('Коэффициент қате: ' + k);
  const num = m[1] ? parseInt(m[1], 10) : 1;
  return m[2] ? num * n : num;
}

export function parseEq(eq: string): ParsedEq {
  const rev = eq.includes('<=>');
  const parts = eq.split(rev ? '<=>' : '->');
  if (parts.length !== 2) throw new Error('Теңдеуде бір жебе болуы керек: ' + eq);
  const side = (s: string): Term[] =>
    s.split(' + ').map((t) => {
      const tok = t.trim().split(/\s+/);
      let k = '', id: string;
      if (tok.length === 2) { k = tok[0]; id = tok[1]; } else if (tok.length === 1) { id = tok[0]; } else throw new Error('Мүше қате: ' + t);
      let mark: string | undefined;
      if (id.endsWith('↑') || id.endsWith('↓')) { mark = id.slice(-1); id = id.slice(0, -1); }
      return { k, id, mark };
    });
  return { left: side(parts[0]), right: side(parts[1]), rev };
}

export function sideCounts(terms: Term[], formulaOf: (id: string) => string, n = 1) {
  const atoms: Counts = {};
  let charge = 0;
  for (const t of terms) {
    const p = parseFormula(formulaOf(t.id), n);
    const k = coefValue(t.k, n);
    for (const e in p.atoms) atoms[e] = (atoms[e] || 0) + p.atoms[e] * k;
    charge += p.charge * k;
  }
  return { atoms, charge };
}

export interface BalanceResult { ok: boolean; left: Counts; right: Counts; lc: number; rc: number; elements: string[] }

export function checkBalance(eq: ParsedEq, formulaOf: (id: string) => string): BalanceResult {
  let res: BalanceResult | null = null;
  // n-ге тәуелді полимерлік теңдеулерді бірнеше мәнде тексереміз
  for (const n of [1, 2, 5]) {
    const L = sideCounts(eq.left, formulaOf, n);
    const R = sideCounts(eq.right, formulaOf, n);
    const els = Array.from(new Set([...Object.keys(L.atoms), ...Object.keys(R.atoms)]));
    const ok = els.every((e) => (L.atoms[e] || 0) === (R.atoms[e] || 0)) && L.charge === R.charge;
    if (n === 1) res = { ok, left: L.atoms, right: R.atoms, lc: L.charge, rc: R.charge, elements: sortEls(els) };
    if (!ok) return { ...(res as BalanceResult), ok: false };
  }
  return res as BalanceResult;
}

export function sortEls(els: string[]): string[] {
  const order = ['C', 'H', 'O', 'N'];
  return els.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
}

/** Хилл жүйесі бойынша молекулалық формула (полимер үшін n=1 буын) */
export function hillFormula(cf: string): string {
  const { atoms, charge } = parseFormula(cf, 1);
  const els = Object.keys(atoms);
  const ordered = atoms.C ? ['C', 'H', ...els.filter((e) => e !== 'C' && e !== 'H').sort()] : els.sort();
  let s = ordered.filter((e) => atoms[e]).map((e) => e + (atoms[e] > 1 ? atoms[e] : '')).join('');
  if (/\)n$|\]n$/.test(cf.trim())) s = '(' + s + ')n';
  if (charge) s += '^' + (Math.abs(charge) > 1 ? Math.abs(charge) : '') + (charge > 0 ? '+' : '-');
  return s;
}

/** Іздеу үшін формуланы қалыпқа келтіру */
export function normFormula(s: string): string {
  return s
    .replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[–—−\-=≡()\[\]\s·^+]/g, '')
    .toLowerCase();
}
