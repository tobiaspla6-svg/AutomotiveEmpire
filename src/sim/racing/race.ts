// Deterministic race simulation.
//
// Every car follows its own physically derived speed profile around the circuit (lapsim.ts),
// scaled lap by lap for fuel load, tyre compound and wear, weather, driver and engine mode.
// The simulation advances in fixed 0.5 s steps from a seeded RNG, so the same seed and the same
// player inputs always produce the same race. The 2D/3D views only ever *read* this state.
import type { CarResult, Driver } from '../types';
import { chance, gauss, makeRng, pick, rnd, rndRange, type Rng } from '../rng';
import { clamp } from '../util';
import { lapSim } from './lapsim';
import type { RaceCarPerf } from './racecar';
import type { Regs, TyreCompound } from './regs';
import { TRACK, trackGeom, type TrackDef, type TrackGeom } from './tracks';

export type Mode = 'conserve' | 'normal' | 'push';
export interface RaceEntry {
  id: string; teamId: string; teamName: string; carIdx: number; number: number; color: string; color2: string; isPlayer: boolean;
  drivers: Driver[]; perf: RaceCarPerf; pitCrew: number; strategy: number; wing: number; startCompound?: string; auto: boolean;
}
export interface Shower { start: number; end: number; intensity: number }
export interface Weather { showers: Shower[]; initialWet: number; label: string; forecast: string }
export interface RaceConfig {
  seed: number; trackId: string; regs: Regs; year: number; name: string;
  laps: number; duration: number; // laps > 0: distance race; otherwise timed (seconds)
  entries: RaceEntry[]; weather: Weather; pointsScale: number;
}
export interface LogItem { t: number; lap: number; text: string; kind: 'info' | 'pit' | 'pass' | 'dnf' | 'weather' | 'flag' | 'player' }

export interface CarState {
  e: RaceEntry; idx: number;
  dist: number; prevDist: number; v: number; laps: number; lapStartT: number; lastLap: number; bestLap: number; pitLap: boolean;
  compound: TyreCompound; wear: number; tyreKm: number; usedDry: string[];
  fuel: number; mode: Mode; status: 'run' | 'pit' | 'out' | 'fin'; outReason: string;
  pitReq: { compound: string; fuel: number; tyres: boolean } | null; pitStart: number; pitEnd: number; pitStartDist: number; stops: number;
  driverIdx: number; driverSince: number;
  noise: number; lose: number; damage: number;
  passing: number; passUntil: number; attemptKey: number; noAttemptUntil: number; blocked: boolean;
  auto: boolean; plan: number[]; planComp: string[]; wearLimit: number;
  T0: number; dTdm: number; fuelPerLap: number; prof: Float32Array; vTop: number;
  finishT: number; startDelay: number; pen: number; grid: number; wrongTyre: number; lowFuel: boolean;
}

/** Lap-time penalty (fraction) of each tyre family as a function of track wetness 0..1. */
export function wetPenalty(type: 0 | 1 | 2, w: number): number {
  if (type === 0) return 0.12 * w + 0.6 * w * w;
  if (type === 1) return 0.05 + 0.6 * (w - 0.3) * (w - 0.3);
  return 0.09 + 0.3 * (w - 0.7) * (w - 0.7);
}
export const wearPenalty = (w: number) => 0.012 * w + (w > 0.75 ? 0.4 * (w - 0.75) * (w - 0.75) : 0);
const wearPenaltyAvg = (W: number) => 0.006 * W + (W > 0.75 ? ((0.4 / 3) * Math.pow(W - 0.75, 3)) / W : 0);
const MODE = { conserve: { pace: 0.005, wear: 0.75, fuel: 0.94, haz: 0.6 }, normal: { pace: 0, wear: 1, fuel: 1, haz: 1 }, push: { pace: -0.0035, wear: 1.35, fuel: 1.04, haz: 1.5 } } as const;

