import { describe, expect, it } from 'vitest';
import { MOLECULE_TEMPLATES, atomCounts, moleculeFormula, moleculeSvg, reactionBalance, subscriptFormula } from '../src/lib/molecule';

const template = (id: string) => {
  const item = MOLECULE_TEMPLATES.find((t) => t.id === id);
  if (!item) throw new Error(`Шаблон жоқ: ${id}`);
  return item.make();
};

describe('Молекула конструкторы', () => {
  it('жалпы формулаларды жасырын сутекпен дұрыс есептейді', () => {
    expect(moleculeFormula(template('methane'))).toBe('CH4');
    expect(moleculeFormula(template('ethene'))).toBe('C2H4');
    expect(moleculeFormula(template('ethanol'))).toBe('C2H6O');
    expect(moleculeFormula(template('benzene'))).toBe('C6H6');
    expect(moleculeFormula(template('water'))).toBe('H2O');
    expect(moleculeFormula(template('chlorine'))).toBe('Cl2');
  });

  it('этиленді гидраттау балансын дұрыс деп танйды', () => {
    const result = reactionBalance([template('ethene'), template('water')], [template('ethanol')]);
    expect(result.ok).toBe(true);
    expect(result.left).toEqual({ C: 2, H: 6, O: 1 });
  });

  it('теңестірілмеген реакцияны анықтайды', () => {
    expect(reactionBalance([template('ethene')], [template('ethanol')]).ok).toBe(false);
    expect(reactionBalance([], []).ok).toBe(false);
  });

  it('әр шаблонның атом мен байланыс идентификаторлары бірегей', () => {
    const mol = template('benzene');
    expect(new Set(mol.atoms.map((a) => a.id)).size).toBe(6);
    expect(new Set(mol.bonds.map((b) => b.id)).size).toBe(6);
    expect(atomCounts(mol).H).toBe(6);
  });

  it('SVG экспорты молекула атауын және атомдарын қамтиды', () => {
    const svg = moleculeSvg(template('ethanol'));
    expect(svg).toContain('<svg');
    expect(svg).toContain('Этанол');
    expect(svg).toContain('C₂H₆O');
    expect(subscriptFormula('C6H6')).toBe('C₆H₆');
  });
});
