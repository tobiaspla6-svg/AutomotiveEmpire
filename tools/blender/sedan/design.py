"""Design of the reference sedan: an original four-door executive saloon ("Empire E-class reference").

Proportions are typical of a modern mid-size premium saloon (about 4.87 m long, 2.90 m wheelbase) but the shapes are
our own: no production car was traced or copied.
All dimensions in metres; Blender axes (+X forward, +Y left, +Z up); ground at z = 0.
"""
import numpy as np
from curves import pchip, smooth

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
_hood_c = pchip([X_FRONT - 0.10, 2.05, 1.70, 1.30, X_COWL - 0.02], [0.785, 0.815, 0.86, 0.905, 0.935])
_deck_c = pchip([X_DECK + 0.02, -2.16, -2.34, -2.44], [1.034, 1.042, 1.047, 1.049])


def top_centre(x):
    x = np.asarray(x, float)
    return np.where(x > 0, _hood_c(x), _deck_c(x))


def top_height(x, y):
    """Hood / deck surface height at plan position (x, y): centre height minus a cross crown."""
    x = np.asarray(x, float)
    crown = np.where(x > 0, 0.028, 0.018)
    return top_centre(x) - crown * (np.asarray(y) / 0.86) ** 2


# belt line (top of the doors / base of the side glass) — rises towards the rear (wedge)
_belt_z = pchip([X_FRONT - 0.07, 2.0, 1.4, X_COWL, -0.4, X_DECK, XS_R, X_REAR + 0.03], [0.772, 0.828, 0.897, 0.958, 0.988, 1.016, 1.024, 1.028])
_belt_y = pchip([XS_F, 1.2, X_COWL, -0.5, X_DECK, XS_R], [0.85, 0.868, 0.876, 0.874, 0.858, 0.85])
_crease_z = pchip([XS_F, 1.0, -1.0, XS_R], [0.845, 0.856, 0.872, 0.888])


def belt_z(x):
    return _belt_z(x)


def belt_y(x):
    return _belt_y(x)


# --------------------------------------------------------------------------------------- greenhouse
# centre line of the glasshouse: windshield (cowl -> header), roof, rear window (-> deck)
_gh_top = pchip(
    [X_COWL, 0.66, 0.42, 0.18, -0.02, -0.26, -0.62, -0.96, -1.20, -1.44, -1.70, X_DECK],
    [0.935, 1.05, 1.165, 1.28, 1.365, 1.42, 1.446, 1.436, 1.400, 1.29, 1.15, 1.036],
)
X_HEADER = -0.08      # top of the windshield
X_REAR_HEADER = -1.19 # top of the rear window


def gh_top(x):
    return _gh_top(x)


# roof rail (top of the side glass / A- and C-pillar line): lateral position and height drop from the centre
_rail_y = pchip([X_COWL, 0.48, X_HEADER, -0.6, X_REAR_HEADER, -1.58, X_DECK], [0.848, 0.79, 0.712, 0.70, 0.70, 0.75, 0.82])


def rail_y(x):
    return _rail_y(x)


def rail_z(x):
    """Height of the roof rail: in the windshield and rear-window zones the glass is swept in plan,
    so at a given x the corners sit higher than the centre."""
    x = np.asarray(x, float)
    zc = gh_top(x)
    ws = smooth((x - X_HEADER) / 0.25)          # 1 in the windshield zone
    rw = smooth((X_REAR_HEADER - x) / 0.25)     # 1 in the rear-window zone
    sweep_f = gh_top(np.minimum(x - 0.13, X_COWL)) - zc   # corners 13 cm further back
    sweep_r = gh_top(np.maximum(x + 0.10, X_DECK)) - zc
    z = zc - 0.038 + ws * (sweep_f + 0.03) + rw * (sweep_r + 0.02)
    return np.maximum(z, belt_z(x) + 0.004)


# side windows (daylight opening), side view (x) limits
DLO_FRONT = 0.76       # front end of the front door glass (behind the mirror sail)
B_PILLAR = (-0.18, -0.275)
DLO_REAR_BOTTOM = -1.50  # rear end of the rear door glass at the belt
DLO_REAR_TOP = -1.17     # ... and at the rail (raked C-pillar)

# lamps (outlines in front / rear view: y, z)
HEADLAMP = [(0.42, 0.722), (0.52, 0.692), (0.70, 0.682), (0.82, 0.694), (0.878, 0.73), (0.865, 0.768), (0.70, 0.772), (0.52, 0.766), (0.42, 0.75)]
TAILLAMP = [(0.24, 0.952), (0.55, 0.944), (0.78, 0.922), (0.905, 0.898), (0.935, 0.93), (0.915, 0.99), (0.72, 1.008), (0.42, 1.012), (0.24, 1.006)]
GRILLE = [(0.0, 0.417), (0.3, 0.417), (0.42, 0.442), (0.47, 0.512), (0.45, 0.632), (0.36, 0.664), (0.0, 0.667)]
LOWER_INTAKE = [(0.0, 0.245), (0.52, 0.245), (0.62, 0.275), (0.60, 0.345), (0.50, 0.365), (0.0, 0.365)]
