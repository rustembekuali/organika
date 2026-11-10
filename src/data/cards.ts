// Флэш-карталар: сайттағы бар деректерден құралады (атаулар, функционалдық топтар, сапалық және атаулы реакциялар).
// Жаңа карта қолмен жазылмайды — дереккөз өзгерсе, карталар да өздігінен жаңарады.
import { NAME_GROUPS } from './names';
import { SCHOOL } from './school';
import { NAMED } from './named';

export interface Card {
  /** Тұрақты id: прогресс осы бойынша сақталады */
  id: string;
  /** Алдыңғы беті: сұрақ */
  front: string;
  /** Алдыңғы беттегі кішкене түсініктеме: не сұралып тұр */
  hint: string;
  /** Артқы беті: негізгі жауап */
  back: string;
  /** Артқы беттегі қосымша мәлімет */
  extra?: string;
}

export interface Deck {
  id: string;
  title: string;
  desc: string;
  ic: string;
  cards: Card[];
}

const nameCards = (part: 'hc' | 'o' | 'n'): Card[] =>
  NAME_GROUPS.filter((g) => g.part === part).flatMap((g) =>
    g.items.map((x) => ({
      id: `name:${x.f}|${x.sys}`,
      front: x.f,
      hint: `${g.title} · атауы қандай?`,
      back: x.sys,
      extra: [x.triv && `Тривиал атауы: ${x.triv}`, g.rule.split(/(?<=\.)\s/)[0]].filter(Boolean).join(' · '),
    })),
  );

const tableRows = (school: string) => SCHOOL.find((s) => s.id === school)?.blocks.find((b) => b.table)?.table?.rows ?? [];

export const DECKS: Deck[] = [
  { id: 'names-hc', title: 'Көмірсутектердің атаулары', desc: 'Алкандар, алкендер, алкиндер, арендер: формула → атау', ic: 'book', cards: nameCards('hc') },
  { id: 'names-o', title: 'Оттекті қосылыстардың атаулары', desc: 'Спирттер, альдегидтер, қышқылдар, көмірсулар', ic: 'book', cards: nameCards('o') },
  { id: 'names-n', title: 'Азотты қосылыстардың атаулары', desc: 'Аминдер, анилин, аминқышқылдары', ic: 'book', cards: nameCards('n') },
  {
    id: 'groups', title: 'Функционалдық топтар', desc: 'Топ → атауы мен класы', ic: 'target',
    cards: tableRows('groups').map(([g, name, cls, ex]) => ({ id: `group:${g}`, front: g, hint: 'Бұл топ қалай аталады, қай класқа тән?', back: `${name} — ${cls}`, extra: `Мысал: ${ex}` })),
  },
  {
    id: 'qual', title: 'Сапалық реакциялар', desc: 'Класс + реактив → не байқалады', ic: 'flask',
    cards: tableRows('qual-table').map(([cls, reag, sign]) => ({ id: `qual:${cls}|${reag}`, front: `${cls} + ${reag}`, hint: 'Не байқалады?', back: sign })),
  },
  {
    id: 'named', title: 'Атаулы реакциялар', desc: 'Атауы → схемасы, ғалымы, есте сақтау тәсілі', ic: 'star',
    cards: NAMED.map((n) => ({ id: `named:${n.id}`, front: n.name, hint: 'Схемасы қандай?', back: n.scheme, extra: `${n.scientist} · ${n.memo}` })),
  },
];

export const DECK_BY_ID: Record<string, Deck> = Object.fromEntries(DECKS.map((d) => [d.id, d]));
export const ALL_CARDS: Card[] = DECKS.flatMap((d) => d.cards);
