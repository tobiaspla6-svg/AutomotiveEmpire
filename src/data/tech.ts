import type { TechArea, VehicleSpec, Tech } from '../sim/types';

// Technology catalogue. `year` is the approximate year the technology became practical for
// series-production road cars (real milestones, rounded — e.g. Bosch D-Jetronic EFI 1967/68,
// Mitsubishi GDI 1996, Toyota Prius 1997, VW DSG 2003). A company can use a technology once its
// tech level ("tech-year") in that area reaches the item's year; R&D pushes the tech-year ahead
// of the calendar, neglect lets it fall behind.
export interface TechItem { id: string; name: string; area: TechArea; year: number; note: string }

export const TECHS: TechItem[] = [
  { id: 'mfi', name: 'Mechanical fuel injection', area: 'engine', year: 1954, note: 'First on the Mercedes-Benz 300 SL (1954).' },
  { id: 'turbo', name: 'Turbocharging', area: 'engine', year: 1962, note: 'Oldsmobile Jetfire / Chevrolet Corvair Monza (1962).' },
  { id: 'efi', name: 'Electronic fuel injection', area: 'engine', year: 1968, note: 'Bosch D-Jetronic, VW 1600 (1967/68).' },
  { id: 'dohc4', name: 'Four-valve DOHC heads', area: 'engine', year: 1972, note: 'Series-production 16-valve engines appear in the early 1970s.' },
  { id: 'twinturbo', name: 'Twin turbocharging', area: 'engine', year: 1981, note: 'Maserati Biturbo (1981).' },
  { id: 'vvt', name: 'Variable valve timing', area: 'engine', year: 1986, note: 'Alfa Romeo (1980), Honda VTEC (1989).' },
  { id: 'di', name: 'Gasoline direct injection', area: 'engine', year: 1996, note: 'Mitsubishi GDI (1996).' },
  { id: 'hybrid', name: 'Hybrid electric drive', area: 'engine', year: 1997, note: 'Toyota Prius (1997).' },
  { id: 'ev', name: 'Lithium-ion electric powertrain', area: 'engine', year: 2008, note: 'Tesla Roadster (2008), Nissan Leaf (2010).' },
  { id: 'gears5', name: '5-speed gearboxes', area: 'engine', year: 1964, note: '' },
  { id: 'gears6', name: '6-speed gearboxes', area: 'engine', year: 1989, note: '' },
  { id: 'gears8', name: '7–8 speed gearboxes', area: 'engine', year: 2003, note: '' },
  { id: 'gears10', name: '9–10 speed gearboxes', area: 'engine', year: 2013, note: '' },
  { id: 'dct', name: 'Dual-clutch transmission', area: 'engine', year: 2003, note: 'VW DSG (2003).' },

  { id: 'fibreglass', name: 'Fibreglass body panels', area: 'chassis', year: 1953, note: 'Chevrolet Corvette (1953).' },
  { id: 'disc', name: 'Disc brakes', area: 'chassis', year: 1955, note: 'Citroën DS (1955), Jaguar racing use from 1953.' },
  { id: 'vented', name: 'Ventilated disc brakes', area: 'chassis', year: 1966, note: '' },
  { id: 'sporttire', name: 'High-performance radial tyres', area: 'chassis', year: 1966, note: '' },
  { id: 'awd', name: 'Performance all-wheel drive', area: 'chassis', year: 1980, note: 'Audi quattro (1980). Off-road 4x4 is always available for SUVs and pickups.' },
  { id: 'multilink', name: 'Multi-link suspension', area: 'chassis', year: 1982, note: 'Mercedes-Benz 190 (1982).' },
  { id: 'carbonpanel', name: 'Carbon-fibre body panels', area: 'chassis', year: 1986, note: 'Ferrari F40 (1987).' },
  { id: 'aluminium', name: 'Aluminium monocoque / spaceframe', area: 'chassis', year: 1990, note: 'Honda NSX (1990), Audi A8 (1994).' },
  { id: 'carbon', name: 'Carbon-fibre monocoque', area: 'chassis', year: 1991, note: 'McLaren F1 road car (1992); race cars from 1981.' },
  { id: 'semislick', name: 'Road-legal semi-slick tyres', area: 'chassis', year: 1992, note: '' },
  { id: 'ceramic', name: 'Carbon-ceramic brakes', area: 'chassis', year: 2001, note: 'Porsche 911 GT2 (2001).' },

  { id: 'wing', name: 'Aerodynamic wings & spoilers', area: 'aero', year: 1968, note: 'Wings appear in racing in 1968; road spoilers follow.' },
  { id: 'splitter', name: 'Front air dams & splitters', area: 'aero', year: 1971, note: '' },
  { id: 'flatfloor', name: 'Flat underbody & diffuser', area: 'aero', year: 1989, note: '' },

  { id: 'safety1', name: 'Crumple zones & seat belts', area: 'electronics', year: 1959, note: 'Mercedes-Benz crumple zone (1959), Volvo three-point belt (1959).' },
  { id: 'safety2', name: 'ABS & airbags', area: 'electronics', year: 1981, note: 'Bosch ABS (1978), production airbags (1981).' },
  { id: 'safety3', name: 'Stability control & driver assistance', area: 'electronics', year: 1997, note: 'Bosch ESP (1995).' },

  { id: 'auto30', name: 'Robotised body shops (automation > 30%)', area: 'manufacturing', year: 1972, note: '' },
  { id: 'auto60', name: 'Flexible automated lines (automation > 60%)', area: 'manufacturing', year: 1992, note: '' },
  { id: 'auto80', name: 'Digital factory (automation > 80%)', area: 'manufacturing', year: 2012, note: '' },
];

