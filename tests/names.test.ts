import { describe, it, expect } from 'vitest';
import { NAME_GROUPS, ALL_NAMES, ROOTS, BUILD_CLS, buildName } from '../src/data/names';
import { parseFormula } from '../src/lib/chem';

const atoms = (f: string) => parseFormula(f).atoms;

describe('Атаулар базасы', () => {
  it('формулалар талданады', () => {
    for (const x of ALL_NAMES) {
      if (x.f.includes('n)')) continue; // полимерлер
      const a = atoms(x.f);
      expect(a.C, `${x.sys}: ${x.f}`).toBeGreaterThan(0);
    }
  });

  it('жалпы формулаға сай: H = a·C + b', () => {
    for (const g of NAME_GROUPS) {
      if (!g.h) continue;
      const [k, b] = g.h;
      for (const x of g.items) {
        const a = atoms(x.f);
        expect(a.H, `${g.title}: ${x.sys} ${x.f}`).toBe(k * a.C + b);
      }
    }
  });

  it('тармақталмаған қатарларда түбір көміртек санына сай', () => {
    for (const g of NAME_GROUPS) {
      if (!g.rooted) continue;
      for (const x of g.items) {
        const c = atoms(x.f).C;
        const roots = c === 10 ? ['дек', 'дец'] : [ROOTS[c]];
        expect(roots.some((r) => x.sys.includes(r)), `${g.title}: ${x.sys} (C${c})`).toBe(true);
      }
    }
  });

  it('бір топта бірдей атау қайталанбайды', () => {
    for (const g of NAME_GROUPS) {
      const names = g.items.map((x) => x.sys);
      expect(new Set(names).size, g.title).toBe(names.length);
    }
  });

  it('PDF-тегі қателер түзетілген', () => {
    const by = (sys: string) => ALL_NAMES.find((x) => x.sys === sys);
    expect(by('2-аминопропан қышқылы')?.triv).toBe('аланин');
    expect(atoms(by('2-аминопропан қышқылы')!.f)).toEqual(atoms('C3H7NO2'));
    expect(by('2-метилбутадиен-1,3')?.triv).toBe('изопрен');
    expect(by('гексадиен-1,5')?.triv).toBe('диаллил');
    expect(ALL_NAMES.some((x) => x.f === 'C5H8' && x.sys.startsWith('пентен'))).toBe(false);
  });
});

describe('Атау құрастырғыш', () => {
  it('формуласы жалпы формулаға және кестеге сай', () => {
    for (const c of BUILD_CLS) {
      for (let n = c.min; n <= 10; n++) {
        const r = buildName(c.id, n);
        expect(r, `${c.id} ${n}`).toBeTruthy();
        expect(atoms(r!.f).C, `${c.id} ${n}: ${r!.f}`).toBe(n);
        const same = ALL_NAMES.find((x) => x.sys === r!.name);
        if (same) expect(atoms(same.f), `${r!.name}`).toEqual(atoms(r!.f));
      }
    }
  });

  it('кестедегі негізгі қатарлар құрастырғышпен табылады', () => {
    const found = (cls: Parameters<typeof buildName>[0], n: number, name: string) => expect(buildName(cls, n)?.name).toBe(name);
    found('alkane', 3, 'пропан');
    found('alkene', 4, 'бутен-1');
    found('alkyne', 2, 'этин');
    found('alcohol', 2, 'этанол');
    found('aldehyde', 1, 'метаналь');
    found('acid', 2, 'этан қышқылы');
    found('amine', 1, 'метиламин');
    found('cyclo', 6, 'циклогексан');
  });
});
