#!/usr/bin/env python3
import math, os, random

random.seed(42)
BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
os.makedirs(BASE, exist_ok=True)

V = []   # (x, y, z)
F = []   # [i, j, k, ...] 0-indexed
FLOOR_Y = -3.0

def add(new_v, new_f):
    b = len(V)
    V.extend(new_v)
    for face in new_f:
        F.append([i + b for i in face])

def box(cx, cy, cz, sx, sy, sz):
    v = [
        (cx-sx, cy-sy, cz-sz), (cx+sx, cy-sy, cz-sz),
        (cx+sx, cy+sy, cz-sz), (cx-sx, cy+sy, cz-sz),
        (cx-sx, cy-sy, cz+sz), (cx+sx, cy-sy, cz+sz),
        (cx+sx, cy+sy, cz+sz), (cx-sx, cy+sy, cz+sz),
    ]
    f = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]]
    return v, f

def cylinder(cx, cy, cz, r, h, seg=12):
    cv, cf = [], []
    for i in range(seg):
        a = 2*math.pi/seg*i
        cv.append((cx+math.cos(a)*r, cy+h, cz+math.sin(a)*r))
    for i in range(seg):
        a = 2*math.pi/seg*i
        cv.append((cx+math.cos(a)*r, cy, cz+math.sin(a)*r))
    for i in range(seg):
        j = (i+1) % seg
        cf.append([i, j, j+seg, i+seg])
    for i in range(seg-2):
        cf.append([0, i+1, i+2])
    for i in range(seg-2):
        cf.append([seg, seg+i+2, seg+i+1])
    return cv, cf

def sphere(cx, cy, cz, r, rings=6, seg=10):
    sv, sf = [], []
    sv.append((cx, cy+r, cz))
    for i in range(1, rings):
        phi = math.pi*i/rings
        for j in range(seg):
            th = 2*math.pi*j/seg
            sv.append((cx+r*math.sin(phi)*math.cos(th),
                        cy+r*math.cos(phi),
                        cz+r*math.sin(phi)*math.sin(th)))
    sv.append((cx, cy-r, cz))
    for j in range(seg):
        sf.append([0, 1+j, 1+(j+1)%seg])
    for i in range(rings-2):
        for j in range(seg):
            r1 = 1+i*seg; r2 = 1+(i+1)*seg; j2 = (j+1)%seg
            sf.append([r1+j, r1+j2, r2+j2, r2+j])
    bot = 1+(rings-1)*seg; last = 1+(rings-2)*seg
    for j in range(seg):
        sf.append([bot, last+(j+1)%seg, last+j])
    return sv, sf

def pipe_segment(x0, y0, z0, x1, y1, z1, r, seg=8):
    dx, dy, dz = x1-x0, y1-y0, z1-z0
    ln = math.sqrt(dx*dx+dy*dy+dz*dz)
    if ln < 1e-6: return [], []
    dx/=ln; dy/=ln; dz/=ln
    if abs(dy) < 0.9:
        ux, uy, uz = 0, 1, 0
    else:
        ux, uy, uz = 1, 0, 0
    px, py, pz = dy*uz-dz*uy, dz*ux-dx*uz, dx*uy-dy*ux
    pl = math.sqrt(px*px+py*py+pz*pz)
    px/=pl; py/=pl; pz/=pl
    qx, qy, qz = dy*pz-dz*py, dz*px-dx*pz, dx*py-dy*px
    pv, pf = [], []
    for end, (bx, by, bz) in enumerate([(x0,y0,z0),(x1,y1,z1)]):
        for i in range(seg):
            a = 2*math.pi*i/seg
            ca, sa = math.cos(a), math.sin(a)
            pv.append((bx + r*(ca*px + sa*qx),
                        by + r*(ca*py + sa*qy),
                        bz + r*(ca*pz + sa*qz)))
    for i in range(seg):
        j = (i+1) % seg
        pf.append([i, j, j+seg, i+seg])
    for i in range(seg-2):
        pf.append([0, i+1, i+2])
    for i in range(seg-2):
        pf.append([seg, seg+i+2, seg+i+1])
    return pv, pf

HALF = 14
nx, nz = 24, 24
tv, tf = [], []
for iz in range(nz+1):
    for ix in range(nx+1):
        x = -HALF + 2*HALF*ix/nx
        z = -HALF + 2*HALF*iz/nz
        y = FLOOR_Y + 0.15*math.sin(x*0.3)*math.cos(z*0.25) + 0.08*math.sin(x*0.8+z*0.6)
        tv.append((x, y, z))
