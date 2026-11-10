import React from 'react';
import { REACTIONS } from '../data/index';
import { ALL_NAMES } from '../data/names';
import { useProgress, type Progress } from '../lib/store';
import { A, Icon, LearnTabs } from '../components/ui';
import { F } from '../lib/format';

/**
 * Оқу жолы: жаңа оқушыны атауларды жаттаудан бастап, реакцияны өзі құруға дейін қадаммен жүргізетін нұсқаулық.
 * Әр қадамның орындалғаны прогресс бойынша автоматты анықталады.
 */
export interface GuideStep {
  id: string;
  title: string;
  why: string;
  todo: string[];
  to: string;
  cta: string;
  done: boolean;
  /** Қадамның қазіргі көрсеткіші, мысалы «6/10» */
  meter?: { v: number; max: number; label: string };
}

const PASS = 8; // атау жаттығуынан өту шегі (10-нан)
const isBase = (id: string, topics: string[]) => REACTIONS.some((r) => r.id === id && r.lv === 'base' && r.at.some((a) => topics.includes(a.split(':')[0])));

export function guideSteps(p: Progress): GuideStep[] {
  const best = p.names?.best ?? {};
  const rounds = p.names?.rounds ?? 0;
  const runs = p.labRuns ?? [];
  const seenHc = Object.keys(p.viewed).filter((id) => isBase(id, ['alkanes', 'alkenes', 'alkynes'])).length;
  const hcRuns = runs.filter((r) => !r.startsWith('ethanol')).length;
  const ethanolRuns = runs.filter((r) => r.startsWith('ethanol')).length;
  const product = p.results.product ?? { ok: 0, total: 0 };
  const hcBest = Math.max(best.hc ?? 0, best.all ?? 0);
  const oBest = Math.max(best.o ?? 0);
  return [
    {
      id: 'rules', title: 'Атау қалай құрылатынын түсін',
      why: 'Атаудың түбірі көміртек санын, жұрнағы класты көрсетеді. Осыны білсең, атауларды жаттамай-ақ құрастырасың.',
      todo: [
        'Түбірлер кестесін оқы: мет- (1), эт- (2), проп- (3), бут- (4), пент- (5) … дек- (10).',
        'Жұрнақтарды есте сақта: -ан — алкан, -ен — алкен, -ин — алкин, -ол — спирт, -аль — альдегид.',
        'Құрастырғышта 3 мысал жаса: C3 + алкан = пропан, C3 + алкен = пропен, C2 + спирт = этанол.',
        'Беттің төменгі жағындағы «Өзіңді тексер» бөлімінде бір раунд өт — бұл қадам сонда белгіленеді.',
      ],
      to: 'names', cta: 'Атаулар бетін ашу', done: rounds > 0,
    },
    {
      id: 'hc-names', title: 'Көмірсутектердің атауларын жатта',
      why: 'Реакцияда заттың атын білмесең, теңдеуді оқу қиын. Алдымен ең қарапайым класс — көмірсутектер.',
      todo: [
        '«Көмірсутектер» сүзгісі мен «Формула → атау» режимін таңда.',
        '10 сұраққа жауап бер. Қате жауаптан кейін түсіндірмені оқы: қай түбір, қай жұрнақ.',
        `${PASS}/10 жинағанша қайтала. Сосын «Атау → формула» режимінде де байқап көр.`,
        'Жаттау үшін «Көмірсутектердің атаулары» флэш-карталарын да қолдан: «Жаттығу → Флэш-карталар».',
      ],
      to: 'names-hc', cta: 'Жаттығуды бастау', done: hcBest >= PASS,
      meter: { v: hcBest, max: 10, label: `Ең жақсы нәтиже: ${hcBest}/10` },
    },
    {
      id: 'see', title: 'Алғашқы реакцияларды көріп ал',
      why: 'Атауларды білгеннен кейін заттардың бір-біріне қалай айналатынын көр: қай байланыс үзіледі, қайсысы түзіледі.',
      todo: [
        '«Алкандар» тақырыбын аш — алдымен тек оңай (базалық) реакциялар көрсетіледі.',
        'Кемінде 3 реакцияны ашып, анимацияны соңына дейін қара. Әр заттың атауын дауыстап айт.',
        'Теңдеудегі өнімнің атауын түбір мен жұрнақ арқылы тексер: CH3Cl — хлор + мет + ан = хлорметан.',
      ],
      to: 't-alkanes', cta: 'Алкандарды ашу', done: seenHc >= 3,
      meter: { v: Math.min(seenHc, 3), max: 3, label: `Қаралған оңай реакциялар: ${Math.min(seenHc, 3)}/3` },
    },
    {
      id: 'lab-hc', title: 'Зертханада реакцияны өзің құр',
      why: 'Енді реакцияны өзің жүргіз: затты таңда, реагент қос, атомдардың қалай қайта топтасатынын бақыла.',
      todo: [
        '1) Негізгі зат ретінде этиленді таңда. 2) Реагент ретінде бром суын (Br2) қос. 3) «Реакцияны жүргізу» батырмасын бас.',
        'Өнімнің атауын айт: 1,2-дибромэтан — «эт» (2 көміртек) + «ан» және екі бром атомы.',
        'Тағы екі тәжірибе жаса: ацетилен + H2 және метан + Cl2. Әрқайсысында бастапқы зат пен өнімнің атауын жаз.',
      ],
      to: 'lab-ethene', cta: 'Зертханаға өту', done: hcRuns >= 3,
      meter: { v: Math.min(hcRuns, 3), max: 3, label: `Жүргізілген тәжірибелер: ${Math.min(hcRuns, 3)}/3` },
    },
    {
      id: 'o-names', title: 'Оттекті қосылыстардың атауларын жатта',
      why: 'Спирт, альдегид, қышқыл атаулары алканның атауынан құралады: этан → этанол → этаналь → этан қышқылы.',
      todo: [
        '«Оттекті» сүзгісін таңда. Жұрнақтарға назар аудар: -ол, -аль, -он, «… қышқылы».',
        'Тривиал атауларды да біл: сірке қышқылы, формальдегид, глицерин.',
        `${PASS}/10 жинағанша қайтала.`,
      ],
      to: 'names-o', cta: 'Жаттығуды бастау', done: oBest >= PASS,
      meter: { v: oBest, max: 10, label: `Ең жақсы нәтиже: ${oBest}/10` },
    },
    {
      id: 'lab-o', title: 'Спирттің реакцияларын жүргіз',
      why: 'Оттекті қосылыстардың атауларын реакцияда қолдан: этанолдан не түзіледі?',
      todo: [
        'Зертханада негізгі зат ретінде этанолды таңда.',
        'Натриймен, HCl-мен немесе CuO-мен реакцияны жүргіз. Өнімнің атауын айт: натрий этилаты, хлорэтан, этаналь.',
      ],
      to: 'lab-ethanol', cta: 'Зертханаға өту', done: ethanolRuns >= 1,
      meter: { v: Math.min(ethanolRuns, 1), max: 1, label: ethanolRuns ? 'Тәжірибе жасалды' : 'Әлі тәжірибе жоқ' },
    },
    {
      id: 'check', title: 'Өзіңді тексер: өнімді тап',
      why: 'Соңғы қадам — реакция өнімін өзің болжау. Мұнда атауларды да, реакцияларды да қатар қолданасың.',
      todo: [
        '«Өнімді тап» жаттығуында 10 сұраққа жауап бер.',
        'Қате кеткен реакциялар қайталау тізіміне түседі — оларды келесі күні қайта шеш.',
      ],
      to: 'p-product', cta: 'Жаттығуды ашу', done: product.total >= 10,
      meter: { v: Math.min(product.total, 10), max: 10, label: `Жауап берілді: ${Math.min(product.total, 10)}/10 (дұрыс: ${product.ok})` },
    },
  ];
}

