"""SMILES → 2D координаттар (RDKit). Формуланың SMILES-пен сәйкестігін тексереді.
Пайдалану: python3 scripts/gen_structures.py scripts/_dump.json src/data/generated/structures.json"""
import json, sys, re, math
from rdkit import Chem
from rdkit.Chem import rdDepictor
from collections import Counter

rdDepictor.SetPreferCoordGen(True)

def parse_formula(f):
    f = re.sub(r'\^.*$', '', f)
    i = 0
    def group(close=None):
        nonlocal i
        acc = Counter()
        while i < len(f):
            ch = f[i]
            if ch in '([':
                i += 1
                inner = group(')' if ch == '(' else ']')
                m = read_mult()
                for k, v in inner.items(): acc[k] += v * m
            elif ch in ')]':
                i += 1
                return acc
            elif ch.isupper():
                el = ch; i += 1
                while i < len(f) and f[i].islower() and f[i] != 'n': el += f[i]; i += 1
                if i < len(f) and f[i] == 'n' and el in ('Z', 'M', 'S', 'I') and not (i + 1 < len(f) and f[i+1].isdigit()):
                    el += 'n'; i += 1
                acc[el] += read_mult()
            else:
                raise ValueError('bad char %r in %s' % (ch, f))
        return acc
    def read_mult():
        nonlocal i
        s = ''
        while i < len(f) and f[i].isdigit(): s += f[i]; i += 1
        m = int(s) if s else 1
        if i < len(f) and f[i] == 'n': i += 1
        return m
    return group()

def main(src, dst):
    data = json.load(open(src))
    out = {}
    problems = []
    mols = {}
    for s in data['substances']:
        if not s['smiles']:
            continue
        mol = Chem.MolFromSmiles(s['smiles'])
        if mol is None:
            problems.append('SMILES оқылмады: %s %s' % (s['id'], s['smiles']))
            continue
        mols[s['id']] = Chem.Mol(mol)
        # формула тексеру
        cnt = Counter()
        abbr = s['abbr'] or {}
        dummy_ends = 0
        for a in mol.GetAtoms():
            if a.GetAtomicNum() == 0:
                mp = str(a.GetAtomMapNum())
                if mp in abbr:
                    cnt.update(parse_formula(abbr[mp]))
                else:
                    dummy_ends += 1
                continue
            cnt[a.GetSymbol()] += 1
            cnt['H'] += a.GetTotalNumHs()
        expected = parse_formula(s['cf'])
        cnt = Counter({k: v for k, v in cnt.items() if v})
        expected = Counter({k: v for k, v in expected.items() if v})
        if cnt != expected:
            problems.append('Формула сәйкес емес: %s cf=%s SMILES=%s' % (s['id'], dict(expected), dict(cnt)))
        # координаттар
        m2 = Chem.Mol(mol)
        rdDepictor.Compute2DCoords(m2)
        try:
            Chem.Kekulize(m2, clearAromaticFlags=True)
        except Exception:
            pass
        conf = m2.GetConformer()
        pts = [(conf.GetAtomPosition(i).x, -conf.GetAtomPosition(i).y) for i in range(m2.GetNumAtoms())]
        # негізгі осьті көлденең орналастыру
        n = len(pts)
        if n > 2:
            cx = sum(p[0] for p in pts) / n; cy = sum(p[1] for p in pts) / n
            sxx = sum((p[0]-cx)**2 for p in pts); syy = sum((p[1]-cy)**2 for p in pts); sxy = sum((p[0]-cx)*(p[1]-cy) for p in pts)
            ang = 0.5 * math.atan2(2*sxy, sxx - syy)
            ca, sa = math.cos(-ang), math.sin(-ang)
            pts = [((p[0]-cx)*ca - (p[1]-cy)*sa, (p[0]-cx)*sa + (p[1]-cy)*ca) for p in pts]
            # 30° торына жақындату (зигзаг көлденең тұрсын)
        atoms = []
        ri = m2.GetRingInfo()
        for a in m2.GetAtoms():
            i = a.GetIdx()
            lab = None
            if a.GetAtomicNum() == 0:
                lab = abbr.get(str(a.GetAtomMapNum()))
            atoms.append([round(pts[i][0], 3), round(pts[i][1], 3), a.GetSymbol(), a.GetTotalNumHs(), a.GetFormalCharge(), 1 if ri.NumAtomRings(i) else 0, lab])
        bonds = []
        for b in m2.GetBonds():
            o = b.GetBondTypeAsDouble()
            bonds.append([b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(o) if o in (1, 2, 3) else 1])
        out[s['id']] = {'a': atoms, 'b': bonds}
    hl = {}
    for h in data['highlights']:
        mol = mols.get(h['sid'])
        if mol is None:
            problems.append('Бөлектеу: SMILES жоқ %s (%s)' % (h['sid'], h['rid']))
            continue
        patt = Chem.MolFromSmarts(h['smarts'])
        if patt is None:
            problems.append('SMARTS қате: %s' % h['smarts']); continue
        m = mol.GetSubstructMatch(patt)
        if not m:
            problems.append('Бөлектеу табылмады: %s / %s / %s' % (h['rid'], h['sid'], h['smarts']))
            continue
        hl.setdefault(h['rid'], {})[h['sid']] = list(m)
    json.dump({'structures': out, 'highlights': hl}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('structures:', len(out), 'highlights:', sum(len(v) for v in hl.values()))
    if problems:
        print('\n'.join(problems))
        sys.exit(1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
