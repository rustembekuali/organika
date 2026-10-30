// «Реакциялар метросы»: станциялар (заттар) мен олардың картадағы орны.
// Байланыстар (реакциялар) базадан автоматты түрде алынады — қолмен ойдан қосылмайды.

export const METRO_ROWS: { label: string }[] = [
  { label: 'Алкандар' },            // 0
  { label: 'Циклоалкандар' },       // 1
  { label: 'Алкендер' },            // 2
  { label: 'Алкадиендер' },         // 3
  { label: 'Алкиндер' },            // 4
  { label: 'Арендер' },             // 5
  { label: 'Галогентуындылар' },    // 6
  { label: 'Спирттер' },            // 7
  { label: 'Альдегид · кетон · фенол' }, // 8
  { label: 'Қышқылдар мен тұздар' },     // 9
  { label: 'Эфирлер мен майлар' },  // 10
  { label: 'Аминдер, нитроқосылыстар' }, // 11
  { label: 'Аминқышқылдары, пептидтер' }, // 12
  { label: 'Көмірсулар' },          // 13
  { label: 'Полимерлер' },          // 14
];

/** [зат id, баған (1..13), жол] */
export const METRO_STATIONS: [string, number, number][] = [
  ['ch4', 1, 0], ['c2h6', 3, 0], ['c3h8', 5, 0], ['c4h10', 7, 0], ['isobutane', 8, 0], ['c6h14', 11, 0], ['c7h16', 13, 0],
  ['cyclopropane', 5, 1], ['cyclohexane', 11, 1], ['mchx', 13, 1],
  ['ethene', 3, 2], ['propene', 5, 2], ['but1ene', 7, 2], ['but2ene', 8, 2],
  ['butadiene', 7, 3],
  ['ethyne', 3, 4], ['propyne', 5, 4],
  ['cumene', 9, 5], ['ethylbenzene', 10, 5], ['benzene', 11, 5], ['styrene', 12, 5], ['toluene', 13, 5],
  ['ch3cl', 1, 6], ['vinylchloride', 2, 6], ['c2h5cl', 3, 6], ['dibromoethane', 4, 6], ['bromopropane2', 5, 6], ['bromobutane2', 7, 6], ['chlorobenzene', 11, 6],
  ['methanol', 1, 7], ['ethanol', 3, 7], ['glycol', 4, 7], ['propan2ol', 5, 7], ['glycerol', 6, 7], ['butan2ol', 7, 7],
  ['methanal', 1, 8], ['ethanal', 3, 8], ['acetone', 5, 8], ['phenol', 11, 8],
  ['formic', 1, 9], ['sodium_acetate', 2, 9], ['acetic', 3, 9], ['stearic', 6, 9], ['benzoic', 13, 9],
  ['ethyl_acetate', 3, 10], ['diethyl_ether', 4, 10], ['tristearin', 6, 10], ['triolein', 7, 10],
  ['methylamine', 1, 11], ['nitroethane', 2, 11], ['ethylamine', 3, 11], ['aniline', 11, 11], ['nitrobenzene', 12, 11],
  ['glycine', 3, 12], ['alagly', 4, 12], ['alanine', 5, 12],
  ['glucose', 9, 13], ['starch', 11, 13], ['sucrose', 13, 13],
  ['pvc', 2, 14], ['polyethylene', 3, 14], ['polypropylene', 5, 14], ['polybutadiene', 7, 14], ['polystyrene', 12, 14],
];

export const METRO_GEOM = { colW: 92, rowH: 88, left: 150, top: 56 };

/** Ұсынылатын маршрут мысалдары (бастапқы → соңғы) */
export const METRO_PRESETS: [string, string][] = [
  ['ethene', 'ethyl_acetate'],
  ['ch4', 'aniline'],
  ['starch', 'polyethylene'],
  ['c2h6', 'ethyl_acetate'],
  ['ethyne', 'acetic'],
  ['benzene', 'phenol'],
  ['ch4', 'butadiene'],
];
