"""Скелет графының қырларын (екі түйін арасындағы сызықтар) шығару және нөмірлеп суреттеу."""
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sk = np.load('skel.npy')
H, W = sk.shape
OFF = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def nbrs(p):
    y, x = p
    return [(y + dy, x + dx) for dy, dx in OFF if 0 <= y + dy < H and 0 <= x + dx < W and sk[y + dy, x + dx]]

pts = list(zip(*map(list, np.nonzero(sk))))
pts = [tuple(map(int, p)) for p in pts]
deg = {p: len(nbrs(p)) for p in pts}
node_px = {p for p in pts if deg[p] != 2}
# cluster node pixels (junction blobs); endpoints are their own clusters
m = np.zeros_like(sk)
for p in node_px:
    m[p] = True
lab, n = ndi.label(m, structure=np.ones((3, 3)))
cid = {p: int(lab[p]) for p in node_px}
cent = {}
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    cent[i] = (float(xs.mean()), float(ys.mean()))

edges = []
seen = set()  # directed first-steps (node_px, next)
for s in node_px:
    for q in nbrs(s):
        if q in node_px:
            continue
        if (s, q) in seen:
            continue
        path = [s, q]
        prev, cur = s, q
        while cur not in node_px:
            nx = [r for r in nbrs(cur) if r != prev and r not in path[-3:]]
            if not nx:
                break
            # prefer non-node continuation unless reaching a node
            prev, cur = cur, nx[0]
            path.append(cur)
        e = path[-1]
        seen.add((s, q))
        if len(path) >= 2:
            seen.add((e, path[-2]))
        a_, b_ = cid[s], cid.get(e)
        if b_ is None:
            continue
        poly = [cent[a_]] + [(float(x), float(y)) for (y, x) in path[1:-1]] + [cent[b_]]
        edges.append({'a': a_, 'b': b_, 'pts': poly, 'len': len(path)})

# dedupe edges that are identical reversed
uniq = []
keys = set()
for e in edges:
    k = (min(e['a'], e['b']), max(e['a'], e['b']), round(sum(p[0] for p in e['pts']) / len(e['pts'])), e['len'])
    if k in keys:
        continue
    keys.add(k)
    uniq.append(e)
# node-to-node direct adjacency between different clusters (tiny edges)
for p in node_px:
    for q in nbrs(p):
        if q in node_px and cid[p] != cid[q] and cid[p] < cid[q]:
            k = (cid[p], cid[q], 'd')
            if k in keys:
                continue
            keys.add(k)
            uniq.append({'a': cid[p], 'b': cid[q], 'pts': [cent[cid[p]], cent[cid[q]]], 'len': 2})

print('nodes', n, 'edges', len(uniq))
json.dump({'cent': cent, 'edges': uniq}, open('graph.json', 'w'))

S = 2
img = Image.open('signature.png').convert('RGB').resize((W * S, H * S))
img = Image.blend(img, Image.new('RGB', img.size, 'white'), 0.7)
d = ImageDraw.Draw(img)
cols = [(230, 25, 75), (60, 180, 75), (0, 130, 200), (245, 130, 48), (145, 30, 180), (70, 160, 160), (240, 50, 230), (128, 128, 0), (0, 0, 128), (170, 110, 40)]
for i, e in enumerate(uniq):
    c = cols[i % len(cols)]
    d.line([(x * S, y * S) for x, y in e['pts']], fill=c, width=3)
    mid = e['pts'][len(e['pts']) // 2]
    d.text((mid[0] * S + 4, mid[1] * S + 2), 'e%d' % i, fill=c)
for i, (x, y) in cent.items():
    d.ellipse((x * S - 5, y * S - 5, x * S + 5, y * S + 5), fill=(0, 0, 0))
    d.text((x * S + 6, y * S - 14), 'n%d' % i, fill=(0, 0, 0))
img.save('edges.png')
for i, e in enumerate(uniq):
    print('e%d n%d->n%d len=%d' % (i, e['a'], e['b'], e['len']))
