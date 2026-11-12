"""Panel gaps (doors, hood, trunk lid, bumpers) as a paint mask and a tangent-space normal map in the body's UV space.

The body UV is its loft parameterisation (u along the car, v around the section), so a seam drawn on the real surface
is located by projecting its points onto the half grid (sub-quad accuracy) and drawn with a width measured in metres.
"""
import numpy as np
import design as D

TW, TH = 4096, 2048
GAP_DARK = 0.0013     # half width of the dark gap (m)
GAP_EDGE = 0.0034     # half width including the rolled panel edges (m)

# (projection, facing filter, points). Side seams in (x, z); top seams in (x, y); rear-face seams in (y, z).
SEAMS = [
    ("xz", "side", [(0.985, 0.335), (0.982, 0.60), (0.965, 0.80), (0.935, 0.90), (0.905, 0.962)]),       # front door, front
    ("xz", "side", [(-0.228, 0.335), (-0.228, 0.70), (-0.228, 0.985)]),                                    # B-pillar
    ("xz", "side", [(-1.0, 0.335), (-1.0, 0.58), (-1.035, 0.71), (-1.12, 0.785), (-1.30, 0.835),
                    (-1.44, 0.87), (-1.50, 0.93), (-1.505, 0.995)]),                                       # rear door, rear
    ("xz", "side", [(0.985, 0.335), (0.4, 0.335), (-0.228, 0.335), (-0.6, 0.335), (-1.0, 0.335)]),          # door bottoms
    ("xz", "side", [(2.06, 0.725), (1.97, 0.66), (1.89, 0.57), (1.845, 0.47), (1.832, 0.40)]),              # front bumper / fender
    ("xz", "side", [(-1.858, 0.40), (-1.885, 0.55), (-1.98, 0.70), (-2.12, 0.80), (-2.26, 0.855)]),         # rear bumper / fender
    ("yz", "rear", [(0.0, 0.845), (0.58, 0.845), (0.63, 0.86), (0.645, 0.90), (0.648, 0.935)]),             # trunk lid, rear face
    ("xy", "top", [(-2.445, 0.648), (-2.30, 0.676), (-2.14, 0.70), (-1.99, 0.712)]),                       # trunk lid, deck
    ("xy", "top", [(0.935, 0.80), (1.40, 0.792), (1.85, 0.768), (2.03, 0.70), (2.14, 0.56),
                   (2.19, 0.40), (2.215, 0.20), (2.222, 0.0)]),                                             # hood
]


def _densify(pts, step=0.002):
    P = np.array(pts, float)
    out = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(np.linalg.norm(b - a) / step))
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.array(out)


