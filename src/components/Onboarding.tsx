import React, { useEffect, useRef, useState } from 'react';
import { update, useProgress } from '../lib/store';
import { Icon, go } from './ui';
import { REACTIONS } from '../data/index';
import { SUBSTANCES } from '../data/substances';
import { TOPICS } from '../data/topics';

/** Алғаш кірген адамға сайтты таныстыратын қысқа нұсқаулық (5 слайд). Кейін төменгі жақтағы сілтемеден қайта ашылады. */
const SLIDES: { ic: string; title: string; text: string; points: string[] }[] = [
  {
    ic: 'home', title: 'Органикаға қош келдің!',
    text: 'Бұл — органикалық химияны қазақ тілінде үйренуге арналған сайт: 9–11-сынып, ҰБТ және мұғалімдер үшін. Тіркелу қажет емес, прогресің осы құрылғыда сақталады.',
    points: [`${REACTIONS.length} реакция, ${SUBSTANCES.length} зат, ${TOPICS.length} тақырып`, 'Атомдар қозғалатын анимациялар', 'Атаулар, флэш-карталар, жаттығулар'],
  },
  {
    ic: 'book', title: 'Үйрену',
    text: 'Жоғарғы мәзірдегі «Үйрену» бөлімінде бәрі бар. Әр бетте сол жақ жоғарыда «Артқа» түймесі тұрады.',
    points: ['Тақырыптар — алкандардан нәруыздарға дейін', 'Атаулар — түбір + жұрнақ ережесі және құрастырғыш', 'Негіздер мен атаулы реакциялар'],
  },
  {
    ic: 'cards', title: 'Флэш-карталар мен жаттығу',
    text: 'Атауларды, сапалық реакцияларды және атаулы реакцияларды карталармен жатта: картаны бас — жауабы шығады. Білмеген картаң кейін қайта келеді.',
    points: ['«Жаттығу» мәзірінде — флэш-карталар', 'Өнімді тап, реагентті таңда, қатені тап', 'Қате жауаптар қайталау тізіміне түседі'],
  },
  {
    ic: 'flask', title: 'Зертхана және карта',
    text: 'Зертханада реакцияны өзің жүргіз: затты таңда, реагент қос, атомдардың қалай жылжитынын көр. Картада бір заттан екіншісіне апаратын жолды тап.',
    points: ['2D оқу зертханасы — 16 тәжірибе', 'Молекула конструкторы (2D / 3D)', 'Реакциялар картасы және жол іздеу'],
  },
  {
    ic: 'target', title: 'Неден бастаймын?',
    text: 'Жаңадан бастасаң, «Оқу жолы» нұсқаулығымен жүр: алдымен атауларды үйренесің, сосын реакцияларды көресің, ең соңында зертханада реакцияны өзің құрасың.',
    points: ['7 қадам, әрқайсысы өздігінен белгіленеді', 'Бір сабаққа 1–2 қадам жеткілікті', 'Бұл нұсқаулықты төменгі жақтан қайта ашуға болады'],
  },
];

export function Onboarding() {
  const prog = useProgress();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const open = !prog.onboarded;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setI(0); d.showModal(); (d.querySelector('.onb-actions .btn:last-child') as HTMLElement | null)?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);

  const finish = (to?: string) => { update((p) => { p.onboarded = true; }); if (to !== undefined) go(to); };
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <dialog ref={ref} className="onboard" aria-labelledby="onb-title" onCancel={(e) => { e.preventDefault(); finish(); }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' && !last) setI(i + 1); if (e.key === 'ArrowLeft' && i > 0) setI(i - 1); }}>
      <button className="onb-skip" onClick={() => finish()}>Өткізіп жіберу</button>
      <div className="onb-body" key={i}>
        <span className="onb-ic" aria-hidden><Icon n={s.ic} size={34} /></span>
        <div className="onb-step">{i + 1} / {SLIDES.length}</div>
        <h2 id="onb-title">{s.title}</h2>
        <p>{s.text}</p>
        <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      <div className="onb-dots" role="tablist" aria-label="Слайдтар">
        {SLIDES.map((x, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={`${k + 1}-слайд: ${x.title}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}
      </div>
      <div className="onb-actions">
        {i > 0 ? <button className="btn ghost" onClick={() => setI(i - 1)}>← Артқа</button> : <span />}
        {last
          ? <div className="row gap wrap"><button className="btn ghost" onClick={() => finish()}>Өзім қараймын</button><button className="btn" onClick={() => finish('guide')}>Оқу жолын бастау <Icon n="arrow" size={16} /></button></div>
          : <button className="btn" onClick={() => setI(i + 1)} autoFocus>Келесі <Icon n="arrow" size={16} /></button>}
      </div>
    </dialog>
  );
}

/** Нұсқаулықты қайта ашу */
export const reopenOnboarding = () => update((p) => { p.onboarded = false; });
