import { describe, it, expect } from 'vitest';
import { DECKS, ALL_CARDS } from '../src/data/cards';
import { ALL_NAMES } from '../src/data/names';
import { NAMED } from '../src/data/named';
import { parentOf } from '../src/components/ui';

describe('Флэш-карталар', () => {
  it('карта id-лері бірегей', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    expect(dup).toEqual([]);
  });

  it('әр колодада карта бар, беттері бос емес', () => {
    for (const d of DECKS) {
      expect(d.cards.length, d.id).toBeGreaterThan(4);
      for (const c of d.cards) { expect(c.front.trim(), c.id).not.toBe(''); expect(c.back.trim(), c.id).not.toBe(''); }
    }
  });

  it('барлық атаулар мен атаулы реакциялар картаға айналды', () => {
    const names = DECKS.filter((d) => d.id.startsWith('names')).reduce((n, d) => n + d.cards.length, 0);
    expect(names).toBe(ALL_NAMES.length);
    expect(DECKS.find((d) => d.id === 'named')!.cards.length).toBe(NAMED.length);
  });
});

describe('«Артқа» түймесі', () => {
  it('тікелей кірген беттен бөлімнің негізгі бетіне апарады', () => {
    expect(parentOf('r-ethene-br2')).toBe('lib');
    expect(parentOf('t-alkanes')).toBe('lib');
    expect(parentOf('s-valence')).toBe('school');
    expect(parentOf('n-wurtz')).toBe('named');
    expect(parentOf('p-product')).toBe('practice');
    expect(parentOf('names-hc')).toBe('names');
    expect(parentOf('cards-qual')).toBe('cards');
    expect(parentOf('lab-ethene')).toBe('lab');
    expect(parentOf('guide')).toBe('');
  });
});
