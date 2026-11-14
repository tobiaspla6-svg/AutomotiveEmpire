// Getting-started steps, derived from the real state of the game (nothing is stored): each step is done when the
// simulation says so. Pure and read-only, so the interface and the tests see the same answer.
import type { Company, GameState } from './types';
import { REGION_IDS } from '../data/world';
import { playerTeam, teamRegs } from './racing/season';

export type GuideStepId = 'design' | 'develop' | 'factory' | 'line' | 'sell' | 'reach' | 'profit' | 'drivers' | 'devBudget' | 'race' | 'points';
export type GuideView = 'vehicles' | 'factories' | 'market' | 'finance' | 'motorsport';
export interface GuideStep { id: GuideStepId; done: boolean; view: GuideView }

/** The ordered steps for the kind of organisation the player runs. */
export function onboardingSteps(g: GameState, p: Company): GuideStep[] {
  if (g.mode === 'motorsport' || (!p.factories.length && !p.models.length && p.motorsport)) {
    const div = p.motorsport;
    if (!div) return [];
    const team = playerTeam(div), regs = teamRegs(team, div.championship.year);
    const seats = regs.carsPerTeam * regs.driversPerCar;
    const raced = div.championship.results.length > 0 || div.history.length > 0;
    const points = (div.championship.teamPoints[team.id] ?? 0) > 0 || div.history.some((h) => h.playerPoints > 0);
    return [
      { id: 'drivers', done: team.drivers.length >= seats, view: 'motorsport' },
      { id: 'devBudget', done: div.devBudget > 0, view: 'motorsport' },
      { id: 'race', done: raced, view: 'motorsport' },
      { id: 'points', done: points, view: 'motorsport' },
    ];
  }
  const models = p.models.filter((m) => m.status !== 'retired');
  const built = models.filter((m) => m.status === 'ready' || m.status === 'production');
  const hasPlant = p.factories.some((f) => f.capacity > 0 || f.expansion);
  const hasLine = p.factories.some((f) => f.lines.length > 0);
  const sold = models.some((m) => REGION_IDS.some((r) => m.lastSales[r] > 0)) || p.ledger.some((l) => l.units > 0);
  return [
    { id: 'design', done: models.length > 0, view: 'vehicles' },
    { id: 'develop', done: built.length > 0, view: 'vehicles' },
    { id: 'factory', done: hasPlant, view: 'factories' },
    { id: 'line', done: hasLine, view: 'factories' },
    { id: 'sell', done: sold, view: 'market' },
    // sales that use most of what the lines were tooled for: dealers, awareness and price brought demand up to the plant
    { id: 'reach', done: g.mode !== 'founder' || reachedLine(p), view: 'market' }, // an established maker already has its network
    // an operating profit: interest earned on the founding capital does not count as making money from cars
    { id: 'profit', done: p.ledger.some((l) => l.units > 0 && l.profit + l.tax + l.interest - l.assetGains > 0), view: 'finance' },
  ];
}

/** Last three months' sales are at least half of the monthly capacity of the lines building the company's cars. */
function reachedLine(p: Company): boolean {
  const cap = p.factories.reduce((a, f) => a + f.capacity * f.lines.reduce((x, l) => x + l.share, 0), 0);
  const last = p.ledger.slice(-3);
  return cap > 0 && last.length === 3 && last.reduce((a, l) => a + l.units, 0) / 3 >= cap * 0.5;
}

/** The first step still to do, or null when the company is up and running. */
export const nextStep = (steps: GuideStep[]): GuideStep | null => steps.find((s) => !s.done) ?? null;
