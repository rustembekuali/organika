import { describe, it, expect } from 'vitest';
import { guideSteps } from '../src/pages/Guide';
import type { Progress } from '../src/lib/store';

const base = (): Progress => ({ viewed: {}, topics: {}, favorites: [], results: {}, history: [], review: [], theme: 'auto', motion: 'auto', formula: 'sf', custom: [] });

describe('Оқу жолы', () => {
  it('жаңа оқушыда бірде-бір қадам орындалмаған', () => {
    expect(guideSteps(base()).filter((s) => s.done)).toEqual([]);
  });

  it('қадамдар прогресс бойынша белгіленеді', () => {
    const p = base();
    p.names = { best: { hc: 8, o: 7 }, rounds: 3, learned: [] };
    p.viewed = { 'ch4-cl2-1': 1, 'methane-combustion': 1, 'ethene-h2': 1 };
    p.labRuns = ['ethene-br2', 'ethyne-h2', 'ch4-cl2-1', 'ethanol-na'];
    const st = Object.fromEntries(guideSteps(p).map((s) => [s.id, s.done]));
    expect(st).toEqual({ rules: true, 'hc-names': true, see: true, 'lab-hc': true, 'o-names': false, 'lab-o': true, check: false });
  });

  it('әр қадамның сілтемесі бар маршрутқа апарады', () => {
    const ok = /^(names|names-(hc|o)|t-[a-z_]+|lab-[a-z0-9]+|p-product)$/;
    for (const s of guideSteps(base())) expect(s.to, s.id).toMatch(ok);
  });
});