export function makeWeather(track: TrackDef, duration: number, rng: Rng): Weather {
  const showers: Shower[] = [];
  let initialWet = 0;
  const wetDay = chance(rng, track.rain);
  if (wetDay) {
    const n = duration > 3 * 3600 ? 1 + Math.floor(rnd(rng) * 3) : 1 + (chance(rng, 0.25) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const start = rndRange(rng, -0.1, 0.85) * duration;
      const len = rndRange(rng, 0.12, 0.4) * Math.min(duration, 5400);
      showers.push({ start, end: start + len, intensity: rndRange(rng, 0.35, 1) });
    }
    if (showers.some((s) => s.start <= 0)) initialWet = clamp(0.25 + 0.5 * showers.find((s) => s.start <= 0)!.intensity, 0, 0.9);
  } else if (chance(rng, 0.12) && duration > 3 * 3600) {
    const start = rndRange(rng, 0.3, 0.8) * duration;
    showers.push({ start, end: start + rndRange(rng, 900, 2400), intensity: rndRange(rng, 0.3, 0.7) });
  }
  showers.sort((a, b) => a.start - b.start);
  const first = showers.find((s) => s.start > 0);
  const pct = (x: number) => Math.round((x / duration) * 100);
  const label = initialWet > 0.2 ? 'Wet start' : showers.length ? 'Unsettled' : 'Dry';
  const forecast = initialWet > 0.2 ? `Rain at the start (intensity ${Math.round(showers[0].intensity * 100)}%), expected to ease after about ${Math.max(5, pct(showers[0].end))}% distance.`
    : first ? `Dry start. Rain is likely around ${pct(first.start)}% race distance.` : 'Dry and stable. No rain expected.';
  return { showers, initialWet, label, forecast };
}

export class RaceSim {
  cfg: RaceConfig; geom: TrackGeom; track: TrackDef; L: number; rng: Rng;
  cars: CarState[] = [];
  t = 0; dt = 0.5; finished = false; leaderDone = false; leaderFinishT = 0;
  wetness = 0; rain = 0; vsc = 0;
  log: LogItem[] = [];
  fastest: { idx: number; time: number } = { idx: -1, time: Infinity };
  qualifying: { id: string; time: number }[] = [];
  private byTrack: CarState[] = [];
  private lapKm: number;

  constructor(cfg: RaceConfig) {
    this.cfg = cfg;
    this.track = TRACK[cfg.trackId];
    this.geom = trackGeom(cfg.trackId);
    this.L = this.geom.length;
    this.lapKm = this.L / 1000;
    this.rng = makeRng(cfg.seed);
    this.wetness = cfg.weather.initialWet;
    const regs = cfg.regs;
    const dryList = regs.tyres.filter((x) => x.wetType === 0);
    // per-car physics
    const pre = cfg.entries.map((e) => {
      const base = { powerW: e.perf.powerKw * 1000 * 0.9, cdA: e.perf.cdA, clA: e.perf.clA, mu: e.perf.mu, awd: e.perf.awd };
      const r0 = lapSim(this.geom, { ...base, mass: e.perf.mass });
      const r1 = lapSim(this.geom, { ...base, mass: e.perf.mass + 60 });
      return { e, r0, dTdm: (r1.time - r0.time) / 60, fuelPerLap: r0.energyKwh * e.perf.fuelKgPerKwh };
    });
    // qualifying: one low-fuel lap on the softest tyre
    const wetQ = this.wetness > 0.25;
    const q = pre.map((p) => {
      const d = p.e.drivers[0];
      const pen = dryList[0].delta + (88 - d.pace) * 0.0005 + gauss(this.rng) * 0.0022 + (wetQ ? wetPenalty(1, this.wetness) + (85 - d.wet) * 0.0012 : 0);
      return { p, time: p.r0.time * (1 + pen) + p.dTdm * 8 };
    }).sort((a, b) => a.time - b.time);
    this.qualifying = q.map((x) => ({ id: x.p.e.id, time: x.time }));
    const raceLaps = cfg.laps || Math.round(cfg.duration / q[0].time);
    q.forEach((x, gridPos) => {
      const { e, r0, dTdm, fuelPerLap } = x.p;
      const c: CarState = {
        e, idx: this.cars.length, dist: -(8 * gridPos + 4), prevDist: 0, v: 0, laps: 0, lapStartT: 0, lastLap: 0, bestLap: Infinity, pitLap: false,
        compound: dryList[Math.min(1, dryList.length - 1)], wear: 0, tyreKm: 0, usedDry: [], fuel: 0, mode: 'normal', status: 'run', outReason: '',
        pitReq: null, pitStart: 0, pitEnd: 0, pitStartDist: 0, stops: 0, driverIdx: 0, driverSince: 0, noise: 0, lose: 0, damage: 0,
        passing: -1, passUntil: 0, attemptKey: -1, noAttemptUntil: 0, blocked: false, auto: e.auto, plan: [], planComp: [],
        wearLimit: clamp(0.8 + (e.strategy - 60) / 400 + (rnd(this.rng) - 0.5) * 0.08, 0.68, 0.95),
        T0: r0.time, dTdm, fuelPerLap, prof: r0.v, vTop: r0.vMax, finishT: 0,
        startDelay: 0.15 + rnd(this.rng) * 0.35 + (100 - e.drivers[0].racecraft) * 0.004 + gridPos * 0.04, pen: 0, grid: gridPos + 1, wrongTyre: 0, lowFuel: false,
      };
      c.prevDist = c.dist;
      this.planStrategy(c, raceLaps);
      if (e.startCompound) { const sc = regs.tyres.find((y) => y.id === e.startCompound); if (sc) c.compound = sc; }
      if (c.compound.wetType === 0) c.usedDry.push(c.compound.id);
      const need = fuelPerLap * (raceLaps + 1.2) * 1.02;
      c.fuel = regs.refuel ? Math.min(regs.tankKg, c.plan.length ? fuelPerLap * (c.plan[0] + 1.3) : need) : need;
      this.cars.push(c);
    });
    this.say(`${cfg.name}: ${cfg.laps ? cfg.laps + ' laps' : (cfg.duration / 3600).toFixed(0) + ' hours'} at ${this.track.name}. ${cfg.weather.forecast}`, 'info');
    const pole = this.cars[0];
    this.say(`Pole position: ${pole.e.drivers[0].name} (${pole.e.teamName}).`, 'info');
  }

