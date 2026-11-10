// Circuits. All layouts are ORIGINAL, fictional designs (rounded polygons: straights joined by
// constant-radius corners). They are "in the spirit of" classic circuit types but are not
// reproductions of any real track, and their names are invented.
//
// The same geometry (centre line sampled every few metres, with curvature) drives the lap-time
// physics, the race simulation and the 3D/2D views, so what you see is what was simulated.

export interface TrackDef {
  id: string; name: string; country: string; km: number;
  verts: [number, number, number][]; // x, y, corner radius (units of ~100 m before scaling)
  overtake: number; abrasion: number; rain: number; pitLoss: number; elev: number; kind: string;
}

export const TRACKS: TrackDef[] = [
  { id: 'parco', name: 'Autodromo del Parco', country: 'Italy', km: 5.79, kind: 'Power circuit', overtake: 1.15, abrasion: 0.9, rain: 0.14, pitLoss: 21, elev: 4,
    verts: [[-5, 0, 2.0], [11, 0, 0.25], [11.7, 0.8, 0.25], [15, 0.8, 1.3], [17, 4, 1.5], [14.5, 7.2, 0.9], [10, 7.2, 0.25], [9.3, 8, 0.25], [6, 8, 0.9], [4.3, 6.2, 0.8], [1.5, 3.4, 0.3], [0.3, 3.6, 0.3], [-3, 2.9, 0.5], [-6, 2.6, 1.0]] },
  { id: 'silverdale', name: 'Silverdale Airfield', country: 'United Kingdom', km: 5.89, kind: 'Fast sweepers', overtake: 0.95, abrasion: 1.15, rain: 0.32, pitLoss: 20, elev: 3,
    verts: [[0, 0, 1.2], [9, 0, 1.6], [11.5, 3, 1.4], [9.5, 5.5, 0.6], [11, 7.5, 0.7], [9, 10, 1.5], [5, 10.5, 1.2], [3.5, 8, 0.5], [5.5, 6.5, 0.4], [4.5, 4.8, 0.6], [1, 5.2, 0.7], [-1.5, 8.5, 0.9], [-4, 8, 0.8], [-4.5, 3, 1.2], [-2.5, 0.5, 0.8]] },
  { id: 'riviera', name: 'Circuit de la Riviera', country: 'Monaco', km: 3.34, kind: 'Street circuit', overtake: 0.35, abrasion: 0.7, rain: 0.12, pitLoss: 19, elev: 14,
    verts: [[0, 0, 0.25], [5, 0.3, 0.3], [6.5, 2.5, 0.25], [9.5, 3, 0.2], [10.2, 5, 0.25], [8.5, 6, 0.15], [9, 7.2, 0.15], [7.5, 7.8, 0.2], [5.5, 6.2, 0.5], [2, 6.8, 0.3], [0.5, 5.5, 0.2], [1.2, 4, 0.2], [-0.8, 3.2, 0.2], [-1.5, 1, 0.3]] },
  { id: 'ardennes', name: 'Ardennes Forest Circuit', country: 'Belgium', km: 7.0, kind: 'High-speed classic', overtake: 1.2, abrasion: 1.0, rain: 0.42, pitLoss: 20, elev: 34,
    verts: [[0, 0, 0.3], [3, -1, 0.5], [6, 1.5, 1.2], [14, 6, 0.5], [15.5, 5.2, 0.5], [17, 6.5, 1.0], [16, 10, 1.5], [12, 11.5, 0.9], [10.5, 9, 0.7], [7, 9.5, 1.2], [4.5, 13, 1.0], [1, 12, 1.5], [-1, 7, 2.5], [1.5, 3.5, 0.6], [0.2, 2.2, 0.2], [1.2, 1.2, 0.2]] },
  { id: 'rheinring', name: 'Rheinring', country: 'Germany', km: 5.1, kind: 'Technical', overtake: 0.9, abrasion: 1.0, rain: 0.26, pitLoss: 19, elev: 12,
    verts: [[0, 0, 0.4], [7, 0, 0.3], [7.8, 1.5, 0.3], [6, 2.2, 0.4], [6.5, 4, 0.35], [10, 4.5, 0.6], [11, 7, 0.6], [9, 8.5, 0.5], [6, 7.5, 0.5], [4, 9, 0.5], [1, 8.5, 0.6], [1.5, 6, 0.3], [3.5, 5, 0.3], [2.5, 3, 0.4], [-1, 3.5, 0.5], [-2, 1.5, 0.6]] },
  { id: 'kiso', name: 'Kiso International', country: 'Japan', km: 5.8, kind: 'Flowing esses', overtake: 0.75, abrasion: 1.2, rain: 0.3, pitLoss: 20, elev: 16,
    verts: [[0, 0, 0.8], [6, 0, 0.9], [8, 2, 0.5], [7, 3.5, 0.5], [8.5, 5, 0.5], [7.5, 6.8, 0.6], [9.5, 8.5, 0.9], [13, 8, 0.4], [13.5, 10, 0.35], [11, 10.8, 0.3], [6, 10, 1.8], [2, 11.5, 0.4], [1, 10, 0.3], [3, 8, 1.5], [1, 5, 2.0], [-2, 3.5, 0.25], [-2.6, 2.2, 0.25], [-1.5, 0.8, 0.5]] },
  { id: 'serra', name: 'Autódromo Serra Azul', country: 'Brazil', km: 4.31, kind: 'Short & intense', overtake: 1.1, abrasion: 1.0, rain: 0.36, pitLoss: 19, elev: 20,
    verts: [[0, 0, 0.4], [5, 0.5, 0.35], [5.5, -1, 0.35], [8, -1.5, 0.9], [10, 1, 1.0], [8, 4, 1.2], [9, 6.5, 0.5], [7, 8, 0.5], [5.5, 6, 0.4], [3.5, 7.5, 0.4], [2, 5.5, 0.5], [3.5, 3.5, 0.4], [1, 2.5, 0.6], [-2, 4, 0.7], [-3.5, 1.5, 1.2]] },
  { id: 'lakeshore', name: 'Lakeshore Park', country: 'Australia', km: 5.3, kind: 'Parkland semi-street', overtake: 0.7, abrasion: 0.85, rain: 0.2, pitLoss: 19, elev: 2,
    verts: [[0, 0, 0.5], [6, 0, 0.35], [6.6, 1, 0.35], [9, 1.2, 0.6], [10.5, 3.5, 0.8], [9.5, 6, 0.4], [10.2, 7, 0.4], [9, 9, 1.2], [5, 10, 0.3], [4.4, 9, 0.3], [2, 9, 1.0], [-0.5, 7, 0.9], [0, 4.5, 0.3], [-1, 3.8, 0.3], [-2, 1.5, 0.9]] },
  { id: 'pearl', name: 'Desert Pearl Circuit', country: 'Bahrain', km: 5.41, kind: 'Long straights, heavy braking', overtake: 1.25, abrasion: 1.3, rain: 0.02, pitLoss: 22, elev: 6,
    verts: [[0, 0, 0.3], [11, 0, 0.25], [11.8, 1.2, 0.3], [10, 2.2, 0.3], [10.5, 4, 0.6], [14, 5, 0.3], [13.5, 7, 0.3], [6, 6.5, 0.3], [5.5, 4.5, 0.5], [3, 4.5, 0.5], [2.5, 8, 0.4], [0.5, 8.5, 0.5], [-1.5, 6, 1.0], [-2, 2, 0.5]] },
  { id: 'redrock', name: 'Red Rock Raceway', country: 'United States', km: 5.51, kind: 'Rollercoaster', overtake: 1.0, abrasion: 1.1, rain: 0.1, pitLoss: 20, elev: 28,
    verts: [[0, 0, 0.35], [9, 1, 0.5], [10, 3, 0.5], [12.5, 3.5, 0.5], [13.5, 6, 0.6], [12, 7.5, 0.6], [13, 9.5, 0.6], [11.5, 11, 0.7], [7, 10, 0.3], [6.5, 8, 0.4], [4, 7.5, 0.5], [3, 10, 0.5], [0.5, 10.5, 0.6], [-1, 8, 1.0], [0.5, 5, 1.0], [-1.5, 2, 0.6]] },
  { id: 'ouest', name: "Circuit de l'Ouest", country: 'France', km: 13.6, kind: 'Endurance classic', overtake: 1.3, abrasion: 0.8, rain: 0.3, pitLoss: 30, elev: 12,
    verts: [[-3, -1, 0.8], [5, 0, 0.5], [7, 2.5, 0.5], [9.5, 3, 1.2], [12, 6, 0.9], [18, 14, 0.3], [18.9, 14.4, 0.3], [24.9, 22.4, 0.3], [25.3, 23.3, 0.3], [30, 29.6, 0.35], [33, 25, 1.5], [30, 18, 0.5], [31, 16, 0.3], [26, 11, 1.5], [24, 5, 1.2], [19, 2, 1.5], [14, -4, 1.2], [6, -5, 0.35], [5.2, -4, 0.3], [0, -4.5, 0.35], [-0.8, -3.4, 0.3], [-3.5, -3.6, 0.8]] },
  { id: 'catalan', name: 'Circuit dels Turons', country: 'Spain', km: 4.68, kind: 'Balanced test track', overtake: 0.8, abrasion: 1.25, rain: 0.1, pitLoss: 21, elev: 15,
    verts: [[0, 0, 0.6], [9, 0, 0.5], [10.5, 2, 0.6], [8.5, 3.5, 0.9], [10, 6, 1.0], [8, 8.5, 0.5], [5, 7.5, 0.4], [4.5, 5.5, 0.5], [2, 5, 0.5], [1.5, 8, 0.6], [-1, 8.5, 0.6], [-2.5, 6, 0.4], [-1, 4, 0.3], [-2.2, 3, 0.25], [-2.5, 1.2, 0.6]] },
];
export const TRACK: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

