"""Body and glasshouse surfaces of the reference sedan as dense quad grids (numpy only).

The body is lofted through ten longitudinal "tracks" (floor, rocker, lower side, waist, shoulder crease, belt, hood/deck);
at the front and rear each track turns towards the centre line along a superellipse in plan view, so the whole half
surface ends on the mirror plane and mirrors into a closed skin. Cross-sections are centripetal Catmull-Rom splines
through the tracks, with ghost points mirrored across y = 0 so the surface stays smooth across the centre line.
"""
import math
import numpy as np
import design as D
from curves import catmull_rom, mirror_y, pchip, smooth, superellipse_quadrant


# ------------------------------------------------------------------------------------------------ body tracks
def _const(v):
    return lambda x: np.full_like(np.asarray(x, float), v)


def _top_track(y):
    def z(x):
        x = np.asarray(x, float)
        hood = D.top_height(np.maximum(x, D.X_COWL), y)
        deck = D.top_height(np.minimum(x, D.X_DECK), y)
        t = np.clip((D.X_COWL - x) / (D.X_COWL - D.X_DECK), 0, 1)
        return np.where(x >= D.X_COWL, hood, np.where(x <= D.X_DECK, deck, hood + (deck - hood) * t))
    return z


# name, Y(x), Z(x), front tip (x, z), rear tip (x, z), plan exponent front, rear, kind
_cz = D._crease_z
TRACKS = [
    ("floor_c", _const(0.0), _const(0.17), (2.195, 0.215), (-2.28, 0.31), 2.4, 2.4, "side"),
    ("floor_e", _const(0.78), _const(0.17), (2.255, 0.218), (-2.36, 0.31), 2.6, 2.6, "side"),
    ("rocker_lo", lambda x: 0.858 + D.bulge(x, 0.002), _const(0.215), (2.298, 0.235), (-2.42, 0.32), 3.0, 3.0, "side"),
    ("rocker", lambda x: 0.886 + D.bulge(x, 0.004), _const(0.27), (2.318, 0.275), (-2.425, 0.35), 3.4, 3.4, "side"),
    ("sill_crease", lambda x: 0.893 + D.bulge(x, 0.006), _const(0.325), (2.326, 0.322), (-2.455, 0.38), 3.6, 3.6, "side"),
    ("lower", lambda x: 0.905 + D.bulge(x, 0.012), _const(0.42), (2.333, 0.40), (-2.455, 0.46), 4.2, 4.0, "side"),
    ("waist", lambda x: 0.934 + D.bulge(x, 0.014), _const(0.58), (2.335, 0.52), (-2.485, 0.60), 4.8, 4.4, "side"),
    ("upper", lambda x: 0.931 + D.bulge(x, 0.012), lambda x: _cz(x) - 0.09, (2.333, 0.635), (-2.49, 0.76), 4.8, 4.4, "side"),
    ("crease_lo", lambda x: 0.925 + D.bulge(x, 0.009), lambda x: _cz(x) - 0.016, (2.328, 0.685), (-2.49, 0.86), 4.8, 4.4, "side"),
    ("crease", lambda x: 0.9215 + D.bulge(x, 0.008), _cz, (2.320, 0.705), (-2.488, 0.89), 4.6, 4.4, "side"),
    ("shoulder", lambda x: 0.905 + D.bulge(x, 0.006), lambda x: _cz(x) + 0.024, (2.318, 0.742), (-2.482, 0.94), 4.2, 4.0, "side"),
    ("belt", D.belt_y, D.belt_z, (2.298, None), (-2.47, None), 3.4, 3.4, "belt"),
    ("top_m", _const(0.46), _top_track(0.46), (2.288, None), (-2.458, None), 3.0, 3.0, "top"),
    ("top_c", _const(0.0), _top_track(0.0), (2.282, None), (-2.45, None), 2.0, 2.0, "top"),
]
SPAN_COUNTS = [10, 6, 5, 4, 8, 9, 9, 6, 3, 3, 6, 12, 10]  # samples per span between consecutive tracks
BELT_TRACK = 11


def _corner_thetas(n_samples, front):
    """Theta samples (pi/2 at the side, 0 at the centre line) spaced for even arc length on the waist track."""
    name, Yf, Zf, ftip, rtip, nf, nr, kind = TRACKS[6]
    xs = D.XS_F if front else D.XS_R
    tip_x = ftip[0] if front else rtip[0]
    n = nf if front else nr
    th = np.linspace(0, math.pi / 2, 2000)
    c, s = superellipse_quadrant(th, n)
    x = xs + (tip_x - xs) * c
    y = float(Yf(xs)) * s
    seg = np.hypot(np.diff(x), np.diff(y))
    L = np.concatenate([[0], np.cumsum(seg)])
    target = np.linspace(0, L[-1], n_samples + 1)
    return np.interp(target, L, th)  # from centre (0) to side (pi/2)