  private say(text: string, kind: LogItem['kind']) {
    this.log.push({ t: this.t, lap: this.leaderLaps(), text, kind });
    if (this.log.length > 600) this.log.splice(0, 100);
  }
  leaderLaps(): number { let m = 0; for (const c of this.cars) if (c.status !== 'out' && c.laps > m) m = c.laps; return m; }
  private driver(c: CarState): Driver { return c.e.drivers[c.driverIdx % c.e.drivers.length]; }
  private name(c: CarState): string { return `${this.driver(c).name} (#${c.e.number})`; }

  /** Choose the number of stops and compounds that minimise estimated race time (dry, distance races). */
  private planStrategy(c: CarState, raceLaps: number) {
    const regs = this.cfg.regs;
    const dryList = regs.tyres.filter((x) => x.wetType === 0);
    if (this.wetness > 0.21) { c.compound = regs.tyres.find((x) => x.wetType === (this.wetness > 0.56 ? 2 : 1))!; }
    if (!this.cfg.laps) { c.compound = this.wetness > 0.21 ? c.compound : dryList[Math.min(1, dryList.length - 1)]; return; }
    const raceKm = raceLaps * this.lapKm;
    const wearK = this.track.abrasion * c.e.perf.tyreWear * (1.15 - this.driver(c).tyre / 320);
    const stationary = regs.tyreChange * (1.25 - c.e.pitCrew / 200) + (regs.refuel ? 4 : 0);
    let best: { n: number; comps: TyreCompound[]; time: number } | null = null;
    for (let n = 0; n <= 3; n++) {
      if (regs.twoCompound && n === 0 && dryList.length > 1) continue;
      const stintKm = raceKm / (n + 1);
      const ranked = dryList.map((cp) => ({ cp, pen: cp.delta + wearPenaltyAvg((stintKm * wearK) / cp.lifeKm) })).sort((a, b) => a.pen - b.pen);
      const comps = Array.from({ length: n + 1 }, () => ranked[0].cp);
      let pen = ranked[0].pen * (n + 1);
      if (regs.twoCompound && n >= 1 && ranked.length > 1) { comps[n] = ranked[1].cp; pen += ranked[1].pen - ranked[0].pen; }
      const fuelAvg = regs.refuel ? (c.fuelPerLap * raceLaps) / (n + 1) / 2 : 0;
      const time = raceLaps * c.T0 * (pen / (n + 1)) + n * (this.track.pitLoss + stationary) + fuelAvg * c.dTdm * raceLaps + (rnd(this.rng) - 0.5) * (130 - c.e.strategy) * 0.08;
      if (!best || time < best.time) best = { n, comps, time };
    }
    if (!best) return;
    if (regs.twoCompound && best.comps.length > 1 && chance(this.rng, 0.5)) best.comps.reverse(); // some start on the harder tyre
    c.plan = Array.from({ length: best.n }, (_, i) => Math.max(1, Math.round(((i + 1) * raceLaps) / (best!.n + 1) + (rnd(this.rng) - 0.5) * 3)));
    c.planComp = best.comps.map((x) => x.id);
    if (this.wetness <= 0.21) c.compound = best.comps[0];
  }