def _normals(G):
    du = np.gradient(G, axis=0)
    dv = np.gradient(G, axis=1)
    n = np.cross(du, dv)
    n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-12
    # orientation: outward on the +y half means positive y at the waist
    if n[len(n) // 2, G.shape[1] // 2, 1] < 0:
        n = -n
    return n


AX = {"xz": (0, 2), "xy": (0, 1), "yz": (1, 2)}


def _locate(G, N, proj, facing, pts2):
    """(u, v) grid coordinates of 2D points on the surface region facing the given way."""
    a, b = AX[proj]
    if facing == "side":
        mask = (N[..., 1] > 0.35) & (G[..., 1] > 0.45)   # the outer flank only (never near the centre line)
    elif facing == "top":
        mask = N[..., 2] > 0.3
    else:
        mask = N[..., 0] < -0.3
    P2 = G[..., [a, b]]
    ii, jj = np.nonzero(mask)
    cand = P2[ii, jj]
    out = []
    for p in pts2:
        k = int(np.argmin(np.sum((cand - p) ** 2, axis=1)))
        i0, j0 = ii[k], jj[k]
        best = None
        for di in (-1, 0):
            for dj in (-1, 0):
                i, j = i0 + di, j0 + dj
                if i < 0 or j < 0 or i + 1 >= G.shape[0] or j + 1 >= G.shape[1]:
                    continue
                q00, q10, q01, q11 = P2[i, j], P2[i + 1, j], P2[i, j + 1], P2[i + 1, j + 1]
                s, t = 0.5, 0.5
                for _ in range(8):
                    f = (1 - s) * (1 - t) * q00 + s * (1 - t) * q10 + (1 - s) * t * q01 + s * t * q11 - p
                    ds = (1 - t) * (q10 - q00) + t * (q11 - q01)
                    dt = (1 - s) * (q01 - q00) + s * (q11 - q10)
                    J = np.array([ds, dt]).T
                    try:
                        st = np.linalg.solve(J, -f)
                    except np.linalg.LinAlgError:
                        break
                    s, t = s + st[0], t + st[1]
                err = np.linalg.norm((1 - s) * (1 - t) * q00 + s * (1 - t) * q10 + (1 - s) * t * q01 + s * t * q11 - p)
                inside = -0.05 <= s <= 1.05 and -0.05 <= t <= 1.05
                score = err + (0 if inside else 1.0)
                if best is None or score < best[0]:
                    best = (score, i + np.clip(s, 0, 1), j + np.clip(t, 0, 1))
        out.append(best[1:])
    return np.array(out)


def bake(G):
    """Returns (mask RGB uint8, normal RGB uint8) images of size TH x TW (row 0 = v 0)."""
    U, V, _ = G.shape
    N = _normals(G)
    # metres per grid step around each vertex
    mu = np.linalg.norm(np.gradient(G, axis=0), axis=2)
    mv = np.linalg.norm(np.gradient(G, axis=1), axis=2)
    H = np.zeros((TH, TW), np.float32)  # groove depth 0..1
    sx, sy = (TW - 1) / (U - 1), (TH - 1) / (V - 1)  # texels per grid step
    for proj, facing, pts in SEAMS:
        P = _densify(pts)
        uv = _locate(G, N, proj, facing, P)
        for (u0, v0), (u1, v1) in zip(uv[:-1], uv[1:]):
            i, j = int(round(u0)), int(round(v0))
            i, j = min(max(i, 0), U - 1), min(max(j, 0), V - 1)
            tpm_u = sx / max(mu[i, j], 1e-5)   # texels per metre along u
            tpm_v = sy / max(mv[i, j], 1e-5)
            a0, b0, a1, b1 = u0 * sx, v0 * sy, u1 * sx, v1 * sy
            r_u, r_v = GAP_EDGE * tpm_u + 2, GAP_EDGE * tpm_v + 2
            x_lo, x_hi = int(min(a0, a1) - r_u), int(max(a0, a1) + r_u) + 1
            y_lo, y_hi = int(min(b0, b1) - r_v), int(max(b0, b1) + r_v) + 1
            x_lo, y_lo = max(x_lo, 0), max(y_lo, 0)
            x_hi, y_hi = min(x_hi, TW), min(y_hi, TH)
            if x_hi <= x_lo or y_hi <= y_lo:
                continue
            X, Y = np.meshgrid(np.arange(x_lo, x_hi) + 0.5, np.arange(y_lo, y_hi) + 0.5)
            # distance in metres to the segment
            px, py = (X - a0) / tpm_u, (Y - b0) / tpm_v
            dx, dy = (a1 - a0) / tpm_u, (b1 - b0) / tpm_v
            L2 = dx * dx + dy * dy + 1e-18
            t = np.clip((px * dx + py * dy) / L2, 0, 1)
            d = np.hypot(px - t * dx, py - t * dy)
            depth = np.clip((GAP_EDGE - d) / (GAP_EDGE - GAP_DARK), 0, 1)
            depth = depth * depth * (3 - 2 * depth)
            H[y_lo:y_hi, x_lo:x_hi] = np.maximum(H[y_lo:y_hi, x_lo:x_hi], depth)
    # colour mask: dark in the gap, a soft shadow on the rolled edges
    dark = np.clip((H - 0.55) / 0.45, 0, 1)
    col = 1.0 - 0.94 * dark - 0.25 * np.clip(H / 0.55, 0, 1) * (1 - dark)
    mask = np.clip(col * 255, 0, 255).astype(np.uint8)
    mask = np.repeat(mask[..., None], 3, axis=2)
    # normal map (OpenGL convention): slope of the groove in texel space, scaled to look ~2 mm deep
    gy, gx = np.gradient(-H * 3.0)
    nz = np.ones_like(H)
    n = np.stack([-gx, -gy, nz], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    nrm = np.clip((n * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8)
    return mask, nrm