export const TECH_BY_ID: Record<string, TechItem> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const hasTech = (tech: Tech, id: string) => {
  const t = TECH_BY_ID[id];
  return !t || tech[t.area] >= t.year;
};

/** Technologies a vehicle specification relies on. */
export function requiredTechs(s: VehicleSpec): string[] {
  const r: string[] = [];
  const e = s.engine;
  if (e.layout === 'EV') r.push('ev');
  else {
    if (e.fuelSystem !== 'carb') r.push(e.fuelSystem);
    if (e.aspiration === 'turbo') r.push('turbo');
    if (e.aspiration === 'twinturbo') r.push('twinturbo');
    if (e.valvetrain === 'dohc4') r.push('dohc4');
    if (e.vvt) r.push('vvt');
    if (e.hybridKw > 0) r.push('hybrid');
    const g = s.gears;
    if (s.gearbox === 'dct') r.push('dct');
    if (g >= 9) r.push('gears10'); else if (g >= 7) r.push('gears8'); else if (g >= 6) r.push('gears6'); else if (g >= 5) r.push('gears5');
  }
  if (s.panels === 'fibreglass') r.push('fibreglass');
  if (s.panels === 'carbon') r.push('carbonpanel');
  if (s.chassis === 'aluminium') r.push('aluminium');
  if (s.chassis === 'carbon') r.push('carbon');
  if (s.brakes !== 'drum') r.push(s.brakes);
  if (s.tireCompound === 'sport') r.push('sporttire');
  if (s.tireCompound === 'semislick') r.push('semislick');
  if (s.drive === 'AWD' && s.body !== 'suv' && s.body !== 'pickup') r.push('awd');
  if (s.suspFront === 'multilink' || s.suspRear === 'multilink') r.push('multilink');
  if (s.wing > 0.02) r.push('wing');
  if (s.splitter > 0.02) r.push('splitter');
  if (s.flatFloor) r.push('flatfloor');
  if (s.safety >= 1) r.push('safety' + Math.min(3, Math.round(s.safety)));
  return r;
}
export const missingTechs = (s: VehicleSpec, tech: Tech) => requiredTechs(s).filter((id) => !hasTech(tech, id));