  private updateWeather() {
    let r = 0;
    for (const s of this.cfg.weather.showers) if (this.t >= s.start && this.t <= s.end) r = Math.max(r, s.intensity * Math.min(1, (this.t - s.start) / 120 + 0.2));
    if (r > 0.05 && this.rain <= 0.05) this.say('Rain is falling on the circuit.', 'weather');
    if (r <= 0.05 && this.rain > 0.05) this.say('The rain has stopped. The track will start to dry.', 'weather');
    this.rain = r;
    this.wetness = clamp(this.wetness + this.dt * (r * 0.004 - (r < 0.05 ? 0.0011 : 0)), 0, 1);
  }
  private rainSoon(): number {
    for (const s of this.cfg.weather.showers) if (s.start > this.t && s.start - this.t < 100) return s.intensity;
    return 0;
  }

  private pacePen(c: CarState): number {
    const d = this.driver(c);
    const md = MODE[c.mode];
    let pen = c.compound.delta + wearPenalty(c.wear) + wetPenalty(c.compound.wetType, this.wetness) + (c.fuel * c.dTdm) / c.T0
      + (88 - d.pace) * 0.0005 + this.wetness * (85 - d.wet) * 0.0008 + md.pace + c.noise + c.damage;
    if (c.lowFuel) pen += 0.012;
    return pen;
  }

  // ------------------------------------------------------------------ player / team commands
  car(id: string) { return this.cars.find((c) => c.e.id === id); }
  setMode(id: string, mode: Mode) { const c = this.car(id); if (c) c.mode = mode; }
  setAuto(id: string, auto: boolean) { const c = this.car(id); if (c) c.auto = auto; }
  requestPit(id: string, compound: string, fuelLaps?: number) {
    const c = this.car(id); if (!c || c.status !== 'run') return;
    const regs = this.cfg.regs;
    const lapsLeft = this.lapsLeft(c);
    const fuel = regs.refuel ? Math.min(regs.tankKg, c.fuelPerLap * ((fuelLaps ?? lapsLeft) + 0.5) * 1.03) : c.fuel;
    c.pitReq = { compound, fuel: Math.max(fuel, c.fuel), tyres: true };
    this.say(`${this.name(c)} is called in: box this lap for ${regs.tyres.find((x) => x.id === compound)?.name ?? compound} tyres.`, 'player');
  }
  cancelPit(id: string) { const c = this.car(id); if (c) c.pitReq = null; }
  lapsLeft(c: CarState): number {
    if (this.cfg.laps) return this.cfg.laps - c.laps;
    return Math.max(0, (this.cfg.duration - this.t) / (c.T0 * (1 + c.pen)));
  }

  private decide(c: CarState) {
    const regs = this.cfg.regs;
    const lapsLeft = this.lapsLeft(c);
    if (lapsLeft < 0.9) return;
    const soon = this.rainSoon();
    const smart = c.e.strategy / 100;
    const w = soon > 0 && chance(this.rng, smart) ? Math.max(this.wetness, soon * 0.5) : this.wetness;
    const pens = [wetPenalty(0, w), wetPenalty(1, w), wetPenalty(2, w)];
    const cur = c.compound.wetType;
    let bestT: 0 | 1 | 2 = 0;
    if (pens[1] < pens[bestT]) bestT = 1;
    if (pens[2] < pens[bestT]) bestT = 2;
    if (pens[cur] - pens[bestT] > 0.012 + (1 - smart) * 0.02) c.wrongTyre++; else c.wrongTyre = 0;
    const wantType = c.wrongTyre >= (smart > 0.7 ? 1 : 2) ? bestT : cur;
    const needFuel = regs.refuel && c.fuel < c.fuelPerLap * 1.3;
    const planned = c.plan.includes(c.laps) && this.wetness < 0.2;
    const needTyre = wantType !== cur || (c.wear > (cur === 0 ? c.wearLimit : 1.05) && lapsLeft > 2.5) || c.damage > 0.004;
    const dryRace = c.usedDry.length > 0 && cur === 0;
    const twoRule = regs.twoCompound && dryRace && c.usedDry.length < 2 && lapsLeft <= 2.2 && lapsLeft > 0.9;
    if (!(needFuel || needTyre || planned || twoRule)) return;
    const stintLaps = regs.refuel ? Math.min(lapsLeft, regs.tankKg / (c.fuelPerLap * 1.03) - 0.5) : lapsLeft;
    const wearRate = this.track.abrasion * c.e.perf.tyreWear * (1.15 - this.driver(c).tyre / 320) / c.compound.lifeKm;
    const tyres = needTyre || planned || twoRule || c.wear + wearRate * stintLaps * this.lapKm > 0.92;
    const comp = tyres ? this.chooseCompound(c, wantType, lapsLeft, stintLaps, twoRule) : c.compound;
    const fuel = regs.refuel ? Math.min(regs.tankKg, c.fuelPerLap * (lapsLeft + 0.6) * 1.03) : c.fuel;
    c.pitReq = { compound: comp.id, fuel: Math.max(fuel, c.fuel), tyres };
  }

