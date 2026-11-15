// Interface text of the 2D game screens, written as [English, Spanish] pairs so no string exists in one language only.
import { useT } from '../../i18n';

export const TX = {
  // navigation
  'nav.hq': ['My empire', 'Mi imperio'], 'nav.workshop': ['Workshop', 'Taller'], 'nav.factory': ['Factory', 'Fábrica'], 'nav.skills': ['Tech tree', 'Tecnologías'],
  'nav.collection': ['Achievements & garage', 'Logros y garaje'], 'nav.campaigns': ['Marketing', 'Publicidad'], 'nav.league': ['Rankings', 'Clasificaciones'], 'nav.advanced': ['Advanced analysis', 'Análisis avanzado'],
  'back.hq': ['Back to headquarters', 'Volver a la sede'],
  // hub
  'hub.kicker': ['Headquarters', 'Sede central'], 'hub.title': ['Build a legend.', 'Construí una leyenda.'],
  'hub.sub': ['Every building is part of your company. Click one to go inside: what you see here grows with your real results.', 'Cada edificio es parte de tu compañía. Hacé clic para entrar: lo que ves crece con tus resultados reales.'],
  'hub.level': ['Company level', 'Nivel de empresa'], 'hub.xp': ['{xp} XP · next level at {next}', '{xp} XP · próximo nivel en {next}'], 'hub.maxLevel': ['{xp} XP · top level', '{xp} XP · nivel máximo'],
  'hub.sold': ['Cars sold', 'Autos vendidos'], 'hub.credits': ['Earned credits', 'Créditos ganados'], 'hub.rank': ['World rank', 'Puesto mundial'],
  'spot.office': ['Head office', 'Oficinas centrales'], 'spot.office.s': ['Reports and finance', 'Informes y finanzas'],
  'spot.studio': ['Design centre', 'Centro de diseño'], 'spot.studio.s': ['{n} engineers', '{n} ingenieros'],
  'spot.lab': ['R&D laboratory', 'Laboratorio de I+D'], 'spot.lab.s': ['Tech level {v}', 'Nivel tecnológico {v}'],
  'spot.factory': ['Plants', 'Plantas'], 'spot.factory.s': ['{n} plants · {cap}/month', '{n} plantas · {cap}/mes'], 'spot.factory.none': ['No plant yet', 'Sin planta todavía'], 'spot.factory.building': [' · {n} under works', ' · {n} en obra'],
  'spot.showroom': ['Showroom & dealers', 'Concesionarios'], 'spot.showroom.s': ['Reach {n} cars/year', 'Alcance {n} autos/año'],
  'spot.billboard': ['Marketing', 'Publicidad'], 'spot.billboard.s': ['{v}/month', '{v}/mes'], 'spot.billboard.off': ['No campaign', 'Sin campaña'],
  'spot.track': ['Test track', 'Pista de pruebas'], 'spot.track.s': ['Motorsport', 'Automovilismo'],
  'spot.trophies': ['Trophy hall', 'Sala de trofeos'], 'spot.trophies.s': ['{n} achievements', '{n} logros'],
  'hub.goals': ['Objectives', 'Objetivos'], 'hub.goals.sub': ['Reached from real results. Claim them for experience, credits and blueprints.', 'Se cumplen con resultados reales. Reclamalos para ganar experiencia, créditos y piezas.'],
  'hub.range': ['Your range', 'Tu gama'], 'hub.range.empty': ['No car yet. Your first design starts in the workshop.', 'Todavía no hay autos. Tu primer diseño empieza en el taller.'],
  'hub.range.status.development': ['In development · {n} months', 'En desarrollo · {n} meses'], 'hub.range.status.ready': ['Ready: needs a line', 'Listo: falta una línea'], 'hub.range.status.production': ['{n}/month · {p}', '{n}/mes · {p}'],
  'hub.rivals': ['Rivals this year', 'Rivales este año'], 'hub.openWorkshop': ['Design a car', 'Diseñar un auto'],
  // goals
  'goal.claim': ['Claim', 'Reclamar'], 'goal.claimed': ['Claimed', 'Reclamado'], 'goal.reward': ['+{xp} XP · +{c} credits', '+{xp} XP · +{c} créditos'],
  'goal.blueprint': ['+ blueprint: {name}', '+ pieza: {name}'], 'goal.done': ['Achievement claimed: {name}', 'Logro reclamado: {name}'], 'goal.levelUp': ['Level {n}!', '¡Nivel {n}!'],
  // workshop
  'ws.kicker': ['Engineering workshop', 'Taller de ingeniería'], 'ws.title': ['Build your next car', 'Construí tu próximo auto'],
  'ws.sub': ['Choose each part and see what it does before you commit. Approving starts a real development programme with its budget and time.', 'Elegí cada pieza y mirá qué cambia antes de decidir. Aprobar inicia un programa de desarrollo real, con su presupuesto y su plazo.'],
  'st.engine': ['Engine', 'Motor'], 'st.chassis': ['Chassis', 'Chasis'], 'st.drivetrain': ['Gearbox', 'Transmisión'], 'st.running': ['Suspension & brakes', 'Suspensión y frenos'],
  'st.body': ['Body', 'Carrocería'], 'st.wheels': ['Wheels & tyres', 'Ruedas y neumáticos'], 'st.finish': ['Finish', 'Acabados'], 'st.approve': ['Approve', 'Aprobar'],
  'ws.layout': ['Cylinder layout', 'Arquitectura del motor'], 'ws.iconic': ['Iconic engines of history', 'Motores icónicos de la historia'],
  'ws.iconic.note': ['Historical figures come from the sources listed on each card. Using one as inspiration loads approximate game parameters into your own design; the simulation decides what your technology can build and what it produces. No official parts, logos or licensed designs.', 'Los datos históricos vienen de las fuentes indicadas en cada tarjeta. Usar uno como inspiración carga parámetros aproximados del juego en tu propio diseño; la simulación decide qué puede construir tu tecnología y cuánto rinde. No son piezas oficiales, logos ni diseños con licencia.'],
  'ws.decade': ['{d}s', 'Años {d}'], 'ws.inspire': ['Use as inspiration', 'Usar como inspiración'], 'ws.sources': ['Sources', 'Fuentes'], 'ws.rated': ['Rated', 'Potencia declarada'],
  'ws.tune': ['Tune it', 'Ajustalo'], 'ws.displacement': ['Displacement', 'Cilindrada'], 'ws.induction': ['Induction', 'Alimentación'], 'ws.redline': ['Redline', 'Régimen máximo'],
  'ind.na': ['Naturally aspirated', 'Atmosférico'], 'ind.turbo': ['Turbo', 'Turbo'], 'ind.twinturbo': ['Twin-turbo', 'Biturbo'], 'ind.supercharged': ['Supercharged', 'Compresor'],
  'ws.drive': ['Driven wheels', 'Tracción'], 'ws.gears': ['Gears', 'Marchas'], 'ws.front': ['Front', 'Delantera'], 'ws.rear': ['Rear', 'Trasera'], 'ws.brakes': ['Brakes', 'Frenos'],
  'ws.size': ['Size', 'Tamaño'], 'ws.tyres': ['Tyres', 'Neumáticos'], 'ws.rim': ['Wheel size', 'Llanta'], 'ws.wheelStyle': ['Wheel design (cosmetic)', 'Diseño de llanta (estético)'],
  'ws.paint': ['Paint', 'Pintura'], 'ws.finishType': ['Paint finish (cosmetic)', 'Acabado de pintura (estético)'], 'ws.interior': ['Interior', 'Interior'], 'ws.quality': ['Build quality', 'Calidad de fabricación'],
  'ws.name': ['Model name', 'Nombre del modelo'], 'ws.namePh': ['e.g. Aurora GT', 'Ej. Aurora GT'], 'ws.approve': ['Approve development', 'Aprobar desarrollo'],
  'ws.approved': ['Programme approved: {name}', 'Programa aprobado: {name}'], 'ws.hire': ['Hire 5 engineers', 'Contratar 5 ingenieros'], 'ws.needEng': ['A programme needs at least 5 engineers.', 'Un programa necesita al menos 5 ingenieros.'],
  'ws.budget': ['Programme', 'Programa'], 'ws.months': ['{n} months', '{n} meses'], 'ws.unitCost': ['Cost to build', 'Costo de fabricación'], 'ws.segment': ['Market', 'Mercado'],
  'ws.power': ['Power', 'Potencia'], 'ws.accel': ['0–100 km/h', '0–100 km/h'], 'ws.top': ['Top speed', 'Velocidad máx.'], 'ws.economy': ['Economy', 'Economía'], 'ws.reliability': ['Reliability', 'Confiabilidad'], 'ws.performance': ['Performance', 'Prestaciones'], 'ws.prestige': ['Prestige', 'Prestigio'], 'ws.labour': ['Assembly hours', 'Horas de montaje'],
  'ws.locked.era': ['Not invented yet ({y})', 'Todavía no existe ({y})'], 'ws.locked.tech': ['Needs {tech}', 'Requiere {tech}'], 'ws.locked.level': ['Company level {n}', 'Nivel de empresa {n}'],
  'ws.selected': ['Selected', 'Elegido'], 'ws.choose': ['Choose', 'Elegir'], 'ws.missing': ['Missing technology: {list}', 'Falta tecnología: {list}'], 'ws.invalid': ['Not buildable: {why}', 'No construible: {why}'],
  'ws.prev': ['Back', 'Anterior'], 'ws.next': ['Next', 'Siguiente'], 'ws.preview': ['Preview', 'Vista previa'], 'ws.unnamed': ['Unnamed project', 'Proyecto sin nombre'],
  'ws.devDone': ['The simulator checks technology, compatibility, staff and money before approving.', 'El simulador comprueba tecnología, compatibilidad, personal y dinero antes de aprobar.'],
  // factory
  'fa.kicker': ['Assembly plant', 'Planta de montaje'], 'fa.title': ['From steel coils to finished cars', 'De bobinas de acero a autos terminados'],
  'fa.sub': ['Walk the line sector by sector. Every figure is the plant\'s real capacity; investments here are the game\'s real actions with their cost and time.', 'Recorré la línea sector por sector. Cada cifra es la capacidad real de la planta; las inversiones son acciones reales del juego, con su costo y su plazo.'],
  'fa.none': ['You have no plant yet. A plant takes {n} months to build.', 'Todavía no tenés planta. Construir una lleva {n} meses.'], 'fa.build': ['Build a plant', 'Construir una planta'],
  'sec.materials': ['Raw materials', 'Materias primas'], 'sec.body': ['Body shop', 'Carrocería'], 'sec.paint': ['Paint shop', 'Pintura'], 'sec.powertrain': ['Engines & gearboxes', 'Motores y cajas'], 'sec.assembly': ['Final assembly', 'Montaje final'], 'sec.inspection': ['Inspection', 'Inspección'], 'sec.dispatch': ['Dispatch', 'Expedición'],
  'fa.capacity': ['Capacity', 'Capacidad'], 'fa.output': ['Built last month', 'Fabricados el mes pasado'], 'fa.perMonth': ['{n}/month', '{n}/mes'], 'fa.bottleneck': ['Bottleneck: this sector limits the whole plant.', 'Cuello de botella: este sector limita toda la planta.'],
  'fa.expandStage': ['Expand this sector +{n} ({cost}, {m} months)', 'Ampliar este sector +{n} ({cost}, {m} meses)'], 'fa.stageWork': ['Works under way: +{n} in {m} months', 'Obras en curso: +{n} en {m} meses'],
  'fa.inspection': ['Inspection thoroughness', 'Rigor de inspección'], 'fa.inspection.hint': ['More checks cost labour per car and stop more defects reaching customers.', 'Más controles cuestan mano de obra por auto y frenan más defectos antes de llegar al cliente.'],
  'fa.contracts': ['Supply contracts', 'Contratos de suministro'], 'fa.contracts.n': ['{n} components under contract · {loss}% output lost to shortages last month', '{n} componentes con contrato · {loss}% de producción perdida por faltantes el mes pasado'], 'fa.suppliers': ['Manage suppliers', 'Gestionar proveedores'],
  'fa.stock': ['Cars in stock', 'Autos en stock'], 'fa.sold': ['Sold last month', 'Vendidos el mes pasado'],
  'fa.automation': ['Automation', 'Automatización'], 'fa.automate': ['Automate to {to}% ({cost})', 'Automatizar al {to}% ({cost})'], 'fa.expand': ['Enlarge the plant +50% ({cost}, {m} months)', 'Ampliar la planta +50% ({cost}, {m} meses)'],
  'fa.lines': ['Production lines', 'Líneas de producción'], 'fa.manage': ['Lines, new plants and details', 'Líneas, plantas nuevas y detalle'], 'fa.done': ['Ordered.', 'Encargado.'],
  'fa.expansion': ['Plant works: +{n}/month in {m} months', 'Obras de planta: +{n}/mes en {m} meses'],
  // collection
  'co.kicker': ['Achievements & garage', 'Logros y garaje'], 'co.title': ['Earn it. Collect it. Show it.', 'Ganalo. Coleccionalo. Exhibilo.'],
  'co.sub': ['Achievements come from real results; chests from cars sold. Blueprints are cosmetic: they change how your cars look, never how they perform or what they earn.', 'Los logros salen de resultados reales y los cofres de los autos vendidos. Las piezas son estéticas: cambian cómo se ven tus autos, nunca cómo rinden ni cuánto ganan.'],
  'tab.goals': ['Achievements', 'Logros'], 'tab.chests': ['Chests', 'Cofres'], 'tab.cards': ['Collection', 'Colección'], 'tab.shop': ['Shop', 'Tienda'],
  'co.chest.start': ['Starter chest', 'Cofre inicial'], 'co.chest.sales': ['{n} cars sold', '{n} autos vendidos'], 'co.chest.open': ['Open', 'Abrir'], 'co.chest.opened': ['Opened', 'Abierto'], 'co.chest.locked': ['{n} more sales', 'Faltan {n} ventas'],
  'co.odds': ['Chest odds in {y} (published)', 'Probabilidades de los cofres en {y} (públicas)'], 'co.odds.note': ['Chests are earned by selling cars only. They cannot be bought with money or credits.', 'Los cofres solo se ganan vendiendo autos. No se compran con dinero ni con créditos.'],
  'co.reward': ['Chest opened!', '¡Cofre abierto!'], 'co.dup': ['Duplicate: +{n} credits', 'Repetida: +{n} créditos'], 'co.newPart': ['New blueprint', 'Pieza nueva'], 'co.continue': ['Continue', 'Continuar'], 'co.equipNow': ['Equip now', 'Equipar ahora'],
  'co.showcase': ['Your showcase car', 'Tu auto de exhibición'], 'co.showcase.sub': ['Wearing the blueprints you equipped. Your production cars show them too.', 'Lleva las piezas que equipaste. Tus autos de producción también las muestran.'],
  'co.equip': ['Equip', 'Equipar'], 'co.equipped': ['Equipped', 'Equipado'], 'co.unequip': ['Remove', 'Quitar'], 'co.missing': ['Not owned', 'No la tenés'], 'co.locked': ['From {y}', 'Desde {y}'],
  'co.owned': ['{n} of {t} collected', '{n} de {t} conseguidas'], 'co.filter.all': ['All', 'Todas'],
  'shop.title': ['Workshop shop', 'Tienda del taller'], 'shop.sub': ['Fixed prices, fixed contents, paid with credits earned by playing.', 'Precios fijos, contenido fijo, pagado con créditos ganados jugando.'],
  'shop.redeem': ['Redeem · {n}', 'Canjear · {n}'], 'shop.needLevel': ['Company level {n}', 'Nivel de empresa {n}'], 'shop.relic': ['Relics are only won', 'Las reliquias solo se ganan'], 'shop.owned': ['Owned', 'En tu colección'],
  'shop.packs': ['Collector packs (future)', 'Paquetes de colección (futuro)'], 'shop.packs.note': ['Optional fixed-content cosmetic packs may be sold in a later version, with every item listed before purchase, through a secure server and Mercado Pago. Nothing can be bought with real money in this version, and no pack will ever be needed to progress.', 'Una versión posterior podría vender paquetes estéticos opcionales de contenido fijo, con todo listado antes de comprar, mediante un servidor seguro y Mercado Pago. En esta versión no se puede comprar nada con dinero real, y ningún paquete será necesario para progresar.'],
  'shop.unavailable': ['Not available in this version', 'No disponible en esta versión'],
  // campaigns
  'mk.kicker': ['Marketing department', 'Departamento de marketing'], 'mk.title': ['Make your brand famous', 'Hacé famosa tu marca'],
  'mk.sub': ['Advertising raises awareness; dealers decide how many buyers can reach your cars. Both are paid from your company\'s cash.', 'La publicidad aumenta el reconocimiento; los concesionarios deciden cuántos compradores pueden llegar a tus autos. Las dos cosas se pagan con la caja de tu empresa.'],
  'mk.budget': ['Monthly advertising', 'Publicidad mensual'], 'mk.confirm': ['Confirm campaign', 'Confirmar campaña'], 'mk.done': ['Advertising budget updated.', 'Presupuesto publicitario actualizado.'],
  'mk.awareness': ['Awareness by region', 'Reconocimiento por región'], 'mk.dealers': ['Dealer network', 'Red de concesionarios'], 'mk.invest': ['Invest {v}', 'Invertir {v}'], 'mk.adds': ['+{n} cars/year of reach', '+{n} autos/año de alcance'],
  'mk.reach': ['{n} cars/year', '{n} autos/año'], 'mk.entry': ['Entering a new region costs at least {v}.', 'Entrar en una región nueva cuesta al menos {v}.'], 'mk.dealersDone': ['Dealer network expanded.', 'Red de concesionarios ampliada.'],
  'mk.slogan': ['Engineer tomorrow', 'Ingeniería para el mañana'],
  // league
  'lg.kicker': ['Rankings', 'Clasificaciones'], 'lg.title': ['Who rules the industry?', '¿Quién domina la industria?'],
  'lg.sub': ['Computed from this game\'s simulation. Rival makers are run by the computer; they are not online players.', 'Calculadas con la simulación de esta partida. Los fabricantes rivales los maneja la computadora; no son jugadores en línea.'],
  'lg.industry': ['Automotive industry', 'Industria automotriz'], 'lg.racing': ['Motorsport', 'Automovilismo'],
  'm.units': ['Cars sold', 'Autos vendidos'], 'm.revenue': ['Revenue', 'Ingresos'], 'm.profit': ['Profit', 'Beneficio'], 'm.prestige': ['Prestige', 'Prestigio'], 'm.innovation': ['Innovation', 'Innovación'], 'm.share': ['Market share', 'Cuota de mercado'],
  'lg.you': ['You', 'Vos'], 'lg.change': ['vs a year ago', 'frente a hace un año'], 'lg.new': ['new', 'nuevo'], 'lg.yourRank': ['Your position', 'Tu posición'],
  'lg.noRacing': ['You do not run a racing team yet. Found one at the test track.', 'Todavía no tenés escudería. Fundá una en la pista de pruebas.'], 'lg.season': ['{name} · season {y}', '{name} · temporada {y}'], 'lg.pts': ['pts', 'pts'],
  'body.hatch': ['Hatchback', 'Hatchback'], 'body.sedan': ['Saloon', 'Sedán'], 'body.wagon': ['Estate', 'Rural / familiar'], 'body.coupe': ['Coupé', 'Cupé'], 'body.roadster': ['Roadster', 'Descapotable'], 'body.supercar': ['Supercar', 'Superdeportivo'], 'body.suv': ['SUV', 'SUV'], 'body.pickup': ['Pickup', 'Pickup'],
  'int.basic': ['Basic', 'Básico'], 'int.standard': ['Standard', 'Estándar'], 'int.premium': ['Premium', 'Premium'], 'int.luxury': ['Luxury', 'Lujo'],
  'fin.solid': ['Solid', 'Sólida'], 'fin.metallic': ['Metallic', 'Metalizada'], 'fin.pearl': ['Pearl', 'Perlada'], 'fin.matte': ['Matte', 'Mate'],
  'wh.multispoke': ['Multi-spoke', 'Multirrayo'], 'wh.fivespoke': ['Five-spoke', 'Cinco rayos'], 'wh.turbine': ['Turbine', 'Turbina'], 'wh.default': ['Era standard', 'Estándar de la época'],
  'slot.body': ['Body', 'Carrocería'], 'slot.wheels': ['Wheels', 'Ruedas'], 'slot.engine': ['Engine', 'Motor'], 'slot.chassis': ['Chassis', 'Chasis'],
  'lg.basis': ['units, revenue and profit over the last 12 months (annualised while the game is younger than a year)', 'autos, ingresos y beneficio de los últimos 12 meses (anualizados mientras la partida tenga menos de un año)'],
  'lg.wait': ['Rankings start after the first month is closed: they are built from real monthly results.', 'Las clasificaciones empiezan al cerrar el primer mes: se arman con resultados mensuales reales.'],
  'lg.online': ['Weekly online leagues need player accounts and a server that verifies results; they are not part of this version.', 'Las ligas semanales en línea necesitan cuentas de jugador y un servidor que verifique resultados; no forman parte de esta versión.'],
  'lg.awards': ['Season awards', 'Premios de la temporada'],
  // common
  'sound.on': ['Sound on', 'Sonido activado'], 'sound.off': ['Sound off', 'Sonido desactivado'],
} as const satisfies Record<string, readonly [string, string]>;

export type TxKey = keyof typeof TX;
/** Translate a 2D-screen key with {placeholders}. */
export function useTx() {
  const { lang } = useT();
  const i = lang === 'es' ? 1 : 0;
  return (k: TxKey, vars?: Record<string, string | number>) => {
    let s: string = TX[k][i];
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b));
    return s;
  };
}