def track_points(u_desc):
    """Positions of every track at each station. u_desc: list of ('front', theta) / ('side', x) / ('rear', theta)."""
    K = len(TRACKS)
    P = np.zeros((len(u_desc), K, 3))
    for i, (zone, val) in enumerate(u_desc):
        for k, (name, Yf, Zf, ftip, rtip, nf, nr, kind) in enumerate(TRACKS):
            if zone == "side":
                x = val
                y = float(Yf(x))
                z = float(Zf(x))
            else:
                front = zone == "front"
                xs = D.XS_F if front else D.XS_R
                tip = ftip if front else rtip
                n = nf if front else nr
                c, s = superellipse_quadrant(val, n)
                x = xs + (tip[0] - xs) * c
                y = float(Yf(xs)) * s
                if kind == "side":
                    z = float(Zf(xs)) + (tip[1] - float(Zf(xs))) * float(smooth(c))
                else:
                    z = float(Zf(x))
            P[i, k] = (x, y, z)
    return P


def body_stations(n_front=64, n_side=230, n_rear=58):
    """Station list front -> rear, with exact knots at the cowl and the deck (edges of the cabin opening)."""
    tf = _corner_thetas(n_front, True)
    tr = _corner_thetas(n_rear, False)
    u = [("front", t) for t in tf[:-1]]
    xs = list(np.linspace(D.XS_F, D.XS_R, n_side))
    for knot in (D.X_COWL, D.X_DECK):
        j = int(np.argmin(np.abs(np.array(xs) - knot)))
        xs[j] = knot
    u += [("side", x) for x in xs]
    u += [("rear", t) for t in tr[::-1][1:]]
    return u


def section(points):
    """Half cross-section through the tracks of one station (bottom centre -> top centre)."""
    g0 = mirror_y(points[1])
    g1 = mirror_y(points[-2])
    pts, par = catmull_rom(points, SPAN_COUNTS, g0, g1)
    pts[0, 1] = 0.0
    pts[-1, 1] = 0.0
    return pts, par


