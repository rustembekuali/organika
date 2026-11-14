"""Скелет қырларын қалам жүрісіне автоматты жалғап, тегіс SVG жолдарына айналдыру.

Қолдану (signature.png тұрған бумада):
    python3 trace.py signature.png   # skel.npy, debug.png
    python3 edges.py                 # graph.json, edges.png
    python3 build.py                 # signature.json, check.png
    cp signature.json ../../src/data/generated/signature.json

Қырларды қолмен тізудің қажеті жоқ: әр түйінде қалам ең түзу жалғасатын (бұрылысы ең аз)
қырмен жүреді, бұрылыс тым күрт болса — штрих аяқталады. Штрихтар солдан оңға қарай салынады.
"""
import json, math
import numpy as np
from PIL import Image, ImageDraw

g = json.load(open('graph.json'))
E = g['edges']
cent = {int(k): v for k, v in g['cent'].items()}
MAX_TURN = math.radians(75)   # бұдан күрт бұрылыс — жаңа штрих

adj = {}
for i, e in enumerate(E):
    adj.setdefault(e['a'], []).append(i)
    if e['b'] != e['a']:
        adj.setdefault(e['b'], []).append(i)

def oriented(i, frm):
    """i қырының нүктелері frm түйінінен басталатындай бағытта."""
    e = E[i]
    pts = e['pts']
    if e['a'] == frm:
        return pts, e['b']
    return pts[::-1], e['a']

def direction(pts, at_start, k=12):
    """Қырдың басындағы (немесе соңындағы) бағыт векторы."""
    p = np.array(pts, float)
    k = min(k, len(p) - 1)
    if k <= 0:
        return np.zeros(2)
    v = p[k] - p[0] if at_start else p[-1] - p[-1 - k]
    n = np.hypot(*v)
    return v / n if n else v

def turn(v1, v2):
    if not v1.any() or not v2.any():
        return 0.0
    return math.acos(max(-1.0, min(1.0, float(v1 @ v2))))

used = set()
def free(n):
    return [i for i in adj.get(n, []) if i not in used]

def walk(start):
    pts, node, inc = [], start, None
    while True:
        cand = free(node)
        if not cand:
            break
        best, bt = None, None
        for i in cand:
            p, _ = oriented(i, node)
            t = turn(inc, direction(p, True)) if inc is not None else 0.0
            if bt is None or t < bt:
                best, bt = i, t
        if inc is not None and bt > MAX_TURN:
            break
        p, nxt = oriented(best, node)
        used.add(best)
        pts += p if not pts else p[1:]
        inc = direction(p, False)
        node = nxt
    return pts

# Қалам қай жерден басталады (сурет координаталарында): бірінші әріптің бастапқы нүктесіне жақын ұшы бар түйін.
# Бұл қолтаңбада — «Р» әрпінің ішкі ілмегінің ұшы.
PEN_START = (458, 108)
strokes = []
first = min((n for n in adj if len(free(n)) == 1), key=lambda n: math.dist(cent[n], PEN_START))
FIRST = walk(first)
strokes.append(FIRST)
while len(used) < len(E):
    # бос ұшы бар түйіндерден (сол жақтағысынан) бастаймыз, болмаса — кез келген қалған қырдан
    ends = [n for n in adj if len(free(n)) == 1]
    nodes = ends or [n for n in adj if free(n)]
    start = min(nodes, key=lambda n: cent[n][0])
    s = walk(start)
    if len(s) >= 2:
        strokes.append(s)

# өте қысқа қалдықтарды (түйін ішіндегі ұсақ қырлар) тастаймыз
def plen(s):
    a = np.array(s, float)
    return float(np.hypot(*np.diff(a, axis=0).T).sum())
strokes = [s for s in strokes if plen(s) > 14]
# бағыт: тік штрихтар жоғарыдан төмен, қалғандары солдан оңға (бірінші штрих — қалам жүрген бағытында)
def orient(s):
    if s is FIRST:
        return s
    dx, dy = s[-1][0] - s[0][0], s[-1][1] - s[0][1]
    if abs(dy) > abs(dx):
        return s if dy > 0 else s[::-1]
    return s if dx >= 0 else s[::-1]
strokes = [orient(s) for s in strokes]
first_stroke = strokes[0]
# алдымен әріптер (солдан оңға), ең соңында ұзын әшекейлі сызықтар — қолмен жазғандағыдай
allx = np.array([p[0] for s in strokes for p in s])
W_ALL = allx.max() - allx.min()
def width(s):
    xs = [p[0] for p in s]
    return max(xs) - min(xs)