for iz in range(nz):
    for ix in range(nx):
        i = iz*(nx+1)+ix
        tf.append([i, i+1, i+nx+2, i+nx+1])
add(tv, tf)

add(*box(0, FLOOR_Y+0.8, 0, 3.0, 0.8, 2.5))
add(*box(0, FLOOR_Y+2.0, 0, 2.5, 0.4, 2.0))
add(*box(0, FLOOR_Y+3.0, 0, 2.0, 0.6, 1.6))
add(*box(0, FLOOR_Y+3.7, 0, 2.2, 0.08, 1.8))

for row in range(3):
    for col in range(5):
        sx = -1.5 + col * 0.75
        sz = -0.9 + row * 0.9
        h = 0.25 + random.random() * 0.4
        add(*box(sx, FLOOR_Y+3.6+h, sz, 0.28, h, 0.32))
        add(*box(sx, FLOOR_Y+3.6+h*2+0.05, sz, 0.12, 0.05, 0.15))

for side in [-1, 1]:
    wall_z = side * 5.0
    add(*box(0, FLOOR_Y+2.5, wall_z, 10.0, 2.5, 0.3))
    for i in range(8):
        wx = -8 + i * 2.3 + random.uniform(-0.3, 0.3)
        wh = 1.5 + random.random() * 2.5
        add(*box(wx, FLOOR_Y+wh, wall_z + side*0.5, 0.6, wh, 0.25))
    for i in range(12):
        px = -10 + i * 1.8 + random.uniform(-0.2, 0.2)
        ph = 2.0 + random.random() * 3.0
        pr = 0.15 + random.random() * 0.15
        add(*cylinder(px, FLOOR_Y, wall_z + side*1.2, pr, ph, seg=8))

tower_spots = [
    (-7, -2), (-8, 2), (-6, 6), (-5, -7),
    (6, -3), (8, 1), (7, 5), (5, -8),
    (-10, 0), (10, -1), (-3, 9), (3, -10),
    (-9, -6), (9, 7), (-11, 4), (11, -5),
]
for tx, tz in tower_spots:
    tw = 0.5 + random.random() * 0.8
    td = 0.4 + random.random() * 0.6
    th = 1.0 + random.random() * 2.0            # body half-height 1..3 → top y = -1..3
    add(*box(tx, FLOOR_Y+th, tz, tw, th, td))
    th2 = th * (0.15 + random.random() * 0.15)  # small cap on top
    add(*box(tx, FLOOR_Y+th*2+th2, tz, tw*0.7, th2, td*0.7))
    add(*cylinder(tx, FLOOR_Y+th*2+th2*2, tz, 0.06, 0.3+random.random()*0.5, seg=6))

for k in range(8):
    angle_start = random.uniform(0, math.pi*2)
    r_start = 3.5 + random.random() * 2
    r_end = 8 + random.random() * 4
    y_start = FLOOR_Y + 1.0 + random.random() * 3.0
    y_end = FLOOR_Y + 0.5 + random.random() * 4.0
    pipe_r = 0.08 + random.random() * 0.12
    segs = 6
    pts = []
    for s in range(segs+1):
        t = s / segs
        a = angle_start + t * (0.8 + random.random() * 1.2) * random.choice([-1, 1])
        r = r_start + (r_end - r_start) * t
        y = y_start + (y_end - y_start) * t + math.sin(t*math.pi) * 1.5
        pts.append((math.cos(a)*r, y, math.sin(a)*r))
    for s in range(len(pts)-1):
        pv, pf = pipe_segment(pts[s][0], pts[s][1], pts[s][2],
                               pts[s+1][0], pts[s+1][1], pts[s+1][2],
                               pipe_r, seg=6)
        add(pv, pf)

for i in range(6):
    py = FLOOR_Y + 1.5 + i * 0.8
    pz = -8 + random.uniform(-2, 2) + i * 2.5
    pv, pf = pipe_segment(-12, py, pz, 12, py+random.uniform(-0.5, 0.5), pz, 0.1, seg=6)
    add(pv, pf)

for _ in range(20):
    sx = random.uniform(-11, 11)
    sz = random.uniform(-11, 11)
    if abs(sx) < 3.5 and abs(sz) < 3:
        sx += 5.0 * (1 if sx > 0 else -1)
    sr = 0.3 + random.random() * 0.5
    sy = FLOOR_Y + sr + random.random() * 1.5
    add(*sphere(sx, sy, sz, sr, rings=5, seg=8))
    add(*cylinder(sx, FLOOR_Y, sz, sr*0.5, sy - FLOOR_Y - sr*0.3, seg=6))

