import { describe, it, expect } from 'vitest';
import { REACTIONS, RX, eqOf } from '../src/data/index';
import { SUB, SUBSTANCES, formulaOf } from '../src/data/substances';
import { TOPIC } from '../src/data/topics';
import { NAMED, NAMED_BY_ID } from '../src/data/named';
import { FIND_ERRORS, IDENTIFY } from '../src/data/exercises';
import { SCHOOL } from '../src/data/school';
import { METRO_STATIONS } from '../src/data/metro';
import { checkBalance, parseFormula } from '../src/lib/chem';

describe('Заттар', () => {
  it('id-лер бірегей', () => {
    const ids = SUBSTANCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Реакциялар', () => {
  it('id-лер бірегей', () => {
    const ids = REACTIONS.map((r) => r.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    expect(dup).toEqual([]);
  });

  it('барлық теңдеулер атомдар мен зарядтар бойынша теңестірілген', () => {
    const bad: string[] = [];
    for (const r of REACTIONS) {
      const e = eqOf(r);
      if (!e) { expect(r.scheme, r.id + ': теңдеу де, схема да жоқ').toBeTruthy(); continue; }
      for (const t of [...e.left, ...e.right]) expect(SUB[t.id], `${r.id}: белгісіз зат ${t.id}`).toBeTruthy();
      const b = checkBalance(e, formulaOf);
      if (!b.ok) bad.push(`${r.id}: L=${JSON.stringify(b.left)} R=${JSON.stringify(b.right)} q=${b.lc}/${b.rc}`);
    }
    expect(bad).toEqual([]);
  });

  it('тақырып, бөлім, атаулы реакция, ереже және «тұзақ» сілтемелері дұрыс', () => {
    for (const r of REACTIONS) {
      expect(r.at.length, r.id).toBeGreaterThan(0);
      for (const a of r.at) {
        const [t, s] = a.split(':');
        expect(TOPIC[t], `${r.id}: тақырып ${t}`).toBeTruthy();
        expect(['get', 'prop']).toContain(s);
      }
      if (r.nm) expect(NAMED_BY_ID[r.nm], `${r.id}: ${r.nm}`).toBeTruthy();
      if (r.rule) expect(NAMED_BY_ID[r.rule], `${r.id}: ${r.rule}`).toBeTruthy();
      for (const t of r.trap ?? []) expect(SUB[t], `${r.id}: trap ${t}`).toBeTruthy();
      if (r.st === 'fix' || r.st === 'check') expect(r.n, `${r.id}: түзету/күмән ескертпесі керек`).toBeTruthy();
      if (r.src > 0) expect(r.src).toBeLessThanOrEqual(24);
    }
  });

  it('«тұзақ» өнім дұрыс өніммен бірдей емес, бірақ изомер не жақын зат', () => {
    for (const r of REACTIONS) {
      const e = eqOf(r);
      for (const t of r.trap ?? []) expect(e!.right.map((x) => x.id)).not.toContain(t);
    }
  });

  it('PDF-тегі әр тақырып реакцияларсыз қалмаған', () => {
    const topics = Object.keys(TOPIC);
    for (const t of topics) {
      const n = REACTIONS.filter((r) => r.at.some((a) => a.startsWith(t + ':'))).length;
      expect(n, t).toBeGreaterThan(0);
    }
  });
});

describe('Атаулы реакциялар', () => {
  it('мысал реакциялары базада бар және жаттығу жауабы дұрыс индексте', () => {
    for (const n of NAMED) {
      for (const ex of n.examples) expect(RX[ex], `${n.id}: ${ex}`).toBeTruthy();
      expect(n.quiz.answer).toBeLessThan(n.quiz.options.length);
    }
  });
  it('мысал реакциялары сол атаулы реакцияға/ережеге сілтейді', () => {
    for (const n of NAMED) for (const ex of n.examples) expect([RX[ex].nm, RX[ex].rule], `${n.id}: ${ex}`).toContain(n.id);
  });
});

describe('Жаттығулар', () => {
  it('«Қатені тап»: қате бөлік оператор емес, сілтемелер бар', () => {
    for (const f of FIND_ERRORS) {
      if (f.bad === 'cond') expect(f.cond, f.id).toBeTruthy();
      else expect(['+', '→']).not.toContain(f.parts[f.bad]);
      if (f.rid) expect(RX[f.rid], f.id).toBeTruthy();
    }
  });
  it('«Затты анықта»: жауап нұсқалардың ішінде, заттар бар', () => {
    for (const q of IDENTIFY) {
      expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(SUB[o], `${q.id}: ${o}`).toBeTruthy();
      for (const r of q.rids ?? []) expect(RX[r], `${q.id}: ${r}`).toBeTruthy();
    }
  });
});

describe('Мектеп базасы және метро', () => {
  it('генетикалық тізбектердің әр қадамы нақты реакцияға сәйкес', () => {
    for (const sec of SCHOOL) for (const b of sec.blocks) {
      for (const l of b.links ?? []) expect(RX[l], `${sec.id}: ${l}`).toBeTruthy();
      if (!b.chain) continue;
      for (let i = 0; i < b.chain.length - 1; i++) {
        const st = b.chain[i], next = b.chain[i + 1];
        const e = eqOf(RX[st.r!])!;
        expect(e.left.map((t) => t.id), `${st.r}: ${st.s}`).toContain(st.s);
        expect(e.right.map((t) => t.id), `${st.r}: ${next.s}`).toContain(next.s);
      }
    }
  });
  it('метро станциялары базада бар және орындары қайталанбайды', () => {
    const pos = new Set<string>();
    for (const [id, c, r] of METRO_STATIONS) {
      expect(SUB[id], id).toBeTruthy();
      const k = `${c}:${r}`;
      expect(pos.has(k), `${id} ${k}`).toBe(false);
      pos.add(k);
    }
  });
});

describe('Формула талдауы', () => {
  it('күрделі формулалар', () => {
    expect(parseFormula('C3H5(C17H35COO)3').atoms).toEqual({ C: 57, H: 110, O: 6 });
    expect(parseFormula('[Ag(NH3)2]OH').atoms).toEqual({ Ag: 1, N: 2, H: 7, O: 1 });
    expect(parseFormula('(C2H4)n', 3).atoms).toEqual({ C: 6, H: 12 });
    expect(parseFormula('KMnO4').atoms).toEqual({ K: 1, Mn: 1, O: 4 });
    expect(parseFormula('CH3COO^-').charge).toBe(-1);
  });
});
