// Python генераторларына арналған деректерді JSON-ға шығару
import { SUBSTANCES } from '../src/data/substances';
import { REACTIONS, eqOf } from '../src/data/index';
import { writeFileSync } from 'node:fs';
const out = {
  substances: SUBSTANCES.map((s) => ({ id: s.id, smiles: s.smiles ?? null, abbr: s.abbr ?? null, cf: s.cf, cls: s.cls })),
  highlights: REACTIONS.filter((r) => r.hl).flatMap((r) => Object.entries(r.hl!).map(([sid, smarts]) => ({ rid: r.id, sid, smarts }))),
  reactions: REACTIONS.filter((r) => r.eq).map((r) => ({ id: r.id, ty: r.ty, st: r.st, left: eqOf(r)!.left, right: eqOf(r)!.right, mp: r.mp ?? null })),
};
writeFileSync(process.argv[2] || 'scripts/_dump.json', JSON.stringify(out));
console.log('substances', out.substances.length, 'highlights', out.highlights.length, 'reactions', out.reactions.length);