  private chooseCompound(c: CarState, type: 0 | 1 | 2, lapsLeft: number, stintLaps: number, forceNew: boolean): TyreCompound {
    const regs = this.cfg.regs;
    if (type !== 0) return regs.tyres.find((x) => x.wetType === type)!;
    const dryList = regs.tyres.filter((x) => x.wetType === 0);
    const idx = c.plan.findIndex((l) => l >= c.laps);
    const planned = idx >= 0 ? dryList.find((x) => x.id === c.planComp[idx + 1]) : undefined;
    if (planned && !forceNew) return planned;
    const stopsAfter = c.plan.filter((l) => l > c.laps).length;
    const stintKm = (regs.refuel ? stintLaps : lapsLeft / (stopsAfter + 1)) * this.lapKm;
    const wearK = this.track.abrasion * c.e.perf.tyreWear;
    let cand = dryList.map((cp) => ({ cp, pen: cp.delta + wearPenaltyAvg((stintKm * wearK) / cp.lifeKm) })).sort((a, b) => a.pen - b.pen);
    if (regs.twoCompound && c.usedDry.length < 2 && stopsAfter === 0) { const other = cand.filter((x) => !c.usedDry.includes(x.cp.id)); if (other.length) cand = other; }
    return cand[0].cp;
  }

  private enterPit(c: CarState, lineDist: number) {
    const regs = this.cfg.regs;
    const req = c.pitReq!; c.pitReq = null;
    const who = this.name(c), posNow = this.position(c);
    const crewF = 1.25 - c.e.pitCrew / 200;
    const tTyre = req.tyres ? regs.tyreChange * crewF * (0.92 + rnd(this.rng) * 0.2) : 0;
    const add = Math.max(0, req.fuel - c.fuel);
    const tFuel = regs.refuel && add > 0.5 ? 2 + add / regs.refuelRate : 0;
    let stat = regs.discipline === 'f1' ? Math.max(tTyre, tFuel) : tTyre + tFuel;
    let note = '';
    if (chance(this.rng, 0.055 * (1.5 - c.e.pitCrew / 100))) { const x = rndRange(this.rng, 3, 12); stat += x; note = ` Slow stop (+${x.toFixed(1)} s).`; }
    if (c.damage > 0) { stat += 18; c.damage = 0; note += ' Damage repaired.'; }
    const nDrv = c.e.drivers.length;
    if (nDrv > 1 && this.t - c.driverSince > (this.cfg.duration > 4 * 3600 ? 2.2 * 3600 : this.cfg.duration * 0.3)) {
      c.driverIdx = (c.driverIdx + 1) % nDrv; c.driverSince = this.t; stat += 5; note += ` ${this.driver(c).name} takes over.`;
    }
    let tExit = 0;
    for (let s = 0; s < this.geom.pitExitS; s += this.geom.ds) tExit += this.geom.ds / Math.max(20, c.prof[Math.floor(s / this.geom.ds) % this.geom.n]);
    c.status = 'pit'; c.pitStart = this.t; c.pitStartDist = lineDist; c.pitEnd = this.t + tExit + this.track.pitLoss + stat; c.stops++; c.pitLap = true;
    if (req.tyres) {
      const cp = regs.tyres.find((x) => x.id === req.compound) ?? c.compound;
      c.compound = cp; c.wear = 0; c.tyreKm = 0;
      if (cp.wetType === 0 && !c.usedDry.includes(cp.id)) c.usedDry.push(cp.id);
    }
    if (regs.refuel) c.fuel = Math.max(c.fuel, req.fuel);
    c.lowFuel = false;
    if (c.e.isPlayer || posNow <= 6) this.say(`${who} pits from P${posNow}: ${req.tyres ? c.compound.name + ' tyres' : 'fuel only'}${tFuel ? `, ${add.toFixed(0)} kg fuel` : ''} — ${stat.toFixed(1)} s stationary.${note}`, c.e.isPlayer ? 'player' : 'pit');
  }

