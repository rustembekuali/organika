import { describe, it, expect } from 'vitest';
import scenes from '../src/data/generated/scenes.json';
import { REACTIONS, RX } from '../src/data/index';

type St = [number, number, number, number, number, string | null, number];
interface SAtom { e: string; a: St | null; b: St | null; n?: number; f?: number; t?: number }
const S = scenes as unknown as Record<string, { atoms: SAtom[]; bA: number[][]; bB: number[][]; pA: unknown[]; pB: unknown[] }>;

describe('Анимация сахналары', () => {
  it('сахналар базадағы реакцияларға сілтейді және көпшілігін қамтиды', () => {
    for (const id of Object.keys(S)) expect(RX[id], id).toBeTruthy();
    expect(Object.keys(S).length).toBeGreaterThan(REACTIONS.length * 0.85);
  });
  it('байланыстар бар атомдарға сілтейді, таблетка индекстері дұрыс', () => {
    for (const [id, sc] of Object.entries(S)) {
      for (const b of [...sc.bA, ...sc.bB]) { expect(sc.atoms[b[0]], id).toBeTruthy(); expect(sc.atoms[b[1]], id).toBeTruthy(); }
      for (const a of sc.atoms) {
        expect(a.a || a.b, id).toBeTruthy();
        if (a.t !== undefined && a.t >= 0) expect(a.t).toBeLessThan(sc.pB.length);
        if (a.f !== undefined && a.f >= 0) expect(a.f).toBeLessThan(sc.pA.length);
      }
      // A кадрының байланыстары тек A-да бар атомдарды, B кадрыныкі тек B-дағы атомдарды байланыстырады
      for (const b of sc.bA) expect(!!sc.atoms[b[0]].a && !!sc.atoms[b[1]].a, id).toBe(true);
      for (const b of sc.bB) expect(!!sc.atoms[b[0]].b && !!sc.atoms[b[1]].b, id).toBe(true);
    }
  });
  it('этерификацияда қышқылдың OH тобы суға кетеді, эфирлік O спирттен келеді', () => {
    const sc = S['esterification-ethyl-acetate'];
    const key = (b: number[]) => [b[0], b[1]].sort().join();
    const A = new Set(sc.bA.map(key)), B = new Set(sc.bB.map(key));
    const formed = sc.bB.filter((b) => !A.has(key(b)));
    const broken = sc.bA.filter((b) => !B.has(key(b)));
    expect(formed.length).toBe(1);
    expect(broken.length).toBe(1);
    // үзілген: қышқылдың C–OH; түзілген: сол көміртек пен спирт оттегі
    const c = broken[0].find((i) => sc.atoms[i].e === 'C')!;
    expect(formed[0]).toContain(c);
    const oNew = formed[0].find((i) => i !== c)!;
    const oOld = broken[0].find((i) => i !== c)!;
    expect(sc.atoms[oNew].e).toBe('O');
    expect(sc.atoms[oOld].b![6]).toBe(0); // кеткен оттек — жалғыз су молекуласы
  });
  it('спирттік ашу: CH₃ топтары C1/C6-дан, CO₂ көміртектері C3/C4-тен (видеодағыдай)', () => {
    const sc = S['glucose-alcoholic'];
    const byN = (n: number) => sc.atoms.find((a) => a.n === n)!;
    for (const n of [3, 4]) expect(byN(n).b![2]).toBe(0); // CO₂ көміртегінде сутек жоқ
    for (const n of [1, 6]) expect(byN(n).b![2]).toBe(3); // CH₃
  });
});
