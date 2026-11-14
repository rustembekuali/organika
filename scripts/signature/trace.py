"""Қолтаңбаның орталық сызығын табу: скелет → граф (ұштар, түйіндер, қырлар)."""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize, binary_closing, disk, remove_small_objects
from scipy import ndimage as ndi

src = sys.argv[1]
im = Image.open(src).convert('LA')
a = np.array(im)
ink = a[..., 0] < 150
ink = binary_closing(ink, disk(2))
ink = remove_small_objects(ink, 30)
sk = skeletonize(ink)

H, W = sk.shape
OFF = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def nbrs(y, x):
    out = []
    for dy, dx in OFF:
        yy, xx = y + dy, x + dx
        if 0 <= yy < H and 0 <= xx < W and sk[yy, xx]:
            out.append((yy, xx))
    return out

pts = list(zip(*np.nonzero(sk)))
deg = {p: len(nbrs(*p)) for p in pts}
ends = [p for p in pts if deg[p] == 1]
junc = [p for p in pts if deg[p] >= 3]

# stroke width estimate
dist = ndi.distance_transform_edt(ink)
w = np.median([dist[p] for p in pts]) * 2

# junction clusters
jmask = np.zeros_like(sk)
for p in junc:
    jmask[p] = True
lab, nj = ndi.label(jmask, structure=np.ones((3, 3)))
print('skeleton px', len(pts), 'ends', len(ends), 'junction px', len(junc), 'clusters', nj, 'stroke w', round(float(w), 2))

dbg = Image.open(src).convert('RGB')
d = ImageDraw.Draw(dbg)
for (y, x) in pts:
    d.point((x, y), fill=(0, 160, 255))
for (y, x) in ends:
    d.ellipse((x - 6, y - 6, x + 6, y + 6), outline=(0, 200, 0), width=3)
for i in range(1, nj + 1):
    ys, xs = np.nonzero(lab == i)
    cx, cy = xs.mean(), ys.mean()
    d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), outline=(255, 0, 0), width=3)
    d.text((cx + 9, cy - 16), str(i), fill=(255, 0, 0))
for k, (y, x) in enumerate(ends):
    d.text((x + 8, y + 4), 'E%d' % k, fill=(0, 140, 0))
dbg.save('debug.png')
np.save('skel.npy', sk)