  position(c: CarState): number { let p = 1; for (const o of this.cars) if (o !== c && this.ahead(o, c)) p++; return p; }
  private ahead(a: CarState, b: CarState): boolean {
    const ra = a.status === 'out' ? 0 : a.status === 'fin' ? 2 : 1, rb = b.status === 'out' ? 0 : b.status === 'fin' ? 2 : 1;
    if (ra === 2 && rb === 2) return a.laps !== b.laps ? a.laps > b.laps : a.finishT < b.finishT;
    if ((ra === 0) !== (rb === 0)) return ra > rb;
    if (ra === 2 || rb === 2) { const la = a.laps, lb = b.laps; if (la !== lb) return la > lb; return ra > rb; }
    return a.dist > b.dist;
  }
  order(): CarState[] { return [...this.cars].sort((a, b) => (this.ahead(a, b) ? -1 : 1)); }

  private retire(c: CarState, reason: string) {
    c.status = 'out'; c.outReason = reason; c.v = 0;
    this.say(`${this.name(c)} is out of the race: ${reason}.`, c.e.isPlayer ? 'player' : 'dnf');
  }

  private onLine(c: CarState, k: number, tCross: number) {
    const leaderBefore = !this.cars.some((o) => o !== c && o.status === 'run' && o.dist > c.dist);
    if (k >= 1) {
      const lap = tCross - c.lapStartT;
      c.lastLap = lap; c.laps = k;
      if (!c.pitLap && k > 1) {
        if (lap < c.bestLap) c.bestLap = lap;
        if (lap < this.fastest.time) { this.fastest = { idx: c.idx, time: lap }; if (k > 3) this.say(`Fastest lap: ${this.name(c)}, ${fmt(lap)}.`, 'info'); }
      }
    }
    c.lapStartT = tCross; c.pitLap = false;
    const d = this.driver(c);
    c.noise = gauss(this.rng) * (0.0012 + (100 - d.consistency) * 0.00006);
    if (chance(this.rng, (100 - d.consistency) * 0.0005 * (1 + 2 * this.wetness))) c.lose += rndRange(this.rng, 0.8, 3);
    const timeUp = !this.cfg.laps && this.t >= this.cfg.duration;
    const distDone = this.cfg.laps > 0 && c.laps >= this.cfg.laps;
    if (this.leaderDone) { c.status = 'fin'; c.finishT = tCross; return; }
    if (leaderBefore && (timeUp || distDone)) {
      this.leaderDone = true; this.leaderFinishT = tCross; c.status = 'fin'; c.finishT = tCross;
      this.say(`Chequered flag! ${this.name(c)} wins for ${c.e.teamName}.`, 'flag');
      return;
    }
    if (distDone) { c.status = 'fin'; c.finishT = tCross; return; }
    if (c.auto && !c.pitReq) this.decide(c);
    if (c.pitReq && this.lapsLeft(c) > 0.5) this.enterPit(c, k * this.L);
  }

  private attempt(c: CarState, a: CarState) {
    const lapped = Math.abs(c.dist - a.dist) > this.L * 0.5;
    const dc = this.driver(c), da = this.driver(a);
    const adv = (a.T0 * (1 + a.pen) - c.T0 * (1 + c.pen)) / c.T0;
    let p = lapped ? 0.92 : clamp(0.08 + adv * 32 + (dc.racecraft - da.racecraft) * 0.004 + ((c.vTop - a.vTop) / c.vTop) * 2.5 + (this.cfg.regs.drs ? 0.12 : 0.04) + 0.05 * this.wetness, 0.02, 0.92) * this.track.overtake;
    p = Math.min(p, 0.97);
    if (chance(this.rng, p)) {
      c.passing = a.idx; c.passUntil = this.t + 10; a.noAttemptUntil = this.t + 15;
      if (!lapped) {
        const pos = this.position(c) - 1;
        if (pos <= 5 || c.e.isPlayer || a.e.isPlayer) this.say(`${this.name(c)} passes ${this.name(a)} for P${Math.max(1, pos)}.`, c.e.isPlayer || a.e.isPlayer ? 'player' : 'pass');
      }
    } else { c.noAttemptUntil = this.t + 4; c.lose += 0.15; }
  }

