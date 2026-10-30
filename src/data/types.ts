// Органика — деректер типтері
// Реакциялар базасы интерфейстен бөлек сақталады: src/data/*.ts

export type ClassId =
  | 'alkane' | 'cycloalkane' | 'alkene' | 'diene' | 'alkyne' | 'arene'
  | 'halo' | 'nitro' | 'alcohol' | 'polyol' | 'phenol' | 'aldehyde' | 'ketone'
  | 'acid' | 'salt' | 'ether' | 'ester' | 'fat' | 'amine' | 'aminoacid'
  | 'protein' | 'carb' | 'polymer' | 'other' | 'inorg';

export interface Substance {
  id: string;
  /** Қазақша атауы */
  name: string;
  /** Мектептік жинақталған/молекулалық формула (баланс осы бойынша тексеріледі) */
  cf: string;
  /** Жартылай құрылымдық формула (теңдеуде изомерлерді ажырату үшін) */
  sf?: string;
  /** Құрылымдық сызба үшін SMILES (RDKit арқылы 2D координатқа айналады) */
  smiles?: string;
  /** SMILES ішіндегі [*:n] орнына жазылатын қысқартулар, мысалы {"1":"C17H35"} */
  abbr?: Record<string, string>;
  cls: ClassId;
  /** Синонимдер: орысша, халықаралық, ескі атаулар */
  alt?: string[];
}

export type TopicId =
  | 'alkanes' | 'cycloalkanes' | 'alkenes' | 'dienes' | 'alkynes' | 'arenes'
  | 'halo' | 'alcohols' | 'polyols' | 'phenols' | 'aldehydes' | 'ketones'
  | 'acids' | 'unsat_acids' | 'ethers' | 'esters' | 'fats' | 'amines'
  | 'aminoacids' | 'proteins' | 'mono' | 'di' | 'poly' | 'polymers' | 'inorg';

export type Section = 'get' | 'prop';
export type Level = 'base' | 'ubt' | 'adv';
/** ok — тексерілді; fix — PDF-те қате болған, түзетілді; simp — мектептік оңайлатылған жазба; check — күмәнді, тексеруді қажет етеді */
export type Status = 'ok' | 'fix' | 'simp' | 'check';

export type RType =
  | 'subst' | 'add' | 'elim' | 'ox' | 'red' | 'comb' | 'poly' | 'polycond'
  | 'hydrol' | 'isom' | 'ester' | 'acidbase' | 'decomp' | 'ferment' | 'synth' | 'qual' | 'exch';

export interface Reaction {
  id: string;
  /** Атауы */
  t: string;
  /** Қай тақырып пен бөлімге жатады: 'alkanes:get' */
  at: string[];
  /** Теңдеу: заттардың id-лері арқылы, мысалы '2 ch3cl + 2 na -> c2h6 + 2 nacl' */
  eq?: string;
  /** Теңдеуі жоқ сипаттамалық сапалық реакциялар үшін схема */
  scheme?: string;
  /** Шарттар (жебенің үстінде) */
  c?: string;
  ty: RType;
  lv: Level;
  /** PDF беті (жинақтағы нөмір) немесе 0 — жинақта жоқ, қосымша мектеп курсынан */
  src: number;
  st: Status;
  /** Атаулы реакция id-і */
  nm?: string;
  /** Ережеге сілтеме: markovnikov, zaitsev */
  rule?: string;
  /** Сапалық реакция ма */
  q?: boolean;
  /** Бақыланатын белгі */
  ob?: string;
  /** Қандай байланыс үзіліп, қандай түзіледі */
  b?: string;
  /** Түсіндірме (бірінші сөйлемі — қысқаша мәні) */
  x: string;
  /** Жиі жіберілетін қате */
  m?: string;
  /** Тексеру ескертпесі (PDF-тегі түпнұсқа, түзету себебі) */
  n?: string;
  /** Құрылымда бөлектеу: зат id → SMARTS */
  hl?: Record<string, string>;
  /** Анимациядағы атомдық сәйкестендіруге көмек: out — реагенттің бұл атомы бейорганикалық өнімге кетеді; inn — өнімнің бұл атомы бейорганикалық реагенттен келеді (SMARTS, бірінші атом) */
  mp?: { out?: Record<string, string>; inn?: Record<string, string>; pairs?: string[] };
  /** Жаттығуға арналған «тұзақ» өнімдер (мысалы, изомер) */
  trap?: string[];
}

export interface Term { k: string; id: string; mark?: string }
export interface ParsedEq { left: Term[]; right: Term[]; rev: boolean }

export interface Topic {
  id: TopicId;
  name: string;
  group: string;
  cls: ClassId;
  intro: string;
  /** Тақырып деңгейіндегі жиі қателер */
  mistakes: string[];
  /** Теңдеусіз сапалық белгілер мен фактілер */
  notes?: string[];
}
