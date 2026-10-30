// Барлық деректерді біріктіру және көмекші іздеу кестелері
import type { Reaction, ParsedEq } from './types';
import { HYDROCARBONS } from './reactions/hydrocarbons';
import { OXYGEN } from './reactions/oxygen';
import { NITROGEN_CARBS } from './reactions/nitrogen_carbs';
import { SUB } from './substances';
import { parseEq } from '../lib/chem';

export const REACTIONS: Reaction[] = [...HYDROCARBONS, ...OXYGEN, ...NITROGEN_CARBS];
export const RX: Record<string, Reaction> = Object.fromEntries(REACTIONS.map((r) => [r.id, r]));

const eqCache: Record<string, ParsedEq | null> = {};
export function eqOf(r: Reaction): ParsedEq | null {
  if (!(r.id in eqCache)) eqCache[r.id] = r.eq ? parseEq(r.eq) : null;
  return eqCache[r.id];
}

export const isOrganic = (id: string) => SUB[id] && SUB[id].cls !== 'inorg';

/** Реакцияның органикалық реагенттері мен өнімдері */
export function organicSides(r: Reaction) {
  const e = eqOf(r);
  if (!e) return { from: [] as string[], to: [] as string[] };
  return { from: e.left.map((t) => t.id).filter(isOrganic), to: e.right.map((t) => t.id).filter(isOrganic) };
}

/** Зат қатысатын реакциялар */
export const BY_SUBSTANCE: Record<string, { asReactant: string[]; asProduct: string[] }> = {};
for (const r of REACTIONS) {
  const e = eqOf(r);
  if (!e) continue;
  for (const t of e.left) (BY_SUBSTANCE[t.id] ??= { asReactant: [], asProduct: [] }).asReactant.push(r.id);
  for (const t of e.right) (BY_SUBSTANCE[t.id] ??= { asReactant: [], asProduct: [] }).asProduct.push(r.id);
}

/** Тақырып → бөлім → реакциялар */
export function reactionsOf(topic: string, section?: 'get' | 'prop' | 'qual') {
  return REACTIONS.filter((r) =>
    r.at.some((a) => {
      const [t, s] = a.split(':');
      if (t !== topic) return false;
      if (!section) return true;
      if (section === 'qual') return !!r.q && s === 'prop';
      if (section === 'get') return s === 'get';
      return s === 'prop' && !r.q;
    }),
  );
}

/** Жаттығу мен метроға жарамды ма: күмәнді жазбалар шығарылады */
export const usable = (r: Reaction) => r.st !== 'check';