  step() {
    if (this.finished) return;
    const dt = this.dt, L = this.L, geom = this.geom, regs = this.cfg.regs;
    this.t += dt;
    this.updateWeather();
    const vscOn = this.vsc > 0;
    if (vscOn) { this.vsc -= dt; if (this.vsc <= 0) this.say('Virtual safety car ending — racing resumes.', 'flag'); }
    // cars on track sorted by position along the lap, to find who is directly ahead
    const bt = this.byTrack; bt.length = 0;
    for (const c of this.cars) if (c.status === 'run' && this.t >= c.startDelay) bt.push(c);
    const sOf = (c: CarState) => ((c.dist % L) + L) % L;
    bt.sort((a, b) => sOf(a) - sOf(b));
    const early = this.t < 40;
    for (let bi = 0; bi < bt.length; bi++) {
      const c = bt[bi];
      c.prevDist = c.dist;
      const s = sOf(c);
      const si = Math.floor(s / geom.ds) % geom.n;
      const pen = this.pacePen(c); c.pen = pen;
      let v = c.prof[si] / (1 + pen);
      const since = this.t - c.startDelay;
      if (since < 7 && c.laps === 0 && c.dist < 300) v *= Math.min(1, 0.3 + 0.1 * since);
      if (vscOn) v *= 0.62;
      if (c.lose > 0) { v *= 0.6; c.lose -= dt * 0.4; }
      c.blocked = false;
      if (bt.length > 1) {
        const a = bt[(bi + 1) % bt.length];
        const gap = (sOf(a) - s + L) % L;
        if (c.passing === a.idx && this.t < c.passUntil) v *= 1.015;
        else {
          if (c.passing !== -1 && this.t >= c.passUntil) c.passing = -1;
          const room = gap + a.v * dt - 6;
          if (v * dt > room && gap < 60) {
            v = Math.max(0, room / dt); c.blocked = true;
            const zone = geom.zoneOf[si];
            if (zone >= 0 && !vscOn && this.t >= c.noAttemptUntil && this.t > 12) {
              const key = c.laps * 4096 + zone * 64 + a.idx;
              if (key !== c.attemptKey) { c.attemptKey = key; this.attempt(c, a); }
            }
          }
        }
      }
      c.v = v;
      const newDist = c.dist + v * dt;
      const dkm = (v * dt) / 1000;
      const md = MODE[c.mode];
      const d = this.driver(c);
      // tyres & fuel
      const wrong = c.compound.wetType > 0 && this.wetness < 0.1 ? 3 : 1;
      c.wear += (dkm / c.compound.lifeKm) * this.track.abrasion * c.e.perf.tyreWear * (1.15 - d.tyre / 320) * md.wear * wrong * (c.blocked ? 1.08 : 1);
      c.tyreKm += dkm;
      c.fuel -= (c.fuelPerLap / this.lapKm) * dkm * md.fuel * (vscOn ? 0.5 : 1) * (c.lowFuel ? 0.88 : 1);
      if (!regs.refuel && !c.lowFuel && c.fuel < c.fuelPerLap * this.lapsLeft(c) * 0.97 && this.lapsLeft(c) > 0.3) { c.lowFuel = true; if (c.e.isPlayer) this.say(`${this.name(c)} must lift and coast to make the finish on fuel.`, 'player'); }
      if (c.fuel <= 0) { c.fuel = 0; this.retire(c, 'out of fuel'); continue; }
      // failures & accidents
      if (rnd(this.rng) < (-Math.log(c.e.perf.reliability) / regs.refKm) * dkm * md.haz) {
        const causes = ['engine failure', 'gearbox failure', 'electrical fault', 'suspension failure', 'brake failure', 'oil leak', 'overheating'];
        if (c.e.perf.forced) causes.push('turbo failure');
        this.retire(c, pick(this.rng, causes)); continue;
      }
      const slickInWet = c.compound.wetType === 0 && this.wetness > 0.3;
      const pAcc = regs.accidentPerKm * dkm * (1.9 - d.consistency / 100) * (1 + 3 * this.wetness * (1.3 - d.wet / 100)) * (c.mode === 'push' ? 1.4 : 1) * (slickInWet ? 4 : 1) * (early ? 5 : 1) * (c.blocked ? 1.5 : 1) * (vscOn ? 0.1 : 1);
      if (rnd(this.rng) < pAcc) {
        if (chance(this.rng, 0.5)) {
          this.retire(c, early ? 'first-lap collision' : slickInWet ? 'aquaplaned off the road' : 'accident');
          if (!vscOn && this.vsc <= 0 && chance(this.rng, 0.55)) { this.vsc = rndRange(this.rng, 80, 200); this.say('Virtual safety car deployed while the car is recovered.', 'flag'); }
          continue;
        }
        const loss = rndRange(this.rng, 5, 18);
        c.lose += loss;
        if (chance(this.rng, 0.4)) c.damage = rndRange(this.rng, 0.004, 0.012);
        if (c.e.isPlayer || this.position(c) <= 6) this.say(`${this.name(c)} ${chance(this.rng, 0.5) ? 'spins' : 'runs wide'} and loses about ${loss.toFixed(0)} seconds.${c.damage ? ' The car is damaged.' : ''}`, c.e.isPlayer ? 'player' : 'info');
      }
      const k0 = Math.floor(c.dist / L), k1 = Math.floor(newDist / L);
      c.dist = newDist;
      if (k1 > k0 && newDist >= 0) {
        const frac = v > 0 ? (newDist - k1 * L) / (v * dt) : 0;
        this.onLine(c, k1, this.t - frac * dt);
      }
    }
    // pit lane
    for (const c of this.cars) {
      if (c.status !== 'pit') continue;
      c.prevDist = c.dist;
      if (this.t >= c.pitEnd) { c.status = 'run'; c.dist = c.pitStartDist + geom.pitExitS; c.v = c.prof[Math.floor(geom.pitExitS / geom.ds) % geom.n] * 0.7; }
      else c.dist = c.pitStartDist + geom.pitExitS * ((this.t - c.pitStart) / (c.pitEnd - c.pitStart));
    }
    // end of race
    if (this.leaderDone) {
      const anyRunning = this.cars.some((c) => c.status === 'run' || c.status === 'pit');
      if (!anyRunning || this.t > this.leaderFinishT + this.cars[0].T0 * 1.6) {
        for (const c of this.cars) if (c.status === 'run' || c.status === 'pit') { c.status = 'fin'; c.finishT = this.t + (L - sOf(c)) / Math.max(c.v, 20); }
        this.finished = true;
      }
    } else if (!this.cars.some((c) => c.status === 'run' || c.status === 'pit')) this.finished = true;
    else if (!this.cfg.laps && this.t > this.cfg.duration + 1200) this.finished = true;
  }

