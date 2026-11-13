"""Design of the reference sedan: an original four-door executive saloon ("Empire E-class reference").

Proportions are typical of a modern mid-size premium saloon (about 4.87 m long, 2.90 m wheelbase) but the shapes are
our own: no production car was traced or copied.
All dimensions in metres; Blender axes (+X forward, +Y left, +Z up); ground at z = 0.
"""
import numpy as np
from curves import cspline, pchip, smooth

# ------------------------------------------------------------------------------------------- package
WHEELBASE = 2.90
AX_F = 1.45            # front axle x
AX_R = AX_F - WHEELBASE
TRACK_F = 1.62
TRACK_R = 1.63
TIRE_R = 0.339         # 245/40 R19
TIRE_W = 0.245
RIM_D = 19 * 0.0254
ARCH_R = 0.378         # wheel-arch opening radius
X_FRONT = 2.335
X_REAR = -2.49
HALF_W = 0.932         # body half width (without mirrors)
CLEARANCE = 0.155

# side region (full width) and the corner zones
XS_F = 1.98
XS_R = -2.14

# cabin opening in the body / greenhouse extent
X_COWL = 0.90
X_DECK = -1.96


def bulge(x, k):
    """Wheel-arch muscle: fenders swell around the axles."""
    return k * (0.65 * np.exp(-((x - AX_F) / 0.42) ** 2) + 1.0 * np.exp(-((x - AX_R) / 0.48) ** 2))


# hood (front) and deck (rear) centre heights; the cabin region is open in the body
_hood_c = cspline([X_FRONT - 0.10, 2.05, 1.70, 1.30, X_COWL - 0.02], [0.785, 0.815, 0.86, 0.905, 0.935])
_deck_c = cspline([X_DECK + 0.02, -2.16, -2.34, -2.44], [1.034, 1.042, 1.047, 1.049])


def top_centre(x):
    x = np.asarray(x, float)
    return np.where(x > 0, _hood_c(x), _deck_c(x))


def top_height(x, y):
    """Hood / deck surface height at plan position (x, y): centre height minus a cross crown."""
    x = np.asarray(x, float)
    crown = np.where(x > 0, 0.028, 0.018)
    return top_centre(x) - crown * (np.asarray(y) / 0.86) ** 2


# belt line (top of the doors / base of the side glass) — rises towards the rear (wedge)
_belt_z = cspline([X_FRONT - 0.07, 2.0, 1.4, X_COWL, -0.4, X_DECK, XS_R, X_REAR + 0.03], [0.772, 0.828, 0.897, 0.958, 0.988, 1.016, 1.024, 1.028])
_belt_y = cspline([XS_F, 1.2, X_COWL, -0.5, X_DECK, XS_R], [0.85, 0.868, 0.876, 0.874, 0.858, 0.85])
_crease_z = cspline([XS_F, 1.0, -1.0, XS_R], [0.845, 0.856, 0.872, 0.888])


def belt_z(x):
    return _belt_z(x)


def belt_y(x):
    return _belt_y(x)


# --------------------------------------------------------------------------------------- greenhouse
# centre line of the glasshouse: windshield (cowl -> header), roof, rear window (-> deck)
_gh_top = cspline(
    [X_COWL, 0.66, 0.42, 0.18, -0.02, -0.26, -0.62, -0.96, -1.20, -1.44, -1.70, X_DECK],
    [0.935, 1.05, 1.165, 1.28, 1.365, 1.42, 1.446, 1.436, 1.400, 1.29, 1.15, 1.036],
)
X_HEADER = -0.08      # top of the windshield
X_REAR_HEADER = -1.19 # top of the rear window


def gh_top(x):
    return _gh_top(x)


# roof rail (top of the side glass / A- and C-pillar line): lateral position and height drop from the centre
_rail_y = cspline([X_COWL, 0.48, X_HEADER, -0.6, X_REAR_HEADER, -1.58, X_DECK], [0.848, 0.79, 0.712, 0.70, 0.70, 0.75, 0.82])


def rail_y(x):
    return _rail_y(x)


def sweep(x):
    """Plan sweep of the glass corners relative to the centre line (m, + = corner further back):
    the windscreen corners trail the centre, the rear-window corners lead it; both fade smoothly into the roof."""
    x = np.asarray(x, float)
    f = 0.13 * smooth((x - (X_HEADER - 0.6)) / 0.6)
    r = -0.10 * smooth(((X_REAR_HEADER + 0.6) - x) / 0.6)
    return f + r


def rail_z(x):
    """Height of the roof rail: the centre profile, shifted by the corner sweep, minus the roof's cross crown.
    Because it is the same smooth profile, the side silhouette has no hump or dip at the headers."""
    x = np.asarray(x, float)
    xs = np.clip(x - sweep(x), X_DECK, X_COWL)
    return np.maximum(gh_top(xs) - 0.034, belt_z(x) + 0.004)


# side windows (daylight opening), side view (x) limits
DLO_FRONT = 0.76       # front end of the front door glass (behind the mirror sail)
B_PILLAR = (-0.18, -0.275)
DLO_REAR_BOTTOM = -1.50  # rear end of the rear door glass at the belt
DLO_REAR_TOP = -1.17     # ... and at the rail (raked C-pillar)

# lamps (outlines in front / rear view: y, z)
HEADLAMP = [(0.42, 0.722), (0.52, 0.692), (0.70, 0.682), (0.82, 0.694), (0.878, 0.73), (0.865, 0.768), (0.70, 0.772), (0.52, 0.766), (0.42, 0.75)]
TAILLAMP = [(0.26, 0.946), (0.55, 0.936), (0.78, 0.912), (0.90, 0.884), (0.945, 0.905), (0.94, 0.975), (0.90, 1.004), (0.72, 1.011), (0.42, 1.013), (0.26, 1.006)]
GRILLE = [(0.0, 0.41), (0.34, 0.41), (0.45, 0.425), (0.49, 0.465), (0.497, 0.60), (0.475, 0.645), (0.385, 0.668), (0.0, 0.675)]
LOWER_INTAKE = [(0.0, 0.25), (0.36, 0.25), (0.44, 0.27), (0.42, 0.355), (0.30, 0.372), (0.0, 0.372)]


# ------------------------------------------------------------------------------- analytic top surfaces
def hood_height(x, y):
    """Hood and trunk-lid top as one smooth height field (C2 centre profile, parabolic cross crown)."""
    return top_height(x, y)


def roof_height(x, y):
    """Roof, windscreen and rear-window top as one smooth height field. At the rail (|y| = rail_y) it equals
    rail_z exactly: the corner sweep grows with the square of the lateral position, like a swept windscreen."""
    x = np.asarray(x, float)
    ry = rail_y(x)
    t = np.clip(np.abs(y) / ry, 0, 1) ** 2
    xs = np.clip(x - sweep(x) * t, X_DECK, X_COWL)
    return gh_top(xs) - 0.034 * t
