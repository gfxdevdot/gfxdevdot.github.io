#!/usr/bin/env python3
"""Generate sample OBJ files for gfxdevdot intro scene.

Usage: python3 scripts/gen_obj.py

Output:
  assets/logo.obj         — hexagonal prism logo (wireframe source)
  assets/environment.obj  — nature scene (point cloud source)

Replace these with your own OBJ files. The intro system will:
  - Render logo.obj as a wireframe with iridescent glow
  - Sample environment.obj surfaces as a point cloud
"""
import math, os, random

random.seed(42)
os.makedirs('assets', exist_ok=True)


def write_obj(path, verts, faces, comment=''):
    with open(path, 'w') as f:
        f.write(f'# {comment}\n')
        f.write(f'# {len(verts)} vertices, {len(faces)} faces\n\n')
        for v in verts:
            f.write(f'v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
        f.write('\n')
        for face in faces:
            f.write('f ' + ' '.join(str(i + 1) for i in face) + '\n')
    print(f'  {path}: {len(verts)} verts, {len(faces)} faces')


def merge(tv, tf, nv, nf):
    """Merge new geometry into target lists, offsetting indices."""
    base = len(tv)
    tv.extend(nv)
    for face in nf:
        tf.append([i + base for i in face])


def make_cylinder(cx, cy, cz, radius, height, segs=8):
    V, F = [], []
    for i in range(segs):
        a = 2 * math.pi / segs * i
        V.append((cx + math.cos(a) * radius, cy + height, cz + math.sin(a) * radius))
    for i in range(segs):
        a = 2 * math.pi / segs * i
        V.append((cx + math.cos(a) * radius, cy, cz + math.sin(a) * radius))
    for i in range(segs):
        j = (i + 1) % segs
        F.append([i, j, j + segs, i + segs])
    for i in range(segs - 2):
        F.append([0, i + 1, i + 2])
    for i in range(segs - 2):
        F.append([segs, segs + i + 2, segs + i + 1])
    return V, F


def make_sphere(cx, cy, cz, radius, rings=6, segs=8):
    V, F = [], []
    V.append((cx, cy + radius, cz))
    for i in range(1, rings):
        phi = math.pi * i / rings
        for j in range(segs):
            theta = 2 * math.pi * j / segs
            V.append((
                cx + radius * math.sin(phi) * math.cos(theta),
                cy + radius * math.cos(phi),
                cz + radius * math.sin(phi) * math.sin(theta)
            ))
    V.append((cx, cy - radius, cz))
    for j in range(segs):
        F.append([0, 1 + j, 1 + (j + 1) % segs])
    for i in range(rings - 2):
        for j in range(segs):
            r1 = 1 + i * segs
            r2 = 1 + (i + 1) * segs
            j2 = (j + 1) % segs
            F.append([r1 + j, r1 + j2, r2 + j2, r2 + j])
    bot = 1 + (rings - 1) * segs
    last = 1 + (rings - 2) * segs
    for j in range(segs):
        F.append([bot, last + (j + 1) % segs, last + j])
    return V, F


def terrain_y(x, z):
    """Compute terrain height at (x, z)."""
    return (-3.0
            + 0.4 * math.sin(x * 0.5) * math.cos(z * 0.4)
            + 0.2 * math.sin(x * 1.2 + z * 0.8)
            + 0.1 * math.cos(x * 0.3 - z * 1.1))


# ============================================================
# LOGO — compound hexagonal prism
# ============================================================
def gen_logo():
    V, F = [], []
    N = 6
    off = -math.pi / 6
    r_out, r_in, hh = 1.0, 0.55, 0.35

    # 0..5: outer-top, 6..11: outer-bottom
    for i in range(N):
        a = 2 * math.pi / N * i + off
        V.append((math.cos(a) * r_out, hh, math.sin(a) * r_out))
    for i in range(N):
        a = 2 * math.pi / N * i + off
        V.append((math.cos(a) * r_out, -hh, math.sin(a) * r_out))
    # 12..17: inner-top, 18..23: inner-bottom
    for i in range(N):
        a = 2 * math.pi / N * i + off
        V.append((math.cos(a) * r_in, hh, math.sin(a) * r_in))
    for i in range(N):
        a = 2 * math.pi / N * i + off
        V.append((math.cos(a) * r_in, -hh, math.sin(a) * r_in))

    # Outer side quads
    for i in range(N):
        j = (i + 1) % N
        F.append([i, j, j + N, i + N])
    # Inner side quads
    for i in range(N):
        j = (i + 1) % N
        F.append([12 + i, 12 + j, 18 + j, 18 + i])
    # Top ring connecting outer→inner
    for i in range(N):
        j = (i + 1) % N
        F.append([i, j, 12 + j, 12 + i])
    # Bottom ring
    for i in range(N):
        j = (i + 1) % N
        F.append([N + i, N + j, 18 + j, 18 + i])
    # Inner caps (triangle fan)
    F.append(list(range(12, 18)))
    F.append(list(range(18, 24)))

    write_obj('assets/logo.obj', V, F, 'gfxdevdot hexagonal logo')


# ============================================================
# ENVIRONMENT — terrain + trees + rocks + grass
# ============================================================
def gen_environment():
    V, F = [], []

    # --- Terrain grid 30×30 ---
    nx, nz = 30, 30
    x0, x1 = -15, 15
    z0, z1 = -15, 15
    for iz in range(nz + 1):
        for ix in range(nx + 1):
            x = x0 + (x1 - x0) * ix / nx
            z = z0 + (z1 - z0) * iz / nz
            V.append((x, terrain_y(x, z), z))
    for iz in range(nz):
        for ix in range(nx):
            i = iz * (nx + 1) + ix
            F.append([i, i + 1, i + nx + 2, i + nx + 1])

    # --- Trees (trunk cylinders + canopy spheres) ---
    for _ in range(22):
        tx = (random.random() - 0.5) * 26
        tz = (random.random() - 0.5) * 26
        ty = terrain_y(tx, tz)
        trunk_h = 1.5 + random.random() * 3.0
        trunk_r = 0.08 + random.random() * 0.12
        canopy_r = 0.6 + random.random() * 1.6
        cv, cf = make_cylinder(tx, ty, tz, trunk_r, trunk_h, segs=6)
        merge(V, F, cv, cf)
        sv, sf = make_sphere(tx, ty + trunk_h + canopy_r * 0.35, tz,
                             canopy_r, rings=5, segs=8)
        merge(V, F, sv, sf)

    # --- Rocks ---
    for _ in range(18):
        rx = (random.random() - 0.5) * 24
        rz = (random.random() - 0.5) * 24
        ry = terrain_y(rx, rz)
        rs = 0.2 + random.random() * 0.7
        rv, rf = make_sphere(rx, ry + rs * 0.4, rz, rs, rings=3, segs=5)
        merge(V, F, rv, rf)

    # --- Grass blades (thin quads) ---
    for _ in range(400):
        gx = (random.random() - 0.5) * 28
        gz = (random.random() - 0.5) * 28
        gy = terrain_y(gx, gz)
        gh = 0.15 + random.random() * 0.55
        gw = 0.03 + random.random() * 0.03
        ang = random.random() * math.pi
        dx, dz = math.cos(ang) * gw, math.sin(ang) * gw
        b = len(V)
        V.extend([
            (gx - dx, gy, gz - dz),
            (gx + dx, gy, gz + dz),
            (gx + dx * 0.3, gy + gh, gz + dz * 0.3),
            (gx - dx * 0.3, gy + gh, gz - dz * 0.3),
        ])
        F.append([b, b + 1, b + 2, b + 3])

    # --- Floating particles (small tetrahedra in the air) ---
    for _ in range(60):
        px = (random.random() - 0.5) * 22
        py = -3.0 + 1.0 + random.random() * 7
        pz = (random.random() - 0.5) * 22
        ps = 0.04 + random.random() * 0.1
        b = len(V)
        V.extend([
            (px, py + ps, pz),
            (px + ps, py - ps * 0.5, pz),
            (px - ps * 0.5, py - ps * 0.5, pz + ps),
            (px - ps * 0.5, py - ps * 0.5, pz - ps),
        ])
        F.extend([
            [b, b + 1, b + 2],
            [b, b + 2, b + 3],
            [b, b + 3, b + 1],
            [b + 1, b + 3, b + 2],
        ])

    write_obj('assets/environment.obj', V, F, 'gfxdevdot environment scene')


if __name__ == '__main__':
    print('Generating OBJ files...')
    gen_logo()
    gen_environment()
    print('Done!')