  runFor(simSeconds: number) { const n = Math.ceil(simSeconds / this.dt); for (let i = 0; i < n && !this.finished; i++) this.step(); }
  runToEnd() { let guard = 0; while (!this.finished && guard++ < 400000) this.step(); this.finished = true; }

  progress(): number {
    if (this.cfg.laps) { const lead = this.order()[0]; return clamp(Math.max(0, lead.dist) / (this.cfg.laps * this.L), 0, 1); }
    return clamp(this.t / this.cfg.duration, 0, 1);
  }

  results(): CarResult[] {
    const ord = this.order();
    const pts = this.cfg.regs.points;
    return ord.map((c, i) => {
      const classified = c.status === 'fin';
      let points = classified && i < pts.length ? pts[i] * this.cfg.pointsScale : 0;
      if (this.cfg.regs.flPoint && this.fastest.idx === c.idx && classified && i < 10) points += 1;
      return {
        teamId: c.e.teamId, carIdx: c.e.carIdx, driverId: c.e.drivers[0].id, pos: i + 1, grid: c.grid, laps: c.laps, time: c.finishT,
        status: classified ? 'finished' : 'dnf', reason: c.outReason, bestLap: isFinite(c.bestLap) ? c.bestLap : 0, stops: c.stops, points,
      };
    });
  }
}

export const fmt = (s: number) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`; };