export interface TrackGeom {
  id: string; n: number; ds: number; length: number;
  x: Float32Array; z: Float32Array; y: Float32Array; // world metres (y up)
  curv: Float32Array; // 1/m, unsigned
  hx: Float32Array; hz: Float32Array; // unit tangent
  zones: [number, number][]; // overtaking zones as sample index ranges (long straights + the braking zone after them)
  zoneOf: Int16Array; // sample -> zone index or -1
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pitExitS: number;
}

const cache = new Map<string, TrackGeom>();

export function trackGeom(id: string): TrackGeom {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = TRACK[id];
  // 1) rounded polygon -> dense polyline
  const V = def.verts, m = V.length;
  const pts: [number, number][] = [];
  for (let i = 0; i < m; i++) {
    const A = V[(i + m - 1) % m], B = V[i], C = V[(i + 1) % m];
    let ux = A[0] - B[0], uy = A[1] - B[1], vx = C[0] - B[0], vy = C[1] - B[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const cos = Math.max(-0.9999, Math.min(0.9999, ux * vx + uy * vy));
    const theta = Math.acos(cos); // interior angle
    const tanH = Math.tan(theta / 2);
    let r = B[2];
    let d = r / tanH;
    const dMax = 0.47 * Math.min(lu, lv);
    if (d > dMax) { d = dMax; r = d * tanH; }
    const bx = ux + vx, by = uy + vy, bl = Math.hypot(bx, by) || 1;
    const cdist = r / Math.sin(theta / 2);
    const cx = B[0] + (bx / bl) * cdist, cy = B[1] + (by / bl) * cdist;
    const t1x = B[0] + ux * d, t1y = B[1] + uy * d, t2x = B[0] + vx * d, t2y = B[1] + vy * d;
    let a1 = Math.atan2(t1y - cy, t1x - cx), a2 = Math.atan2(t2y - cy, t2x - cx);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(3, Math.ceil(Math.abs(da) * r / 0.04));
    for (let k = 0; k <= steps; k++) { const a = a1 + (da * k) / steps; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  // 2) scale to the nominal lap length and resample uniformly
  let raw = 0;
  for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; raw += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); }
  const length = def.km * 1000;
  const sc = length / raw;
  const n = Math.round(length / 6);
  const ds = length / n;
  const x = new Float32Array(n), z = new Float32Array(n);
  let seg = 0, segStart = 0;
  let segLen = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * sc;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    while (s > segStart + segLen && seg < pts.length - 1) { segStart += segLen; seg++; const q = pts[(seg + 1) % pts.length]; segLen = Math.hypot(q[0] - pts[seg][0], q[1] - pts[seg][1]) * sc || 1e-6; }
    const f = Math.min(1, (s - segStart) / segLen);
    const p = pts[seg], q = pts[(seg + 1) % pts.length];
    x[i] = (p[0] + (q[0] - p[0]) * f) * sc; z[i] = -(p[1] + (q[1] - p[1]) * f) * sc;
  }
  // 3) rotate the sample origin onto the first straight (start/finish line ~40% along it)
  const v0 = V[0], v1 = V[1];
  const sx = (v0[0] + (v1[0] - v0[0]) * 0.42) * sc, sz = -(v0[1] + (v1[1] - v0[1]) * 0.42) * sc;
  let bestI = 0, bestD = 1e18;
  for (let i = 0; i < n; i++) { const dd = (x[i] - sx) ** 2 + (z[i] - sz) ** 2; if (dd < bestD) { bestD = dd; bestI = i; } }
  const rx = new Float32Array(n), rz = new Float32Array(n);
  for (let i = 0; i < n; i++) { rx[i] = x[(i + bestI) % n]; rz[i] = z[(i + bestI) % n]; }
  // 4) light smoothing to blend straight↔arc transitions, then curvature from three points
  for (let pass = 0; pass < 3; pass++) {
    const tx = rx.slice(), tz = rz.slice();
    for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n; rx[i] = 0.25 * tx[a] + 0.5 * tx[i] + 0.25 * tx[b]; rz[i] = 0.25 * tz[a] + 0.5 * tz[i] + 0.25 * tz[b]; }
  }
  const curv = new Float32Array(n), hx = new Float32Array(n), hz = new Float32Array(n), y = new Float32Array(n);
  const k = 3;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const a = (i + n - k) % n, b = (i + k) % n;
    const ax = rx[a], az = rz[a], bx = rx[i], bz = rz[i], cx = rx[b], cz = rz[b];
    const ab = Math.hypot(bx - ax, bz - az), bc = Math.hypot(cx - bx, cz - bz), ca = Math.hypot(ax - cx, az - cz);
    const area2 = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
    curv[i] = ab * bc * ca > 1e-9 ? (2 * area2) / (ab * bc * ca) : 0;
    const tl = Math.hypot(cx - ax, cz - az) || 1;
    hx[i] = (cx - ax) / tl; hz[i] = (cz - az) / tl;
    const u = i / n;
    y[i] = def.elev * 0.5 * (Math.sin(2 * Math.PI * u + def.km) + 0.45 * Math.sin(4 * Math.PI * u + 1.3 * def.km) + 1.2);
    minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); minZ = Math.min(minZ, bz); maxZ = Math.max(maxZ, bz);
  }
  // 5) overtaking zones: straights longer than 350 m, extended 120 m into the braking zone
  const zones: [number, number][] = [];
  const zoneOf = new Int16Array(n).fill(-1);
  const straight = (i: number) => curv[((i % n) + n) % n] < 1 / 500;
  let start = 0;
  while (start < n && straight(start)) start++; // begin scanning from a corner
  for (let j = 0; j < n;) {
    const i = start + j;
    if (!straight(i)) { j++; continue; }
    let len = 0;
    while (len < n && straight(i + len)) len++;
    if (len * ds > 350) {
      const a = (i + Math.floor(len * 0.35)) % n, b = (i + len + Math.round(120 / ds)) % n;
      zones.push([a, b]);
      for (let q = a; q !== b; q = (q + 1) % n) zoneOf[q] = zones.length - 1;
    }
    j += len;
  }
  const geom: TrackGeom = { id, n, ds, length, x: rx, z: rz, y, curv, hx, hz, zones, zoneOf, bounds: { minX, maxX, minZ, maxZ }, pitExitS: Math.min(420, length * 0.06) };
  cache.set(id, geom);
  return geom;
}

/** World position (and heading) at distance s along the lap, with lateral offset (positive = right). */
export function trackPos(g: TrackGeom, s: number, lateral = 0, out: { x: number; y: number; z: number; hx: number; hz: number } = { x: 0, y: 0, z: 0, hx: 1, hz: 0 }) {
  const u = ((s % g.length) + g.length) % g.length / g.ds;
  const i = Math.floor(u) % g.n, j = (i + 1) % g.n, f = u - Math.floor(u);
  const hx = g.hx[i] + (g.hx[j] - g.hx[i]) * f, hz = g.hz[i] + (g.hz[j] - g.hz[i]) * f;
  out.x = g.x[i] + (g.x[j] - g.x[i]) * f - hz * lateral;
  out.z = g.z[i] + (g.z[j] - g.z[i]) * f + hx * lateral;
  out.y = g.y[i] + (g.y[j] - g.y[i]) * f;
  out.hx = hx; out.hz = hz;
  return out;
}
