// Қолмен құрастырылған жаттығулар. Көп бөлігі жинақта табылған нақты қателерге негізделген.

/** «Қатені тап»: теңдеудің бір бөлігі қате. parts — теңдеу бөліктері, оператор («+», «→») басылмайды. */
export interface FindError {
  id: string;
  parts: string[];
  cond?: string;
  /** Қате бөліктің индексі немесе 'cond' */
  bad: number | 'cond';
  fix: string;
  why: string;
  rid?: string;
}

export const FIND_ERRORS: FindError[] = [
  { id: 'fe-wurtz', parts: ['2CH3–CHBr–CH2–CH3', '+', '2K', '→', 'C8H16', '+', '2KBr'], cond: 't°', bad: 4, fix: 'C8H18 (3,4-диметилгексан)', why: 'Вюрц реакциясында екі радикал жалғасады, өнім — қаныққан алкан C₈H₁₈. Жинақта осы жерде C₈H₁₆ деп қате жазылған.', rid: 'wurtz-bromobutane' },
  { id: 'fe-cyclopropane', parts: ['Cl–CH2–CH2–CH2–Cl', '+', '2Na', '→', 'C3H8', '+', '2NaCl'], cond: 't°', bad: 4, fix: 'C3H6 (циклопропан)', why: 'Тізбек ұштары жалғасып сақина тұйықталады, сутек қосылмайды: өнім C₃H₆.', rid: 'cyclopropane-from-dcp' },
  { id: 'fe-konovalov', parts: ['C2H6', '+', 'HNO3', '→', 'C2H5NO2', '+', 'H2O'], cond: 'H₂SO₄ (конц.)', bad: 'cond', fix: 'HNO₃ (сұйыт.), ~140 °C, p', why: 'Коновалов реакциясында нитрлеуші қоспа емес, сұйытылған азот қышқылы қолданылады.', rid: 'konovalov' },
  { id: 'fe-propene-h2o', parts: ['CH2=CH–CH3', '+', 'H2O', '→', 'CH3–CH2–CH2–OH'], cond: 'H₂SO₄, t°', bad: 4, fix: 'CH3–CH(OH)–CH3', why: 'Марковников ережесі бойынша OH сутегі аз көміртекке қосылады: пропанол-2 түзіледі.', rid: 'propene-hydration' },
  { id: 'fe-sulfonation', parts: ['C6H6', '+', 'H2SO4', '→', 'C6H6SO3', '+', 'H2O'], cond: 't°', bad: 4, fix: 'C6H5SO3H', why: 'Сақинадағы бір сутек –SO₃H тобына алмасады. C₆H₆SO₃ жазылса, сутек атомдары теңестірілмейді.', rid: 'benzene-sulfonation' },
  { id: 'fe-cao', parts: ['2CH3COOH', '+', 'CaO', '→', '(CH3COO)2Na', '+', 'H2O'], bad: 4, fix: '(CH3COO)2Ca', why: 'Кальций оксидімен кальций тұзы түзіледі. Жинақта натрий мен кальций шатасқан.', rid: 'acetic-cao' },
  { id: 'fe-grignard', parts: ['CH3–CO–CH3', '+', 'C2H5MgCl', '+', 'H2O', '→', 'C4H9OH', '+', 'Mg(OH)Cl'], bad: 6, fix: 'C5H11OH (2-метилбутанол-2)', why: 'Ацетонның үш көміртегіне этилдің екі көміртегі қосылады: барлығы 5 көміртек.', rid: 'acetone-grignard' },
  { id: 'fe-ethanol-ox', parts: ['C2H5OH', '+', '[O]', '→', 'CH3COOH'], cond: 'KMnO₄, H⁺', bad: 2, fix: '2[O] (оң жақта + H2O)', why: 'Этанолдан сірке қышқылы түзілу үшін 2[O] қажет, бір оттек су құрамында кетеді.', rid: 'ethanol-oxidation-acid' },
  { id: 'fe-glucosate', parts: ['2C6H12O6', '+', 'Cu(OH)2', '→', 'C12H22O14Cu', '+', '2H2O'], bad: 4, fix: 'C12H22O12Cu', why: 'Оттек атомдары: сол жақта 12 + 2 = 14, оң жақта су құрамында 2, демек кешенде 12 оттек болуы керек.', rid: 'glucose-cuoh2-cold' },
  { id: 'fe-pentaacetyl', parts: ['C6H12O6', '+', '5CH3COOH', '→', 'C6H22O11', '+', '5H2O'], cond: 'H₂SO₄', bad: 4, fix: 'C16H22O11', why: 'Глюкозаның 6 көміртегіне бес ацетил тобының 10 көміртегі қосылады: C₁₆.', rid: 'glucose-acetylation' },
  { id: 'fe-ethylamine', parts: ['4C2H5NH2', '+', '15O2', '→', '8CO2', '+', '14H2O', '+', 'N2'], cond: 't°', bad: 8, fix: '2N2', why: 'Сол жақта 4 азот атомы бар, сондықтан оң жақта 2N₂ болуы керек.', rid: 'ethylamine-combustion' },
  { id: 'fe-wagner', parts: ['C2H4', '+', '2KMnO4', '+', '4H2O', '→', '3C2H4(OH)2', '+', '2MnO2', '+', '2KOH'], bad: 0, fix: '3C2H4', why: 'Көміртек атомдары: оң жақта 6, сондықтан этиленнің коэффициенті 3 болуы керек.', rid: 'wagner-ethene' },
  { id: 'fe-toluene-ox', parts: ['C6H5–CH3', '+', '3[O]', '→', 'C6H5–COOH', '+', 'H2O'], cond: 'K₂MnO₄, t°', bad: 'cond', fix: 'KMnO₄, t°', why: 'Тотықтырғыш — калий перманганаты KMnO₄; K₂MnO₄ — калий манганаты, басқа зат.', rid: 'toluene-oxidation' },
  { id: 'fe-glycine-soda', parts: ['NH2CH2COOH', '+', 'Na2CO3', '→', 'NH2CH2COONa', '+', 'CO2', '+', 'H2O'], bad: 0, fix: '2NH2CH2COOH (және оң жақта 2NH2CH2COONa)', why: 'Na₂CO₃-та екі натрий бар: оларды байланыстыру үшін 2 моль глицин қажет.', rid: 'glycine-na2co3' },
  { id: 'fe-cumene', parts: ['C9H12', '+', '[O]', '→', 'C6H5OH', '+', 'C3H6O'], bad: 2, fix: 'O2', why: 'Оң жақта екі оттек атомы бар (фенол мен ацетонда), сондықтан O₂ қажет.', rid: 'cumene-oxidation' },
  { id: 'fe-kucherov', parts: ['CH≡CH', '+', 'H2O', '→', 'CH3–CH2–OH'], cond: 'HgSO₄, H₂SO₄', bad: 4, fix: 'CH3–CHO', why: 'Су қосылғанда тұрақсыз енол түзіліп, ол альдегидке айналады. Атомдар бойынша да этанол сәйкес келмейді: C₂H₂ + H₂O = C₂H₄O.', rid: 'kucherov-ethyne' },
  { id: 'fe-dehydration', parts: ['CH3–CH2–OH', '→', 'CH2=CH2', '+', 'H2O'], cond: 'H₂SO₄ (конц.), t° < 140 °C', bad: 'cond', fix: 't° > 140 °C', why: 'Төмен температурада молекулааралық дегидратация жүріп, диэтил эфирі түзіледі; этилен жоғары температурада шығады.', rid: 'ethanol-dehydration' },
  { id: 'fe-koh-water', parts: ['CH3–CH2–Cl', '+', 'KOH', '→', 'CH2=CH2', '+', 'KCl', '+', 'H2O'], cond: 'KOH (сулы ерітінді)', bad: 'cond', fix: 'KOH (спирттегі ерітінді)', why: 'Сулы сілтімен спирт түзіледі (орынбасу); алкен тек спирттегі сілтіде (элиминация) шығады.', rid: 'c2h5cl-elimination' },
  { id: 'fe-benzene-br', parts: ['C6H6', '+', 'Br2', '→', 'C6H5Br', '+', 'HBr'], cond: 'бром суы, бөлме t°', bad: 'cond', fix: 'FeBr₃ катализаторы', why: 'Бензол бром суымен әрекеттеспейді; сақинаға бромдау Льюис қышқылымен (FeBr₃) жүреді.' },
  { id: 'fe-aniline-br', parts: ['C6H5NH2', '+', '3Br2', '→', 'C6H4BrNH2', '+', '3HBr'], bad: 4, fix: 'C6H2Br3NH2', why: '3 моль бром үш сутекті алмастырады: 2,4,6-триброманилин түзіледі.', rid: 'aniline-br2' },
  { id: 'fe-acetone-mirror', parts: ['CH3–CO–CH3', '+', 'Ag2O', '→', 'CH3COOH', '+', '2Ag'], cond: 'NH₃, t°', bad: 0, fix: 'альдегид (мысалы, CH3–CHO)', why: 'Кетондар күміс айна реакциясын бермейді — бұл альдегидтерге тән реакция.', rid: 'ethanal-ag2o' },
  { id: 'fe-sucrose', parts: ['C12H22O11', '+', 'H2O', '→', '2C6H12O6 (глюкоза)'], cond: 'H⁺, t°', bad: 4, fix: 'C6H12O6 (глюкоза) + C6H12O6 (фруктоза)', why: 'Сахароза глюкоза мен фруктозаға ыдырайды; екі глюкоза мальтозадан түзіледі.', rid: 'sucrose-hydrolysis' },
  { id: 'fe-chlorination', parts: ['CH4', '+', 'Cl2', '→', 'CH3Cl', '+', 'HCl'], cond: 'қараңғыда', bad: 'cond', fix: 'hν (жарық)', why: 'Радикалдық тізбекті бастау үшін хлор молекулаларын жарық ыдыратуы керек.', rid: 'ch4-cl2-1' },
  { id: 'fe-cac2', parts: ['CaC2', '+', '2H2O', '→', 'CH4', '+', 'Ca(OH)2'], bad: 4, fix: 'C2H2', why: 'Кальций карбидінде C₂²⁻ ионы бар, ол ацетилен береді; метан Al₄C₃ гидролизінен түзіледі.', rid: 'cac2-hydrolysis' },
];

