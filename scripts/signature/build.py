"""Скелет қырларын қалам жүрісі ретімен тізіп, тегіс SVG жолдарына айналдыру."""
import json, math
import numpy as np
from PIL import Image, ImageDraw

g = json.load(open('graph.json'))
E = g['edges']

def chain(start, ids):
    """start түйінінен бастап қырларды ретімен жалғау (бағыты автоматты)."""
    cur, out = start, []
    for i in ids:
        e = E[i]
        pts = e['pts']
        if e['a'] == e['b']:
            pass  # тұйық ілмек: бағыты кейін тексеріледі
        elif e['a'] == cur:
            cur = e['b']
        elif e['b'] == cur:
            pts = pts[::-1]; cur = e['a']
        else:
            raise SystemExit('edge e%d does not touch n%d' % (i, cur))
        out += pts if not out else pts[1:]
    return out

def loop_dir(pts, want_down):
    k = min(40, len(pts) // 4)
    down = pts[k][1] > pts[0][1]
    return pts if down == want_down else pts[::-1]

# 1) Р әрпі + астынан өтетін ұзын сызық (бір тыныспен)
s1 = chain(19, [16, 24, 25, 30, 23, 15])
s1 += loop_dir(E[26]['pts'], True)[1:]
s1 += chain(35, [15, 33, 8, 7, 17, 37, 36, 38, 6, 27])[1:]
# 2–3) у
s2 = chain(26, [14, 8, 7, 22])
s3 = chain(24, [22, 7, 9])
# 4–6) с, т
s4 = chain(18, [10, 5])
s5 = chain(8, [5, 35])
s6 = chain(12, [3, 13])
# 7) е
s7 = chain(17, [1, 19]) + loop_dir(E[4]['pts'], False)[1:] + chain(10, [19, 0])[1:]
# 8) м
s8 = chain(22, [32, 31, 31, 39, 34, 2, 2, 20, 18, 18, 11])
strokes = [s1, s2, s3, s4, s5, s6, s7, s8]

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

def rdp(a, eps):
    if len(a) < 3:
        return a
    s, e = a[0], a[-1]
    d = e - s
    n = np.hypot(*d)
    dist = np.abs(d[0] * (a[:, 1] - s[1]) - d[1] * (a[:, 0] - s[0])) / n if n else np.hypot(*(a - s).T)
    i = int(dist.argmax())
    if dist[i] > eps:
        return np.vstack([rdp(a[:i + 1], eps)[:-1], rdp(a[i:], eps)])
    return np.array([s, e])

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

X0, Y0, X1, Y1 = 140, 14, 1132, 412   # қиып алу аймағы
out = []
for s in strokes:
    a = smooth(s)
    a = rdp(a, 0.9) - np.array([X0, Y0])
    seg = np.hypot(*np.diff(a, axis=0).T).sum()
    out.append({'d': to_path(a), 'len': round(float(seg), 1), 'poly': a.tolist()})
    print(len(s), '->', len(a), 'pts, len', round(float(seg)))
json.dump({'w': X1 - X0, 'h': Y1 - Y0, 'strokes': [{'d': o['d'], 'len': o['len']} for o in out]}, open('signature.json', 'w'))
print('bytes', sum(len(o['d']) for o in out))

# салыстыру: түпнұсқа үстіне қызылмен
im = Image.open('signature.png').convert('RGB')
im = Image.blend(im, Image.new('RGB', im.size, 'white'), 0.55)
d = ImageDraw.Draw(im)
cols = [(230, 25, 75), (0, 130, 200), (60, 180, 75), (245, 130, 48), (145, 30, 180), (0, 160, 160), (240, 50, 230), (120, 90, 0)]
for i, o in enumerate(out):
    p = [(x + X0, y + Y0) for x, y in o['poly']]
    d.line(p, fill=cols[i], width=3)
    d.text((p[0][0] + 5, p[0][1] - 14), str(i + 1), fill=cols[i])
im.save('check.png')