ally = np.array([p[1] for s in strokes for p in s])
LOW = ally.min() + 0.75 * (ally.max() - ally.min())   # бұдан төмен басталатын штрих — асты сызған әшекей
flourish = lambda s: width(s) > 0.33 * W_ALL or min(p[1] for p in s) > LOW
letters = [first_stroke] + sorted([s for s in strokes[1:] if not flourish(s)], key=lambda s: min(p[0] for p in s))
rest = [s for s in strokes[1:] if flourish(s)]
# әшекейлер: сол жақтағысынан бастап, келесісі — алдыңғысының соңына ең жақын ұшы бар штрих (қажет болса кері бағытта)
tail = []
if rest:
    cur = min(rest, key=lambda s: s[0][0]); rest.remove(cur); tail.append(cur)
    while rest:
        end = np.array(tail[-1][-1])
        best = min(rest, key=lambda s: min(np.hypot(*(np.array(s[0]) - end)), np.hypot(*(np.array(s[-1]) - end))))
        rest.remove(best)
        if np.hypot(*(np.array(best[-1]) - end)) < np.hypot(*(np.array(best[0]) - end)):
            best = best[::-1]
        tail.append(best)
strokes = letters + tail

def smooth(pts, it=3, win=9):
    a = np.array(pts, float)
    for _ in range(it):
        if len(a) < win + 2:
            break
        k = np.ones(win) / win
        pad = win // 2
        xp = np.concatenate([np.repeat(a[:1], pad, 0), a, np.repeat(a[-1:], pad, 0)])
        b = np.stack([np.convolve(xp[:, 0], k, 'valid'), np.convolve(xp[:, 1], k, 'valid')], 1)
        b[0], b[-1] = a[0], a[-1]
        a = b
    return a

def to_path(a):
    """Catmull-Rom → кубтық Безье."""
    f = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
    d = 'M%s %s' % (f(a[0][0]), f(a[0][1]))
    n = len(a)
    for i in range(n - 1):
        p0, p1, p2, p3 = a[max(i - 1, 0)], a[i], a[i + 1], a[min(i + 2, n - 1)]
        c1, c2 = p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6
        d += 'C%s %s %s %s %s %s' % tuple(f(v) for v in (*c1, *c2, *p2))
    return d

def resample(a, step=6.0):
    seg = np.hypot(*np.diff(a, axis=0).T); t = np.concatenate([[0], np.cumsum(seg)])
    n = max(3, int(round(t[-1] / step)) + 1); u = np.linspace(0, t[-1], n)
    return np.stack([np.interp(u, t, a[:, 0]), np.interp(u, t, a[:, 1])], 1)

allp = np.vstack([np.array(s, float) for s in strokes])
M = 14
X0, Y0 = np.floor(allp.min(0)) - M
X1, Y1 = np.ceil(allp.max(0)) + M
out = []
for s in strokes:
    a = smooth(s, it=4, win=9)
    a = smooth(resample(a, 3.0), it=2, win=5)
    a = resample(a, 6.0) - np.array([X0, Y0])
    seg = np.hypot(*np.diff(a, axis=0).T).sum()
    out.append({'d': to_path(a), 'len': round(float(seg), 1), 'poly': a.tolist()})
    print(len(s), '->', len(a), 'pts, len', round(float(seg)))
json.dump({'w': int(X1 - X0), 'h': int(Y1 - Y0), 'strokes': [{'d': o['d'], 'len': o['len']} for o in out]}, open('signature.json', 'w'))
print('strokes', len(out), 'bytes', sum(len(o['d']) for o in out), 'box', int(X1 - X0), 'x', int(Y1 - Y0))

# салыстыру: түпнұсқа үстіне түрлі түспен, штрих нөмірімен
im = Image.open('signature.png').convert('RGB')
im = Image.blend(im, Image.new('RGB', im.size, 'white'), 0.55)
d = ImageDraw.Draw(im)
cols = [(230, 25, 75), (0, 130, 200), (60, 180, 75), (245, 130, 48), (145, 30, 180), (0, 160, 160), (240, 50, 230), (120, 90, 0)]
for i, o in enumerate(out):
    p = [(x + X0, y + Y0) for x, y in o['poly']]
    d.line(p, fill=cols[i % len(cols)], width=3)
    d.text((p[0][0] + 5, p[0][1] - 14), str(i + 1), fill=cols[i % len(cols)])
im.save('check.png')