for ring_r, ring_h, ring_t in [(4.5, 1.2, 0.15), (6.0, 0.8, 0.12), (8.0, 0.5, 0.1)]:
    seg = 36
    for i in range(seg):
        a0 = 2*math.pi*i/seg
        a1 = 2*math.pi*(i+1)/seg
        if i % 9 == 0:
            continue
        x0, z0 = math.cos(a0)*ring_r, math.sin(a0)*ring_r
        x1, z1 = math.cos(a1)*ring_r, math.sin(a1)*ring_r
        bv = [
            (x0, FLOOR_Y, z0),
            (x1, FLOOR_Y, z1),
            (x1, FLOOR_Y+ring_h, z1),
            (x0, FLOOR_Y+ring_h, z0),
        ]
        ri = ring_r - ring_t
        x0i, z0i = math.cos(a0)*ri, math.sin(a0)*ri
        x1i, z1i = math.cos(a1)*ri, math.sin(a1)*ri
        bv += [
            (x0i, FLOOR_Y, z0i),
            (x1i, FLOOR_Y, z1i),
            (x1i, FLOOR_Y+ring_h, z1i),
            (x0i, FLOOR_Y+ring_h, z0i),
        ]
        bf = [
            [0,1,2,3], [5,4,7,6],  # outer/inner
            [0,4,5,1], [2,6,7,3],  # bottom/top
            [0,3,7,4], [1,5,6,2],  # sides
        ]
        add(bv, bf)

for _ in range(40):
    px = random.uniform(-12, 12)
    pz = random.uniform(-12, 12)
    if abs(px) < 4 and abs(pz) < 3.5:
        continue
    ph = 0.8 + random.random() * 2.5
    pr = 0.04 + random.random() * 0.06
    add(*cylinder(px, FLOOR_Y, pz, pr, ph, seg=6))
    add(*sphere(px, FLOOR_Y+ph+0.06, pz, 0.08+random.random()*0.06, rings=3, seg=6))

bridges = [
    (-5, -3, 5, -3, 3.5),
    (-4, 4, 4, 4, 4.0),
    (-3, -7, 3, -7, 2.5),
    (-7, -1, -7, 6, 3.0),
    (7, -4, 7, 3, 3.5),
]
for x0, z0, x1, z1, bh in bridges:
    add(*box((x0+x1)/2, FLOOR_Y+bh, (z0+z1)/2,
             abs(x1-x0)/2+0.2, 0.08, abs(z1-z0)/2+0.2 if z0!=z1 else 0.3))
    for px, pz in [(x0, z0), (x1, z1)]:
        add(*box(px, FLOOR_Y+bh/2, pz, 0.15, bh/2, 0.15))

for _ in range(60):
    px = random.uniform(-13, 13)
    py = FLOOR_Y + 2.0 + random.random() * 7.0
    pz = random.uniform(-13, 13)
    ps = 0.05 + random.random() * 0.12
    b = len(V)
    V.extend([
        (px, py+ps, pz),
        (px+ps, py-ps*0.5, pz),
        (px-ps*0.5, py-ps*0.5, pz+ps),
        (px-ps*0.5, py-ps*0.5, pz-ps),
    ])
    F.extend([[b,b+1,b+2],[b,b+2,b+3],[b,b+3,b+1],[b+1,b+3,b+2]])

for step in range(5):
    sr = 3.5 + step * 0.8
    sh = 0.3 + step * 0.15
    add(*box(0, FLOOR_Y+sh/2, -sr, sr+0.2, sh/2, 0.15))
    add(*box(0, FLOOR_Y+sh/2,  sr, sr+0.2, sh/2, 0.15))
    add(*box(-sr, FLOOR_Y+sh/2, 0, 0.15, sh/2, sr))
    add(*box( sr, FLOOR_Y+sh/2, 0, 0.15, sh/2, sr))

outpath = os.path.join(BASE, 'environment.obj')
with open(outpath, 'w') as f:
    f.write('# gfxdevdot silicon metropolis\n')
    f.write(f'# {len(V)} vertices, {len(F)} faces\n\n')
    for v in V:
        f.write(f'v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
    f.write('\n')
    for face in F:
        f.write('f ' + ' '.join(str(i+1) for i in face) + '\n')

print(f'Wrote {outpath}: {len(V)} vertices, {len(F)} faces')
