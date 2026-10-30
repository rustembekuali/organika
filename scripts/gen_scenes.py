"""Видео стиліндегі анимацияға арналған сахналар.
Әр реакция үшін: реагент атомдарының орны (A кадр), өнім атомдарының орны (B кадр) және атомдардың сәйкестігі.
Сәйкестендіру: RDKit FMCS (ең үлкен ортақ құрылым) + элемент бойынша толықтыру + mp-кеңестер.
Пайдалану: python3 scripts/gen_scenes.py scripts/_dump.json src/data/generated/scenes.json"""
import json, sys, math, re
from rdkit import Chem
from rdkit.Chem import rdDepictor, rdFMCS
from collections import Counter

rdDepictor.SetPreferCoordGen(True)
BOND = 42.0          # px, бір байланыстың ұзындығы
GAP = 34.0           # молекулалар арасы
PLUS = 26.0          # «+» белгісіне орын
MAX_COPIES = 6

def parse_formula_elems(f):
    return set(re.findall(r'[A-Z][a-z]?', re.sub(r'\^.*$', '', f)))

def coef(k, n=3):
    if not k: return 1
    m = re.match(r'^(\d*)(n?)$', k)
    num = int(m.group(1)) if m.group(1) else 1
    return num * n if m.group(2) else num

def build_polymer(unit_smiles, copies=3):
    """*...* буынынан үш буынды фрагмент құрастыру (ұштарында * қалады)"""
    unit = Chem.MolFromSmiles(unit_smiles)
    d = [a.GetIdx() for a in unit.GetAtoms() if a.GetAtomicNum() == 0 and a.GetAtomMapNum() == 0]
    if len(d) != 2: return unit
    head_d, tail_d = d
    head = unit.GetAtomWithIdx(head_d).GetNeighbors()[0].GetIdx()
    tail = unit.GetAtomWithIdx(tail_d).GetNeighbors()[0].GetIdx()
    n = unit.GetNumAtoms()
    combo = unit
    for _ in range(copies - 1):
        combo = Chem.CombineMols(combo, unit)
    rw = Chem.RWMol(combo)
    remove = []
    for i in range(copies - 1):
        rw.AddBond(i * n + tail, (i + 1) * n + head, Chem.BondType.SINGLE)
        remove += [i * n + tail_d, (i + 1) * n + head_d]
    for idx in sorted(remove, reverse=True):
        rw.RemoveAtom(idx)
    m = rw.GetMol()
    Chem.SanitizeMol(m)
    return m

def prep(smiles, polymer=False):
    m = build_polymer(smiles) if polymer else Chem.MolFromSmiles(smiles)
    m = Chem.Mol(m)
    rdDepictor.Compute2DCoords(m)
    arom = {frozenset((b.GetBeginAtomIdx(), b.GetEndAtomIdx())) for b in m.GetBonds() if b.GetIsAromatic()}
    Chem.Kekulize(m, clearAromaticFlags=True)
    m.arom = arom
    return m

def coords(m):
    conf = m.GetConformer()
    pts = [(conf.GetAtomPosition(i).x, -conf.GetAtomPosition(i).y) for i in range(m.GetNumAtoms())]
    # масштаб
    bl = [math.dist(pts[b.GetBeginAtomIdx()], pts[b.GetEndAtomIdx()]) for b in m.GetBonds()]
    k = BOND / (sum(bl) / len(bl)) if bl else 1
    pts = [(x * k, y * k) for x, y in pts]
    # негізгі осьті көлденең қою
    n = len(pts)
    if n > 2:
        cx = sum(p[0] for p in pts) / n; cy = sum(p[1] for p in pts) / n
        sxx = sum((p[0]-cx)**2 for p in pts); syy = sum((p[1]-cy)**2 for p in pts); sxy = sum((p[0]-cx)*(p[1]-cy) for p in pts)
        ang = 0.5 * math.atan2(2*sxy, sxx - syy)
        c, s = math.cos(-ang), math.sin(-ang)
        pts = [((p[0]-cx)*c - (p[1]-cy)*s, (p[0]-cx)*s + (p[1]-cy)*c) for p in pts]
    return pts

