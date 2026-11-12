"""Curve utilities for the reference sedan (pure numpy, no Blender dependency).

Everything is in metres, Blender axes: +X forward, +Y left, +Z up. The car's half (y >= 0) is built and mirrored.
"""
import math
import numpy as np


def smooth(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smoother(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * t * (t * (6 * t - 15) + 10)


def pchip(xs, ys):
    """Monotone cubic interpolation (Fritsch-Carlson). Returns f(x) for arrays; xs may be decreasing."""
    xs = np.asarray(xs, float)
    ys = np.asarray(ys, float)
    if xs[0] > xs[-1]:
        xs, ys = xs[::-1], ys[::-1]
    h = np.diff(xs)
    d = np.diff(ys) / h
    m = np.zeros_like(ys)
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, len(xs) - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = np.asarray(x, float)
        xc = np.clip(x, xs[0], xs[-1])
        i = np.clip(np.searchsorted(xs, xc) - 1, 0, len(xs) - 2)
        t = (xc - xs[i]) / h[i]
        h00 = (2 * t ** 3 - 3 * t ** 2 + 1)
        h10 = (t ** 3 - 2 * t ** 2 + t)
        h01 = (-2 * t ** 3 + 3 * t ** 2)
        h11 = (t ** 3 - t ** 2)
        return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]

    return f


def catmull_rom(points, counts, ghost_start=None, ghost_end=None, alpha=0.5):
    """Centripetal Catmull-Rom through `points` (K x 3). counts[k] samples on span k (end point excluded except last).

    ghost_start / ghost_end: phantom points before the first / after the last control point (for tangent control).
    Returns (N x 3) samples and the spline parameter (span index + fraction) of each sample.
    """
    P = np.asarray(points, float)
    K = len(P)
    g0 = np.asarray(ghost_start, float) if ghost_start is not None else 2 * P[0] - P[1]
    g1 = np.asarray(ghost_end, float) if ghost_end is not None else 2 * P[-1] - P[-2]
    Q = np.vstack([g0, P, g1])
    out, par = [], []
    for k in range(K - 1):
        p0, p1, p2, p3 = Q[k], Q[k + 1], Q[k + 2], Q[k + 3]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** alpha
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** alpha
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** alpha
        n = counts[k]
        last = k == K - 2
        ts = np.linspace(t1, t2, n + 1 if last else n, endpoint=last)
        for t in ts:
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            c = (t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2
            out.append(c)
            par.append(k + (t - t1) / (t2 - t1))
    return np.array(out), np.array(par)


def mirror_y(p):
    q = np.array(p, float).copy()
    q[..., 1] *= -1
    return q


def superellipse_quadrant(theta, n):
    """(c, s) on a superellipse quadrant: theta 0 -> (1, 0), pi/2 -> (0, 1)."""
    c = np.cos(theta)
    s = np.sin(theta)
    e = 2.0 / n
    return np.sign(c) * np.abs(c) ** e, np.sign(s) * np.abs(s) ** e
