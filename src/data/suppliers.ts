// Component suppliers (Phase 3).
//
// DATA STATUS: FICTIONAL companies and ESTIMATED game data. Supplier names are invented; their traits
// (price, quality, capacity, delivery reliability, region, years active) are tuning parameters chosen to
// offer distinct trade-offs, loosely inspired by the general shape of the industry (Japanese and German
// tier-one quality, cheaper Asian volume suppliers, battery makers appearing in the 1990s and scaling
// after 2010), not by any real supplier.
import type { ComponentCategory, RegionId } from '../sim/types';
export type { ComponentCategory };
export const CATEGORIES: ComponentCategory[] = ['metals', 'electronics', 'semiconductors', 'batteries', 'tires', 'transmissions', 'seats', 'glass', 'interior'];
export const CATEGORY_NAME: Record<ComponentCategory, string> = {
  metals: 'Steel and aluminium', electronics: 'Electronics and wiring', semiconductors: 'Semiconductors', batteries: 'Batteries (traction)', tires: 'Tyres',
  transmissions: 'Transmissions', seats: 'Seats', glass: 'Glass', interior: 'Interior materials',
};
/** Categories a company can bring in-house, and the capital per monthly car set of capacity (2020 USD). */
export const IN_HOUSE: Partial<Record<ComponentCategory, number>> = { metals: 2600, transmissions: 3800, seats: 900, batteries: 9000, electronics: 2200 };

export interface SupplierDef {
  id: string; name: string; category: ComponentCategory; region: RegionId;
  /** price relative to the market average (1.0) */
  price: number;
  /** 0..1: affects the reliability of the cars that use the parts */
  quality: number;
  /** car sets per month it can deliver to one customer, as a share of the reference volume (scaled with the era) */
  capacity: number;
  /** probability that a month passes without a delivery problem */
  reliability: number;
  from: number; to?: number;
}

const s = (id: string, name: string, category: ComponentCategory, region: RegionId, price: number, quality: number, capacity: number, reliability: number, from = 1946, to?: number): SupplierDef =>
  ({ id, name, category, region, price, quality, capacity, reliability, from, to });

export const SUPPLIERS: SupplierDef[] = [
  s('ruhr-stahl', 'Ruhrwerk Stahl', 'metals', 'EU', 1.04, 0.8, 1.0, 0.985),
  s('great-lakes-steel', 'Great Lakes Steel', 'metals', 'NA', 0.98, 0.65, 1.2, 0.97),
  s('nihon-kozai', 'Nihon Kōzai', 'metals', 'JP', 1.0, 0.85, 0.9, 0.99, 1955),
  s('yellow-sea-metal', 'Yellow Sea Metals', 'metals', 'CN', 0.86, 0.55, 1.6, 0.95, 1990),
  s('volta-elektrik', 'Volta Elektrik', 'electronics', 'EU', 1.08, 0.85, 0.9, 0.985),
  s('kanto-denso', 'Kantō Densō', 'electronics', 'JP', 1.02, 0.9, 1.0, 0.99, 1960),
  s('midwest-harness', 'Midwest Harness', 'electronics', 'NA', 0.95, 0.65, 1.1, 0.965),
  s('pearl-river-elec', 'Pearl River Electric', 'electronics', 'CN', 0.84, 0.55, 1.5, 0.95, 1992),
  s('silicon-mesa', 'Silicon Mesa Devices', 'semiconductors', 'NA', 1.08, 0.88, 0.8, 0.96, 1972),
  s('formosa-wafer', 'Formosa Wafer Works', 'semiconductors', 'ROW', 0.95, 0.85, 1.4, 0.95, 1988),
  s('rhein-halbleiter', 'Rhein Halbleiter', 'semiconductors', 'EU', 1.05, 0.9, 0.7, 0.975, 1978),
  s('kyushu-chip', 'Kyūshū Micro', 'semiconductors', 'JP', 1.0, 0.92, 0.9, 0.97, 1975),
  s('nordic-cell', 'Nordcell', 'batteries', 'EU', 1.1, 0.8, 0.6, 0.95, 2016),
  s('hanbit-energy', 'Hanbit Energy', 'batteries', 'JP', 1.0, 0.85, 1.0, 0.97, 1996),
  s('dragon-cell', 'Dragon Cell', 'batteries', 'CN', 0.82, 0.75, 1.8, 0.96, 2002),
  s('mesa-battery', 'Mesa Battery Co.', 'batteries', 'NA', 1.05, 0.75, 0.8, 0.94, 2009),
  s('alpen-reifen', 'Alpenreifen', 'tires', 'EU', 1.06, 0.9, 1.0, 0.99),
  s('akron-rubber', 'Akron Rubber', 'tires', 'NA', 0.97, 0.7, 1.3, 0.98),
  s('sakura-tyre', 'Sakura Tyre', 'tires', 'JP', 1.0, 0.85, 1.0, 0.99, 1950),
  s('jade-rubber', 'Jade Rubber', 'tires', 'CN', 0.82, 0.55, 1.6, 0.96, 1994),
  s('zahnrad-werke', 'Zahnradwerke', 'transmissions', 'EU', 1.08, 0.9, 0.8, 0.985),
  s('aichi-drive', 'Aichi Drivetrain', 'transmissions', 'JP', 1.02, 0.92, 1.0, 0.99, 1965),
  s('detroit-gear', 'Detroit Gear', 'transmissions', 'NA', 0.95, 0.7, 1.2, 0.97),
  s('comfort-sitze', 'Komfortsitz', 'seats', 'EU', 1.05, 0.85, 1.0, 0.985),
  s('sierra-seating', 'Sierra Seating', 'seats', 'LATAM', 0.85, 0.6, 1.3, 0.96, 1970),
  s('lakeside-seating', 'Lakeside Seating', 'seats', 'NA', 0.98, 0.7, 1.1, 0.975),
  s('lumiere-verre', 'Lumière Verre', 'glass', 'EU', 1.03, 0.85, 1.0, 0.985),
  s('asahi-kogaku', 'Asahi Kōgaku Glass', 'glass', 'JP', 1.0, 0.88, 1.1, 0.99, 1955),
  s('ohio-glass', 'Ohio Plate Glass', 'glass', 'NA', 0.95, 0.7, 1.2, 0.98),
  s('milano-tessuti', 'Milano Tessuti', 'interior', 'EU', 1.12, 0.92, 0.7, 0.98),
  s('carolina-trim', 'Carolina Trim', 'interior', 'NA', 0.94, 0.65, 1.2, 0.975),
  s('mekong-materials', 'Mekong Materials', 'interior', 'ROW', 0.82, 0.55, 1.5, 0.95, 1995),
];
export const SUPPLIER_BY_ID: Record<string, SupplierDef> = Object.fromEntries(SUPPLIERS.map((x) => [x.id, x]));
export const suppliersFor = (cat: ComponentCategory, year: number) => SUPPLIERS.filter((x) => x.category === cat && x.from <= year && (x.to === undefined || x.to >= year));