export function GuidePage() {
  const prog = useProgress();
  const steps = guideSteps(prog);
  const done = steps.filter((s) => s.done).length;
  const cur = steps.findIndex((s) => !s.done);
  const learned = prog.names?.learned.length ?? 0;
  return (
    <div className="page guide">
      <LearnTabs on="guide" />
      <header className="phead">
        <h1>Оқу жолы</h1>
        <p className="lead">Органиканы нөлден бастайтын оқушыға арналған қадамдық нұсқаулық: алдымен атауларды үйренесің, сосын реакцияларды көресің, ең соңында зертханада реакцияны өзің құрасың. Әр қадамның орындалғаны автоматты түрде белгіленеді.</p>
      </header>

      <section className="card guide-sum">
        <div className="gs-num"><b>{done}</b>/{steps.length}</div>
        <div className="gs-main">
          <div className="meter-b"><span style={{ width: `${(done / steps.length) * 100}%` }} /></div>
          <div className="muted small">{cur < 0 ? 'Барлық қадам орындалды. Енді «Үйрену» бөліміндегі басқа тақырыптарға өт.' : <>Келесі қадам: <b>{steps[cur].title}</b></>} · Дұрыс табылған атаулар: {learned}/{ALL_NAMES.length}</div>
        </div>
        {cur >= 0 && <A to={steps[cur].to} className="cut-btn"><span>{steps[cur].cta}</span><svg className="cut-arrow" viewBox="0 0 14 11" aria-hidden><path d="M0 5.5H13M8 .5l5 5-5 5" fill="none" stroke="currentColor" /></svg></A>}
      </section>

      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={s.id} className={'card guide-step' + (s.done ? ' done' : i === cur ? ' current' : '')}>
            <div className="gst-head">
              <span className="gst-n" aria-hidden>{s.done ? '✓' : i + 1}</span>
              <div>
                <h2 className="h-card">{s.title}</h2>
                <span className="gst-state">{s.done ? 'Орындалды' : i === cur ? 'Қазіргі қадам' : 'Кейін'}</span>
              </div>
            </div>
            <p className="muted">{s.why}</p>
            <ol className="gst-todo">{s.todo.map((t, k) => <li key={k}><F s={t} /></li>)}</ol>
            {s.meter && (
              <div className="meter">
                <div className="meter-l"><span>{s.meter.label}</span></div>
                <div className="meter-b"><span style={{ width: `${(s.meter.v / s.meter.max) * 100}%` }} /></div>
              </div>
            )}
            <A to={s.to} className={'btn' + (s.done ? ' ghost' : '')}>{s.done ? 'Қайталау' : s.cta} <Icon n="arrow" size={16} /></A>
          </li>
        ))}
      </ol>

      <section className="card teacher-note">
        <h2 className="h-card">Мұғалімге</h2>
        <ul>
          <li>Оқушыға осы беттің сілтемесін жіберіңіз: <code>{location.origin + location.pathname}#guide</code>. Әр қадамның өз сілтемесі бар, мысалы атау жаттығуы — <code>#names-hc</code>, зертхана — <code>#lab-ethene</code>.</li>
          <li>Прогресс оқушының өз құрылғысында сақталады, тіркелу қажет емес. Нәтижені көру үшін оқушы «Профиль» бетінен прогресс кодын көшіріп жібере алады.</li>
          <li>Ұсынылатын ырғақ: бір сабақта 1–2 қадам. Атау жаттығуында {PASS}/10 жинамай, келесі қадамға асықпаған жөн.</li>
        </ul>
      </section>
    </div>
  );
}
