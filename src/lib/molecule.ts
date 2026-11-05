// 2D молекула конструкторының деректер моделі және химиялық есептері
export type ElementSymbol = 'C' | 'H' | 'O' | 'N' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I';
export type BondOrder = 1 | 2 | 3;

export interface SketchAtom {
  id: string;
  element: ElementSymbol;
  x: number;
  y: number;
}

export interface SketchBond {
  id: string;
  a: string;
  b: string;
  order: BondOrder;
}

export interface SketchMolecule {
  id: string;
  name: string;
  atoms: SketchAtom[];
  bonds: SketchBond[];
}

export interface SketchReaction {
  id: string;
  title: string;
  condition: string;
  left: SketchMolecule[];
  right: SketchMolecule[];
  ts: number;
}

export const ELEMENTS: ElementSymbol[] = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I'];
export const ELEMENT_COLORS: Record<ElementSymbol, string> = {
  C: '#34443e', H: '#7c8a84', O: '#e45c63', N: '#4677d4', S: '#d3a72e',
  P: '#e18b39', F: '#55a879', Cl: '#3f9b68', Br: '#a75c3d', I: '#8264ad',
};

export const uid = (prefix = 'm') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const cloneMolecule = (m: SketchMolecule): SketchMolecule => JSON.parse(JSON.stringify(m)) as SketchMolecule;

export function emptyMolecule(name = 'Жаңа молекула'): SketchMolecule {
  return { id: uid('mol'), name, atoms: [], bonds: [] };
}

function molecule(name: string, atoms: [ElementSymbol, number, number][], bonds: [number, number, BondOrder][] = []): SketchMolecule {
  const ids = atoms.map(() => uid('a'));
  return {
    id: uid('mol'), name,
    atoms: atoms.map(([element, x, y], i) => ({ id: ids[i], element, x, y })),
    bonds: bonds.map(([a, b, order]) => ({ id: uid('b'), a: ids[a], b: ids[b], order })),
  };
}

export const MOLECULE_TEMPLATES: { id: string; name: string; make: () => SketchMolecule }[] = [
  { id: 'methane', name: 'Метан', make: () => molecule('Метан', [['C', 360, 220]]) },
  { id: 'ethane', name: 'Этан', make: () => molecule('Этан', [['C', 300, 220], ['C', 420, 220]], [[0, 1, 1]]) },
  { id: 'ethene', name: 'Этилен', make: () => molecule('Этилен', [['C', 300, 220], ['C', 420, 220]], [[0, 1, 2]]) },
  { id: 'ethanol', name: 'Этанол', make: () => molecule('Этанол', [['C', 250, 220], ['C', 360, 220], ['O', 470, 220]], [[0, 1, 1], [1, 2, 1]]) },
  { id: 'water', name: 'Су', make: () => molecule('Су', [['O', 360, 220]]) },
  { id: 'chlorine', name: 'Хлор', make: () => molecule('Хлор', [['Cl', 300, 220], ['Cl', 420, 220]], [[0, 1, 1]]) },
  { id: 'hydrogen', name: 'Сутек', make: () => molecule('Сутек', [['H', 300, 220], ['H', 420, 220]], [[0, 1, 1]]) },
  {
    id: 'benzene', name: 'Бензол', make: () => {
      const atoms: [ElementSymbol, number, number][] = Array.from({ length: 6 }, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 3;
        return ['C', 360 + Math.cos(angle) * 105, 220 + Math.sin(angle) * 105];
      });
      return molecule('Бензол', atoms, Array.from({ length: 6 }, (_, i) => [i, (i + 1) % 6, i % 2 === 0 ? 2 : 1] as [number, number, BondOrder]));
    },
  },
];

const VALENCE: Record<ElementSymbol, number> = { C: 4, H: 1, O: 2, N: 3, S: 2, P: 3, F: 1, Cl: 1, Br: 1, I: 1 };
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

export function subscriptFormula(formula: string) {
  return formula.replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]);
}

export function implicitHydrogens(m: SketchMolecule, atom: SketchAtom): number {
  if (atom.element === 'H') return 0;
  const used = m.bonds.reduce((sum, bond) => sum + (bond.a === atom.id || bond.b === atom.id ? bond.order : 0), 0);
  return Math.max(0, Math.round(VALENCE[atom.element] - used));
}

export function atomCounts(m: SketchMolecule): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of m.atoms) counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  for (const atom of m.atoms) {
    const implicit = implicitHydrogens(m, atom);
    if (implicit) counts.H = (counts.H ?? 0) + implicit;
  }
  return counts;
}

export function moleculeFormula(m: SketchMolecule): string {
  if (!m.atoms.length) return '—';
  const counts = atomCounts(m);
  const order = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return b === 'C' ? 1 : -1;
    if (b === 'H') return a === 'C' ? -1 : 1;
    return a.localeCompare(b);
  });
  return order.map((el) => el + (counts[el] === 1 ? '' : counts[el])).join('');
}

export function reactionCounts(molecules: SketchMolecule[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of molecules) {
    const counts = atomCounts(m);
    for (const [el, n] of Object.entries(counts)) out[el] = (out[el] ?? 0) + n;
  }
  return out;
}

export function reactionBalance(left: SketchMolecule[], right: SketchMolecule[]) {
  const l = reactionCounts(left), r = reactionCounts(right);
  const elements = [...new Set([...Object.keys(l), ...Object.keys(r)])].sort();
  return { left: l, right: r, elements, ok: left.some((m) => m.atoms.length > 0) && right.some((m) => m.atoms.length > 0) && elements.every((el) => l[el] === r[el]) };
}

export function moleculeSvg(m: SketchMolecule): string {
  const atoms = new Map(m.atoms.map((a) => [a.id, a]));
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
  const bonds = m.bonds.map((bond) => {
    const a = atoms.get(bond.a), b = atoms.get(bond.b);
    if (!a || !b) return '';
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-4, 4] : [-6, 0, 6];
    return offsets.map((o) => `<line x1="${a.x + nx * o}" y1="${a.y + ny * o}" x2="${b.x + nx * o}" y2="${b.y + ny * o}" stroke="#54645d" stroke-width="3" stroke-linecap="round"/>`).join('');
  }).join('');
  const labels = m.atoms.map((a) => `<g><circle cx="${a.x}" cy="${a.y}" r="19" fill="#f8faf7"/><text x="${a.x}" y="${a.y + 6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="${ELEMENT_COLORS[a.element]}">${a.element}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440"><rect width="720" height="440" rx="20" fill="#f8faf7"/><text x="24" y="34" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#20332b">${esc(m.name)} · ${subscriptFormula(moleculeFormula(m))}</text>${bonds}${labels}</svg>`;
}