def _grid_normals(G):
    du = np.gradient(G, axis=0)
    dv = np.gradient(G, axis=1)
    n = np.cross(du, dv)
    n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-12
    if n[len(n) // 2, G.shape[1] // 2, 1] < 0:
        n = -n
    return n


def shape_details(G):
    """Surface features applied to the lofted grid:
    - a rolled flare ring around each wheel arch (the wing swells outwards just outside the opening);
    - a recessed step across the rear bumper and round the rear corners (the boot and quarters overhang it)."""
    x, y, z = G[..., 0], G[..., 1], G[..., 2]
    side = smooth((y - 0.62) / 0.12) * smooth((z - 0.17) / 0.06)
    for ax, k in ((D.AX_F, 0.011), (D.AX_R, 0.014)):
        r = np.hypot(x - ax, z - D.TIRE_R)
        G[..., 1] += side * k * np.exp(-((r - (D.ARCH_R + 0.05)) / 0.055) ** 2)
    N = _grid_normals(G)
    rear = smooth((-1.98 - x) / 0.22) * (N[..., 0] < 0.2)
    step = 1.0 - smooth((z - 0.578) / 0.022)          # 1 below the line, 0 above
    floor = smooth((z - 0.24) / 0.06)                  # fades out at the underbody
    disp = 0.011 * rear * step * floor
    G[...] -= N * disp[..., None]


def body_grid():
    st = body_stations()
    T = track_points(st)
    secs = [section(T[i]) for i in range(len(st))]
    G = np.stack([s[0] for s in secs])  # U x V x 3
    par = secs[0][1]                    # same span parameter for every station
    # hood and trunk lid: replace the loft's top rows by the analytic height field, blended in from the fender crest
    w = smooth((par - BELT_TRACK) / 0.55)[None, :]
    x, y = G[..., 0], G[..., 1]
    on_top = (x > D.X_COWL + 0.005) | (x < D.X_DECK - 0.005)
    z_new = D.hood_height(x, y)
    G[..., 2] = np.where(on_top & (w > 0), G[..., 2] * (1 - w) + z_new * w, G[..., 2])
    shape_details(G)
    G[0, :, 1] = 0.0                    # front and rear end columns lie on the mirror plane
    G[-1, :, 1] = 0.0
    return G, par, st


# ----------------------------------------------------------------------------------------------- glasshouse
GH_COUNTS = [10, 10, 8, 10, 10]  # belt -> mid -> below rail -> above rail -> crown -> centre
GH_SIDE_SPANS = 2               # spans 0-1: side glass zone; span 2: rail corner; 3-4: roof / windscreen


def gh_section(x):
    by, bz = float(D.belt_y(x)), float(D.belt_z(x))
    ry, rz = float(D.rail_y(x)), float(D.rail_z(x))
    cz = float(D.gh_top(x))
    belt = np.array([x, by, bz])
    rail = np.array([x, ry, rz])
    d = rail - belt
    h = np.linalg.norm(d) + 1e-9
    dn = d / h
    out = np.array([0.0, dn[2], -dn[1]])       # outward normal of the side glass in the section plane
    if out[1] < 0:
        out = -out
    mid = belt + 0.5 * d + out * min(0.014, 0.05 * h)
    a = rail - dn * min(0.045, 0.3 * h) + out * min(0.004, 0.02 * h)
    roof_w = ry
    b = np.array([x, ry - min(0.06, 0.4 * roof_w), rz + (cz - rz) * 0.30 + min(0.01, 0.05 * h)])
    crown = np.array([x, ry * 0.5, rz + (cz - rz) * 0.80])
    centre = np.array([x, 0.0, cz])
    P = np.array([belt, mid, a, b, crown, centre])
    pts, par = catmull_rom(P, GH_COUNTS, None, mirror_y(crown))
    pts[-1, 1] = 0.0
    return pts, par


def c_plane(offset=0.0):
    """Plane through the raked rear edge of the rear door glass (side view line from the belt to the rail),
    shifted forward by `offset`. Returns (point, normal); the normal points forward (towards the glass)."""
    x0, x1 = D.DLO_REAR_BOTTOM, D.DLO_REAR_TOP
    z0, z1 = float(D.belt_z(x0)), float(D.rail_z(x1))
    d = np.array([x1 - x0, 0.0, z1 - z0])
    n = np.array([d[2], 0.0, -d[0]])
    n /= np.linalg.norm(n)
    if n[0] < 0:
        n = -n
    return np.array([x0, 0.0, z0]) + n * offset, n


TRIM = 0.013  # width of the chrome window surround


def gh_stations(step=0.009):
    xs = list(np.arange(D.X_COWL, D.X_DECK - 1e-6, -step))
    if abs(xs[-1] - D.X_DECK) > 1e-6:
        xs.append(D.X_DECK)
    knots = [D.DLO_FRONT, D.DLO_FRONT - TRIM, D.B_PILLAR[0], D.B_PILLAR[0] + TRIM, D.B_PILLAR[1], D.B_PILLAR[1] - TRIM,
             D.X_HEADER, D.X_HEADER + 0.04, D.X_REAR_HEADER, D.X_REAR_HEADER - 0.04, D.X_COWL - 0.035, D.X_DECK + 0.035]
    xs = np.array(xs)
    for k in knots:
        j = int(np.argmin(np.abs(xs - k)))
        xs[j] = k
    return np.sort(xs)[::-1]


def gh_grid():
    xs = gh_stations()
    secs = [gh_section(x) for x in xs]
    G = np.stack([s[0] for s in secs])
    par = secs[0][1]
    # roof, windscreen and rear window: the analytic height field, blended in just inboard of the rail corner
    w = smooth((par - (GH_SIDE_SPANS + 1.0)) / 0.7)[None, :]
    G[..., 2] = G[..., 2] * (1 - w) + D.roof_height(G[..., 0], G[..., 1]) * w
    return G, par, xs


def gh_material(xc, pc, cd):
    """Material of a glasshouse face from its centre (x, section parameter, signed distance to the C-pillar plane)."""
    side = pc < GH_SIDE_SPANS
    rail = GH_SIDE_SPANS <= pc < GH_SIDE_SPANS + 1
    if side:
        frac = pc / GH_SIDE_SPANS
        if frac < 0.09 or frac > 0.93:
            return "trim_chrome" if cd >= 0 and xc < D.DLO_FRONT else "paint"
        if xc > D.DLO_FRONT:
            return "trim_black"          # mirror sail
        if xc > D.DLO_FRONT - TRIM:
            return "trim_chrome"
        if D.B_PILLAR[1] < xc < D.B_PILLAR[0]:
            return "trim_black"          # B-pillar
        if D.B_PILLAR[0] <= xc < D.B_PILLAR[0] + TRIM or D.B_PILLAR[1] - TRIM < xc <= D.B_PILLAR[1]:
            return "trim_chrome"
        if cd < 0:
            return "paint"               # C-pillar
        if cd < TRIM:
            return "trim_chrome"
        return "glass"
    if rail:
        return "paint"
    # roof zone: windscreen, roof, rear window
    if xc > D.X_HEADER:
        edge = pc < GH_SIDE_SPANS + 1.35 or xc > D.X_COWL - 0.035 or xc < D.X_HEADER + 0.04
        return "glass_frit" if edge else "glass"
    if xc < D.X_REAR_HEADER:
        edge = pc < GH_SIDE_SPANS + 1.35 or xc < D.X_DECK + 0.035 or xc > D.X_REAR_HEADER - 0.04
        return "glass_frit" if edge else "glass"
    return "paint"