def subgraph(m, keep):
    keep = sorted(keep)
    rw = Chem.RWMol(m)
    for i in sorted(set(range(m.GetNumAtoms())) - set(keep), reverse=True):
        rw.RemoveAtom(i)
    sm = rw.GetMol()
    sm.UpdatePropertyCache(False)
    Chem.FastFindRings(sm)
    return sm, keep  # жаңа индекс i → ескі keep[i]

def mcs_map(mP, keepP, mR, keepR, strict=False):
    if not keepP or not keepR: return []
    sP, oP = subgraph(mP, keepP)
    sR, oR = subgraph(mR, keepR)
    res = rdFMCS.FindMCS([sP, sR], atomCompare=rdFMCS.AtomCompare.CompareElements, bondCompare=(rdFMCS.BondCompare.CompareOrderExact if strict else rdFMCS.BondCompare.CompareAny),
                         ringMatchesRingOnly=False, completeRingsOnly=False, matchValences=False, timeout=2)
    if res.numAtoms < (3 if strict else 2): return []
    q = Chem.MolFromSmarts(res.smartsString)
    q.UpdatePropertyCache(False)
    a = sP.GetSubstructMatch(q); b = sR.GetSubstructMatch(q)
    if not a or not b: return []
    return [(oP[i], oR[j]) for i, j in zip(a, b)]

def pinned(m, smarts):
    q = Chem.MolFromSmarts(smarts)
    mm = Chem.Mol(m)
    mm.UpdatePropertyCache(False)
    hits = mm.GetSubstructMatches(q)
    return [h[0] for h in hits]