/** «Затты анықта»: сапалық белгілер бойынша затты табу */
export interface Identify {
  id: string;
  clues: string[];
  options: string[];
  answer: string;
  why: string;
  rids?: string[];
}

export const IDENTIFY: Identify[] = [
  { id: 'id-ethyne', clues: ['Бром суын түссіздендіреді.', 'Күміс оксидінің аммиак ерітіндісімен тұнба береді.'], options: ['ethyne', 'ethene', 'c2h6', 'benzene'], answer: 'ethyne', why: 'Бром суын қанықпаған көмірсутектер түссіздендіреді, ал тұнба (күміс ацетилениді) тек ұшында ≡C–H бар алкин береді.', rids: ['ethyne-2br2', 'ethyne-ag2o'] },
  { id: 'id-ethene', clues: ['Бром суын түссіздендіреді.', 'Күміс оксидінің аммиак ерітіндісімен тұнба бермейді.', 'Газ, жанғанда жарқыраған жалын береді.'], options: ['ethene', 'ethyne', 'c2h6', 'phenol'], answer: 'ethene', why: 'Қос байланыс бромды қосып алады, бірақ ≡C–H сутегі жоқ болғандықтан күміс ацетилениді түзілмейді.', rids: ['ethene-br2'] },
  { id: 'id-toluene', clues: ['Бром суын түссіздендірмейді.', 'Қыздырғанда KMnO₄ ерітіндісін түссіздендіреді.', 'Сұйықтық, ароматты иісі бар.'], options: ['toluene', 'benzene', 'c6h14', 'styrene'], answer: 'toluene', why: 'Бензол мен гексан KMnO₄-ті түссіздендірмейді, стирол бром суын да түссіздендіреді. Толуолдың бүйір тізбегі ғана тотығады.', rids: ['toluene-oxidation'] },
  { id: 'id-phenol', clues: ['Бром суымен ақ тұнба береді.', 'FeCl₃ ерітіндісімен күлгін түс береді.'], options: ['phenol', 'aniline', 'ethanol', 'benzene'], answer: 'phenol', why: 'Ақ тұнбаны анилин де береді, бірақ FeCl₃-пен күлгін түс — фенолға тән.', rids: ['phenol-br2', 'phenol-fecl3'] },
  { id: 'id-aniline', clues: ['Бром суымен ақ тұнба береді.', 'FeCl₃-пен күлгін түс бермейді.', 'Тұз қышқылында ериді (тұз түзеді).'], options: ['aniline', 'phenol', 'benzene', 'nitrobenzene'], answer: 'aniline', why: 'Анилин — негіз: HCl-мен еритін фениламмоний хлоридін түзеді, ал бром суымен триброманилин береді.', rids: ['aniline-br2', 'aniline-hcl'] },
  { id: 'id-glycerol', clues: ['Бөлме температурасында Cu(OH)₂-ні ерітіп, ашық көк ерітінді береді.', 'Ерітіндіні қыздырғанда қызыл тұнба түзілмейді.'], options: ['glycerol', 'glucose', 'ethanal', 'ethanol'], answer: 'glycerol', why: 'Көк ерітінді көрші OH топтарын көрсетеді, ал қызыл тұнба болмауы альдегид тобы жоқ екенін дәлелдейді.', rids: ['glycerol-cuoh2'] },
  { id: 'id-glucose', clues: ['Бөлме температурасында Cu(OH)₂-мен ашық көк ерітінді береді.', 'Қыздырғанда кірпіш-қызыл тұнба түзіледі.'], options: ['glucose', 'glycerol', 'sucrose', 'ethanal'], answer: 'glucose', why: 'Глюкоза әрі көпатомды спирт (көк ерітінді), әрі альдегид (қыздырғанда Cu₂O).', rids: ['glucose-cuoh2-cold', 'glucose-cuoh2-heat'] },
  { id: 'id-ethanal', clues: ['Күміс айна реакциясын береді.', 'Бөлме температурасында Cu(OH)₂-мен көк ерітінді бермейді.', 'Өткір иісі бар, оңай ұшатын сұйықтық.'], options: ['ethanal', 'glucose', 'acetone', 'acetic'], answer: 'ethanal', why: 'Альдегид тобы бар, бірақ көрші OH топтары жоқ — бұл қарапайым альдегид.', rids: ['ethanal-ag2o', 'ethanal-cuoh2'] },
  { id: 'id-formic', clues: ['Na₂CO₃ ерітіндісінен газ бөледі.', 'Күміс айна реакциясын береді.'], options: ['formic', 'acetic', 'methanal', 'ethanol'], answer: 'formic', why: 'Газ бөлу — қышқылдың белгісі, ал күміс айна альдегид тобын көрсетеді. Екеуі де бар қышқыл — құмырсқа қышқылы.', rids: ['acetic-na2co3', 'formic-ag2o'] },
  { id: 'id-acetic', clues: ['Лакмусты қызыл түске бояйды.', 'Na₂CO₃-пен газ бөледі.', 'Күміс айна реакциясын бермейді.'], options: ['acetic', 'formic', 'ethanal', 'phenol'], answer: 'acetic', why: 'Қышқыл, бірақ альдегид тобы жоқ — сірке қышқылы. Фенол көмір қышқылынан әлсіз, карбонаттан газ бөлмейді.', rids: ['acetic-na2co3'] },
  { id: 'id-starch', clues: ['Йодпен көк түс береді.', 'Суық суда ерімейді, ыстық суда клейстер түзеді.'], options: ['starch', 'cellulose', 'glucose', 'sucrose'], answer: 'starch', why: 'Йодпен көк түс — крахмалға тән сапалық реакция.', rids: ['starch-iodine'] },
  { id: 'id-protein', clues: ['CuSO₄ мен NaOH қосқанда күлгін түс пайда болады.', 'Концентрлі HNO₃-пен сарғаяды.'], options: ['protein', 'glycine', 'glucose', 'glycerol'], answer: 'protein', why: 'Күлгін түс (биурет) пептидтік байланыстарды, сары түс (ксантопротеин) ароматты сақиналарды көрсетеді.', rids: ['biuret', 'xanthoprotein'] },
  { id: 'id-acetone', clues: ['Пропанол-2-ні CuO-мен тотықтырғанда түзіледі.', 'Күміс айна реакциясын бермейді.', 'Cu(OH)₂-мен қыздырғанда қызыл тұнба бермейді.'], options: ['acetone', 'ethanal', 'formic', 'methanal'], answer: 'acetone', why: 'Екіншілік спирт кетонға тотығады; кетондар әлсіз тотықтырғыштармен тотықпайды.', rids: ['propan2ol-cuo'] },
  { id: 'id-alkane', clues: ['Жанғанда түзілген газ әк суын лайлайды.', 'Бром суын да, KMnO₄ ерітіндісін де түссіздендірмейді.', 'Газ.'], options: ['c2h6', 'ethene', 'ethyne', 'butadiene'], answer: 'c2h6', why: 'Тек σ-байланыстары бар алкан қосылу реакцияларына түспейді, ал жану өнімі CO₂ әк суын лайлайды.', rids: ['limewater-co2'] },
  { id: 'id-sucrose', clues: ['Cu(OH)₂-мен бөлме температурасында көк ерітінді береді.', 'Күміс айна реакциясын бермейді.', 'Қышқылмен қыздырғаннан кейін ерітінді күміс айна береді.'], options: ['sucrose', 'glucose', 'glycerol', 'starch'], answer: 'sucrose', why: 'Сахарозада бос альдегид тобы жоқ, бірақ гидролизден кейін түзілген глюкоза күміс айна береді.', rids: ['sucrose-cuoh2', 'sucrose-hydrolysis'] },
  { id: 'id-phenol-vs-ethanol', clues: ['Na-мен сутек бөледі.', 'NaOH-пен де әрекеттеседі.', 'Бром суымен ақ тұнба береді.'], options: ['phenol', 'ethanol', 'glycerol', 'acetic'], answer: 'phenol', why: 'Спирттер NaOH-пен әрекеттеспейді; бром суымен тұнба фенолға тән.', rids: ['phenol-naoh', 'phenol-br2'] },
];
