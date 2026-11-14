// Spanish names for the fixed vocabulary the simulation produces (body styles, segments, regions, engine layouts,
// breakdown labels…). The simulation is not duplicated or translated at source: it keeps one set of names and the
// interface maps them here when it draws them. Anything not listed (model names, people, history text) is shown as is.
import { useLang, type Lang } from './index';

const ES: Record<string, string> = {
  // body styles
  Hatchback: 'Compacto', Sedan: 'Berlina', 'Wagon / MPV': 'Familiar / monovolumen', 'Coupé': 'Cupé', Roadster: 'Roadster', Supercar: 'Superdeportivo', SUV: 'SUV', 'Pickup / Van': 'Pickup / furgoneta',
  // market segments
  'Budget / City': 'Económico / urbano', 'Family / Mid-size': 'Familiar / medio', 'Premium / Executive': 'Premium / ejecutivo', Luxury: 'Lujo', Sports: 'Deportivo', 'Supercar / Exotic': 'Superdeportivo / exótico', 'SUV / Crossover': 'SUV / crossover', 'Pickup / Commercial': 'Pickup / comercial',
  // engine layouts
  'Inline-2': '2 en línea', 'Inline-3': '3 en línea', 'Inline-4': '4 en línea', 'Inline-5': '5 en línea', 'Inline-6': '6 en línea', 'Flat-4': 'Bóxer 4', 'Flat-6': 'Bóxer 6', 'Flat-12': 'Bóxer 12', Electric: 'Eléctrico',
  // regions and countries
  'North America': 'Norteamérica', Europe: 'Europa', 'Japan & Korea': 'Japón y Corea', China: 'China', 'Latin America': 'Latinoamérica', 'Rest of World': 'Resto del mundo',
  'N. America': 'Norteamérica', 'Japan/Korea': 'Japón/Corea', 'Lat. America': 'Latinoamérica',
  'United States': 'Estados Unidos', Germany: 'Alemania', Italy: 'Italia', 'United Kingdom': 'Reino Unido', France: 'Francia', Sweden: 'Suecia', Spain: 'España', Japan: 'Japón', 'South Korea': 'Corea del Sur', Mexico: 'México', Brazil: 'Brasil', India: 'India',
  // mass and cost breakdowns
  Chassis: 'Chasis', 'Body panels': 'Paneles de carrocería', Powertrain: 'Motor', Driveline: 'Transmisión', 'Wheels, brakes, suspension': 'Ruedas, frenos, suspensión', Interior: 'Interior', Safety: 'Seguridad', 'Fluids & electrics': 'Fluidos y electricidad',
  'Body & paint': 'Carrocería y pintura', 'Running gear': 'Tren de rodaje', 'Safety & electronics': 'Seguridad y electrónica', Aero: 'Aerodinámica',
  // paint finishes
  'Solid gloss': 'Sólido brillante', Metallic: 'Metalizado', Pearlescent: 'Perlado', 'Satin matte': 'Mate satinado',
  // platform classes and engine bays
  'Car (hatch, saloon, estate, coupé, crossover)': 'Turismo (compacto, berlina, familiar, cupé, crossover)', 'Sports (coupé, roadster, supercar)': 'Deportivo (cupé, roadster, superdeportivo)', 'Body-on-frame (pickup, SUV)': 'Chasis independiente (pickup, SUV)',
  'up to four cylinders': 'hasta cuatro cilindros', 'up to a V6 / flat-six': 'hasta un V6 / bóxer 6', 'any engine': 'cualquier motor',
  // company founding options
  'Sports cars': 'Deportivos', 'Luxury & grand touring': 'Lujo y gran turismo', 'Affordable cars': 'Coches asequibles', 'Utility & off-road': 'Utilitarios y todoterreno', 'Electric vehicles': 'Vehículos eléctricos',
  '+2 tech-years in chassis and aerodynamics, a sporty brand image.': '+2 años tecnológicos en chasis y aerodinámica, e imagen de marca deportiva.', 'Higher starting prestige and a craft workforce.': 'Más prestigio inicial y una plantilla artesana.',
  '+2 tech-years in manufacturing and a wider starting dealer network.': '+2 años tecnológicos en fabricación y una red de concesionarios inicial más amplia.', 'A reputation for toughness: reliability bonus.': 'Fama de dureza: ventaja en fiabilidad.',
  '+3 tech-years in powertrain and electronics (from 2005).': '+3 años tecnológicos en motores y electrónica (desde 2005).',
  'None — contract a plant later': 'Ninguna: contratar una planta más adelante', 'Workshop (60 cars / month)': 'Taller (60 coches / mes)', 'Small plant (600 / month)': 'Planta pequeña (600 / mes)', 'Volume plant (5,000 / month)': 'Planta de volumen (5.000 / mes)',
  'Skeleton crew (25)': 'Equipo mínimo (25)', 'Design office (80)': 'Oficina de diseño (80)', 'Engineering centre (220)': 'Centro de ingeniería (220)',
  'Supplier technology (4 years behind)': 'Tecnología de proveedor (4 años por detrás)', 'Up to date (1 year behind)': 'Al día (1 año por detrás)', 'Advanced laboratory (1 year ahead)': 'Laboratorio avanzado (1 año por delante)',
  'Craftsmen (hand-built)': 'Artesanos (a mano)', 'Conventional line': 'Línea convencional', 'Automated line': 'Línea automatizada', Privateer: 'Privado', Midfield: 'Media parrilla', 'Front-runner': 'Puntero',
  // trim levels
  Entry: 'Acceso', Mid: 'Medio', Premium: 'Premium', Sport: 'Sport', Performance: 'Performance', 'Limited Edition': 'Edición limitada',
  'The price leader: smallest engine, basic cabin.': 'El de precio de entrada: motor más pequeño, habitáculo básico.', 'The volume seller.': 'El que más se vende.', 'Better cabin and more equipment at a higher price.': 'Mejor habitáculo y más equipamiento a mayor precio.',
  'Stronger engine, firmer tuning, sport tyres.': 'Motor más potente, tarado más firme, neumáticos deportivos.', 'Everything included.': 'Todo incluido.', 'The most powerful variant, track tyres.': 'La variante más potente, neumáticos de circuito.', 'A numbered run: scarcity lifts what buyers will pay.': 'Una serie numerada: la escasez eleva lo que el comprador paga.',
  // technology areas
  'Chassis & materials': 'Chasis y materiales', Aerodynamics: 'Aerodinámica', 'Electronics & safety': 'Electrónica y seguridad', Manufacturing: 'Fabricación',
  // racing categories
  'single-seaters': 'monoplazas', prototypes: 'prototipos', 'GT cars': 'GT', 'touring cars': 'turismos',
  'Grand Prix single-seaters': 'Monoplazas de Gran Premio', 'Endurance prototypes / Hypercar': 'Prototipos de resistencia / Hypercar', 'LMDh prototypes': 'Prototipos LMDh', 'GT racing': 'Carreras de GT', 'Touring cars': 'Turismos',
  // component categories
  'Steel and aluminium': 'Acero y aluminio', 'Electronics and wiring': 'Electrónica y cableado', Semiconductors: 'Semiconductores', 'Batteries (traction)': 'Baterías (tracción)', Tyres: 'Neumáticos', Transmissions: 'Cajas de cambio', Seats: 'Asientos', Glass: 'Vidrio', 'Interior materials': 'Materiales de interior',
  // production stages, plant and supply vocabulary
  'Body shop': 'Carrocería', 'Paint shop': 'Pintura', 'Powertrain shop': 'Motores', 'Final assembly': 'Montaje final', Inspection: 'Inspección',
};

/** The display name of a simulation term in the given language. */
export const term = (text: string, lang: Lang) => (lang === 'es' ? ES[text] ?? text : text);
/** Hook form for components. */
export function useTerm() { const lang = useLang(); return (text: string) => term(text, lang); }
/** Exposed for tests. */
export const SPANISH_TERMS = ES;