def main(src, dst):
    data = json.load(open(src))
    subs = {s['id']: s for s in data['substances']}
    scenes = {}
    skipped = []
    for r in data['reactions']:
        try:
            sc = scene(r, subs)
            if sc: scenes[r['id']] = sc
            else: skipped.append(r['id'])
        except Exception as e:
            skipped.append(r['id'] + ' (' + str(e)[:60] + ')')
    json.dump(scenes, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('scenes:', len(scenes), 'skipped:', len(skipped))
    print('\n'.join(skipped))

def expand(terms, subs, side):
    items = []
    for t in terms:
        s = subs[t['id']]
        polymer_unit = bool(s['smiles']) and s['cls'] == 'polymer' and '*' in s['smiles']
        if s['smiles']:
            if polymer_unit:
                items.append({'sid': t['id'], 'mol': prep(s['smiles'], polymer=True), 'k': t['k']})
                continue
            n = coef(t['k'])
            if n > MAX_COPIES: return None
            for _ in range(n):
                items.append({'sid': t['id'], 'mol': prep(s['smiles']), 'k': t['k']})
        else:
            items.append({'sid': t['id'], 'pill': True, 'k': t['k'], 'cf': s['cf'], 'elems': parse_formula_elems(s['cf'])})
    return items

def scene(r, subs):
    L = expand(r['left'], subs, 'L'); R = expand(r['right'], subs, 'R')
    if L is None or R is None: return None
    molsL = [it for it in L if 'mol' in it]; molsR = [it for it in R if 'mol' in it]
    if not molsL and not molsR: return None
    if not any(subs[it['sid']]['cls'] != 'inorg' for it in molsL + molsR): return None
    # реагент және өнім атомдарының тізімі
    ra = [(mi, a.GetIdx()) for mi, it in enumerate(molsL) for a in it['mol'].GetAtoms()]
    pa = [(mi, a.GetIdx()) for mi, it in enumerate(molsR) for a in it['mol'].GetAtoms()]
    usedR = set()
    mapping = {}  # (pmi, pai) -> (rmi, rai)
    excl_R = set(); excl_P = set()
    mp = r.get('mp') or {}
    for sid, sm in (mp.get('out') or {}).items():
        for mi, it in enumerate(molsL):
            if it['sid'] == sid:
                for ai in pinned(it['mol'], sm): excl_R.add((mi, ai))
    for sid, sm in (mp.get('inn') or {}).items():
        for mi, it in enumerate(molsR):
            if it['sid'] == sid:
                for ai in pinned(it['mol'], sm): excl_P.add((mi, ai))
    # 1) MCS: үлкен өнімдерден бастап
    # 0) қолмен берілген жұптар: 'glucose.0:10>ethanol.0:0'
    def find(items, sid, copy):
        c = -1
        for mi, it in enumerate(items):
            if it['sid'] == sid:
                c += 1
                if c == copy: return mi
        raise ValueError('pair: ' + sid)
    for pr in (mp.get('pairs') or []):
        l, rr = pr.split('>')
        (ls, la), (rs, ra_) = l.split(':'), rr.split(':')
        lsid, lc = ls.split('.'); rsid, rc = rs.split('.')
        rmi = find(molsL, lsid, int(lc)); pmi = find(molsR, rsid, int(rc))
        mapping[(pmi, int(ra_))] = (rmi, int(la)); usedR.add((rmi, int(la)))
    order = sorted(range(len(molsR)), key=lambda i: -molsR[i]['mol'].GetNumAtoms())
    for strict in (True, False):
        for pmi in order:
            mP = molsR[pmi]['mol']
            while True:
                keepP = [a for a in range(mP.GetNumAtoms()) if (pmi, a) not in mapping and (pmi, a) not in excl_P]
                best = []
                for rmi, it in enumerate(molsL):
                    keepR = [a for a in range(it['mol'].GetNumAtoms()) if (rmi, a) not in usedR and (rmi, a) not in excl_R]
                    mm = mcs_map(mP, keepP, it['mol'], keepR, strict)
                    if len(mm) > len(best): best = [(p, rmi, q) for p, q in mm]
                if len(best) < (3 if strict else 2): break
                for p, rmi, q in best:
                    mapping[(pmi, p)] = (rmi, q); usedR.add((rmi, q))
    # 2) элемент бойынша толықтыру (көрші атомдардың сәйкестігін ескеріп)
    def elem(it, ai): return it['mol'].GetAtomWithIdx(ai).GetAtomicNum()
    for (pmi, pai) in pa:
        if (pmi, pai) in mapping: continue
        z = elem(molsR[pmi], pai)
        cands = [(rmi, rai) for (rmi, rai) in ra if (rmi, rai) not in usedR and elem(molsL[rmi], rai) == z]
        if not cands: continue
        # көрші: өнімдегі көршісінің бейнесіне реагентте байланысқан атом
        nb_imgs = [mapping[(pmi, n.GetIdx())] for n in molsR[pmi]['mol'].GetAtomWithIdx(pai).GetNeighbors() if (pmi, n.GetIdx()) in mapping]
        def score(c):
            rmi, rai = c
            s = 0
            for (nm, na) in nb_imgs:
                if nm == rmi and molsL[rmi]['mol'].GetBondBetweenAtoms(rai, na) is not None: s += 2
            if (rmi, rai) not in excl_R: s += 1
            return -s
        cands.sort(key=score)
        c = cands[0]
        mapping[(pmi, pai)] = c; usedR.add(c)
    # ── Орналастыру
    def place(items, ref=None):
        blocks = []
        x = 0.0
        for k, it in enumerate(items):
            if k > 0: x += PLUS
            if 'mol' in it:
                pts = coords(it['mol'])
                it['pts'] = pts
                w = (max(p[0] for p in pts) - min(p[0] for p in pts)) + 46
                it['w'] = w
            else:
                w = 18 + 10 * len(re.sub(r'[\d^+\-]', '', it['cf'])) + 6 * len(re.findall(r'\d', it['cf'])) + (8 * len(it['k']) if it['k'] else 0)
                it['w'] = w
            it['x0'] = x
            x += w
            if k < len(items) - 1: x += 0
        return x
    wA = place(L); wB = place(R)
    # өнім молекулаларын реагенттегі орындарына қарай бұру (Прокруст)
    def abs_pts(it):
        cx = it['x0'] + it['w'] / 2
        pts = it['pts']
        mx = (max(p[0] for p in pts) + min(p[0] for p in pts)) / 2
        my = (max(p[1] for p in pts) + min(p[1] for p in pts)) / 2
        return [(x - mx + cx, y - my) for x, y in pts]
    for it in molsL: it['abs'] = abs_pts(it)
    for pmi, it in enumerate(molsR):
        pairs = [(it['pts'][pai], molsL[rmi]['abs'][rai]) for (pm, pai), (rmi, rai) in mapping.items() if pm == pmi]
        if len(pairs) >= 2:
            it['pts'] = procrustes(it['pts'], pairs)
        it['abs'] = None
    wB = place_keep(R)
    for it in molsR: it['abs'] = abs_pts(it)
    W = max(wA, wB)
    offA = (W - wA) / 2; offB = (W - wB) / 2
    # ── Шығару
    atoms = []
    idA = {}; idB = {}
    def info(it, ai, pts_abs, off):
        a = it['mol'].GetAtomWithIdx(ai)
        lab = None
        if a.GetAtomicNum() == 0 and a.GetAtomMapNum():
            lab = (subs[it['sid']]['abbr'] or {}).get(str(a.GetAtomMapNum()))
        ring = 1 if a.IsInRing() else 0
        x, y = pts_abs[ai]
        return [round(x + off, 1), round(y, 1), a.GetTotalNumHs(), a.GetFormalCharge(), ring, lab, a.GetDegree()]
    num = 0
    for rmi, it in enumerate(molsL):
        for a in it['mol'].GetAtoms():
            ai = a.GetIdx()
            el = a.GetSymbol()
            rec = {'e': el, 'a': info(it, ai, it['abs'], offA), 'b': None}
            if el == 'C' and subs[it['sid']]['cls'] != 'inorg':
                num += 1; rec['n'] = num
            idA[(rmi, ai)] = len(atoms)
            atoms.append(rec)
    inv = {v: k for k, v in mapping.items()}
    for (pmi, pai), (rmi, rai) in mapping.items():
        idx = idA[(rmi, rai)]
        atoms[idx]['b'] = info(molsR[pmi], pai, molsR[pmi]['abs'], offB)
        idB[(pmi, pai)] = idx
    for pmi, it in enumerate(molsR):
        for a in it['mol'].GetAtoms():
            if (pmi, a.GetIdx()) in idB: continue
            rec = {'e': a.GetSymbol(), 'a': None, 'b': info(it, a.GetIdx(), it['abs'], offB)}
            if rec['e'] == 'C' and subs[it['sid']]['cls'] != 'inorg':
                num += 1; rec['n'] = num
            # қай таблеткадан (pill) келеді
            src = [k for k, x in enumerate([y for y in L if 'pill' in y]) if rec['e'] in x['elems']]
            rec['f'] = src[0] if src else -1
            idB[(pmi, a.GetIdx())] = len(atoms)
            atoms.append(rec)
    for idx, rec in enumerate(atoms):
        if rec['a'] is not None and rec['b'] is None:
            dst = [k for k, x in enumerate([y for y in R if 'pill' in y]) if rec['e'] in x['elems']]
            rec['t'] = dst[0] if dst else -1
    bondsA = [[idA[(mi, b.GetBeginAtomIdx())], idA[(mi, b.GetEndAtomIdx())], int(b.GetBondTypeAsDouble())] for mi, it in enumerate(molsL) for b in it['mol'].GetBonds()]
    ordA = {}
    for mi, it in enumerate(molsL):
        for b in it['mol'].GetBonds():
            key = frozenset((idA[(mi, b.GetBeginAtomIdx())], idA[(mi, b.GetEndAtomIdx())]))
            ordA[key] = (int(b.GetBondTypeAsDouble()), frozenset((b.GetBeginAtomIdx(), b.GetEndAtomIdx())) in it['mol'].arom)
    bondsB = []
    for mi, it in enumerate(molsR):
        for b in it['mol'].GetBonds():
            i, j = idB[(mi, b.GetBeginAtomIdx())], idB[(mi, b.GetEndAtomIdx())]
            o = int(b.GetBondTypeAsDouble())
            pa_ = frozenset((b.GetBeginAtomIdx(), b.GetEndAtomIdx())) in it['mol'].arom
            prev = ordA.get(frozenset((i, j)))
            if pa_ and prev and prev[1]: o = prev[0]
            bondsB.append([i, j, o])
    def pills(items, off):
        return [{'k': x['k'], 'sid': x['sid'], 'x': round(x['x0'] + x['w'] / 2 + off, 1), 'w': round(x['w'], 1)} for x in items if 'pill' in x]
    def plus(items, off):
        return [round(items[k]['x0'] - PLUS / 2 + off, 1) for k in range(1, len(items))]
    def names(items, off):
        out = []
        for x in items:
            if 'mol' in x:
                ys = [p[1] for p in x['abs']]
                out.append({'sid': x['sid'], 'x': round(x['x0'] + x['w'] / 2 + off, 1), 'y': round(max(ys), 1)})
        return out
    ysA = [a['a'][1] for a in atoms if a['a']]; ysB = [a['b'][1] for a in atoms if a['b']]
    top = min(ysA + ysB + [0]) ; bot = max(ysA + ysB + [0])
    return {
        'W': round(W, 1), 'top': round(top, 1), 'bot': round(bot, 1),
        'atoms': atoms, 'bA': bondsA, 'bB': bondsB,
        'pA': pills(L, offA), 'pB': pills(R, offB), 'plusA': plus(L, offA), 'plusB': plus(R, offB),
        'nA': names(L, offA), 'nB': names(R, offB),
    }

def place_keep(items):
    x = 0.0
    for k, it in enumerate(items):
        if k > 0: x += PLUS
        if 'mol' in it:
            pts = it['pts']
            it['w'] = (max(p[0] for p in pts) - min(p[0] for p in pts)) + 46
        it['x0'] = x
        x += it['w']
    return x

def procrustes(pts, pairs):
    """pts-ті бұру/шағылыстыру арқылы pairs-тегі (өз нүктесі, мақсат) сәйкестікке жақындату"""
    P = [p for p, _ in pairs]; Q = [q for _, q in pairs]
    pc = (sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P))
    qc = (sum(q[0] for q in Q) / len(Q), sum(q[1] for q in Q) / len(Q))
    best = None
    for refl in (1, -1):
        a = b = 0.0
        for (px, py), (qx, qy) in zip(P, Q):
            px -= pc[0]; py = (py - pc[1]) * refl; qx -= qc[0]; qy -= qc[1]
            a += px * qx + py * qy
            b += px * qy - py * qx
        th = math.atan2(b, a)
        c, s = math.cos(th), math.sin(th)
        err = 0.0
        for (px, py), (qx, qy) in zip(P, Q):
            x = px - pc[0]; y = (py - pc[1]) * refl
            err += (x * c - y * s - (qx - qc[0])) ** 2 + (x * s + y * c - (qy - qc[1])) ** 2
        # шағылыстыру морф кезінде молекуланы «жалпайтады» — тек айтарлықтай жақсартса ғана
        if best is None or (refl == 1 and err < best[0]) or (refl == -1 and err < 0.4 * best[0]): best = (err, refl, c, s)
    _, refl, c, s = best
    out = []
    for px, py in pts:
        x = px - pc[0]; y = (py - pc[1]) * refl
        out.append((x * c - y * s, x * s + y * c))
    return out

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
