// English interface text. This file defines the message keys; es.ts must provide every one of them.
// Placeholders look like {name}; plural pairs end in .one / .other.
import { pick } from './parts/pairs';
import { STUDIO } from './parts/studio';
import { FACTORY } from './parts/factory';
import { MOTORSPORT } from './parts/motorsport';
import { CORPORATE } from './parts/corporate';
import { SETUP } from './parts/setup';

export const en = {
  ...pick(STUDIO, 0), ...pick(FACTORY, 0), ...pick(MOTORSPORT, 0), ...pick(CORPORATE, 0), ...pick(SETUP, 0),
  // ---- common
  'common.close': 'Close', 'common.done': 'Done', 'common.open': 'Open', 'common.loading': 'Loading…',
  'mode.ceo': 'Historical CEO', 'mode.founder': 'Company Founder', 'mode.motorsport': 'Motorsport Director',
  'diff.easy': 'easy', 'diff.normal': 'normal', 'diff.hard': 'hard',
  'tag.historical': 'historical', 'tag.approx': 'approx.', 'tag.estimate': 'estimate',

  'confirm.title': 'Please confirm', 'confirm.cancel': 'Cancel', 'confirm.ok': 'Confirm',
  // ---- main menu
  'menu.tagline': 'Engineer the cars. Run the company. Win the races.', 'menu.era': '1950 – today',
  'menu.modes': 'Game modes', 'menu.mode': 'Mode {n}',
  'menu.continue': 'Continue', 'menu.import': 'Import save file…', 'menu.noSaves': 'No saved games yet. Games are saved automatically in this browser at the end of every month.',
  'menu.savedAt': 'Saved {when}', 'menu.resume': 'Resume', 'menu.hideSaves': 'Hide other saves', 'menu.allSaves': 'All saves ({n} more)',
  'menu.load': 'Load', 'menu.delete': 'Delete save', 'menu.save.confirmDelete': 'Delete the save "{name}"? This cannot be undone.',
  'menu.graphics': 'Graphics: {q}',
  'menu.legal': 'An unofficial simulation. Manufacturer names are used descriptively for historical context; no logos, liveries or licensed assets are included. Historical facts are distinguished from estimated game data throughout:',
  'menu.legal2': 'Circuits, drivers, sponsors and independent teams are fictional.',
  'menu.ceo.title': 'Historical Automotive CEO', 'menu.ceo.sub': 'Take the chair at a real manufacturer, in any year from 1950.',
  'menu.ceo.car': 'A 1966 V12 grand tourer — a car from the era you can start in', 'menu.ceo.cta': 'Choose a manufacturer',
  'menu.ceo.f1': '18 real manufacturers with their own plants, models and boards', 'menu.ceo.f2': 'Redesign the range, open factories abroad, acquire rivals', 'menu.ceo.f3': 'Follow history — or change it',
  'menu.founder.title': 'Automotive Company Founder', 'menu.founder.sub': 'Start a new marque from an empty drawing board and your seed capital.',
  'menu.founder.car': 'The 2024 reference saloon, engineered and built in the game', 'menu.founder.cta': 'Found a company',
  'menu.founder.f1': 'Engineer cars from the cylinder bore up', 'menu.founder.f2': 'Choose factories, suppliers and dealers', 'menu.founder.f3': 'Build it, price it, sell it — then go racing',
  'menu.motorsport.title': 'Professional Motorsport Director', 'menu.motorsport.sub': 'Run a works or independent team through full championship seasons.',
  'menu.motorsport.car': 'A modern Grand Prix car in team colours', 'menu.motorsport.cta': 'Build a team',
  'menu.motorsport.f1': 'Grand Prix, Hypercar, LMDh, GT and touring cars', 'menu.motorsport.f2': "Design to the era's regulations, hire drivers, develop", 'menu.motorsport.f3': 'Call the strategy in a live, physics-driven race',

  // ---- settings, graphics, frame-rate test
  'settings.title': 'Settings', 'settings.language': 'Language', 'settings.language.note': 'Changes the interface. Historical data, company and model names stay as they are.',
  'settings.graphics': 'Graphics', 'settings.graphics.blurb': 'Controls how the 3D cars are drawn. The whole game is playable with 3D off.',
  'gfx.auto': 'Automatic', 'gfx.auto.desc': 'Chosen from your hardware. Never High.',
  'gfx.low': 'Low', 'gfx.low.desc': 'Simple lighting, lightest model. For integrated graphics and older laptops.',
  'gfx.medium': 'Medium', 'gfx.medium.desc': 'Studio lighting and soft shadows.',
  'gfx.high': 'High', 'gfx.high.desc': 'Glass reflections, reflective floor, finest detail. Wants a dedicated graphics card.',
  'gfx.off': 'Off', 'gfx.off.desc': 'Drawn illustrations instead of 3D. For slow machines or when WebGL is unavailable.',
  'gfx.detected': 'Detected: {gpu}', 'gfx.none': 'no WebGL',
  'gfx.nowebgl': 'WebGL is not available in this browser, so 3D views show illustrations. The game is unaffected.',
  'gfx.software': 'Software rendering detected (no hardware graphics acceleration). 3D will be slow; Low or Off is recommended.',
  'gfx.failed': 'A 3D view failed earlier in this session, so illustrations are shown.', 'gfx.retry': 'Try 3D again',
  'fps.title': 'Frame-rate test', 'fps.blurb': 'Draws the reference car for 5 seconds at the current setting and reports the average frame rate.',
  'fps.noview': 'Reference saloon', 'fps.run': 'Run test', 'fps.running': 'Measuring…', 'fps.at': 'Measures the {q} setting', 'fps.off': 'Turn graphics on to run the test.',
  'fps.result': '95% of frames under {ms} ms · {calls} draw calls · {tris}k triangles per frame',
  'fps.verdict.up': 'Smooth — you can try the next higher setting.', 'fps.verdict.ok': 'Good for this setting.', 'fps.verdict.down': 'Too slow for this setting — choose a lower one.',
  'fps.software': 'Measured on software rendering: these numbers say nothing about a graphics card.',
  'fps.howto.title': 'Validate on your own computer',
  'fps.howto.1': 'Use Chrome, Edge or Firefox with hardware acceleration on (in Chrome, open chrome://gpu and look for “WebGL: Hardware accelerated”).',
  'fps.howto.2': 'Close other heavy tabs and keep this window in front: browsers throttle background tabs.',
  'fps.howto.3': 'Run the test on each setting. 55 FPS or more with 95% of frames under 20 ms means that setting is smooth (60 FPS target).',
  'fps.howto.4': 'Also try the vehicle studio’s own FPS test in full screen — it is the heaviest view in the game.',

  // ---- navigation and top bar
  'nav.label': 'Sections',
  'nav.group.command': 'Command', 'nav.group.engineering': 'Engineering', 'nav.group.operations': 'Operations', 'nav.group.corporate': 'Corporate', 'nav.group.racing': 'Racing', 'nav.group.system': 'World & system',
  'nav.dashboard': 'Dashboard', 'nav.vehicles': 'Vehicles', 'nav.factories': 'Factories', 'nav.market': 'Market & sales', 'nav.research': 'Research', 'nav.finance': 'Finance', 'nav.company': 'Company & board',
  'nav.motorsport': 'Motorsport', 'nav.teamHq': 'Team headquarters', 'nav.news': 'News & world', 'nav.saves': 'Save / load', 'nav.attention': 'Needs your attention',
  'nav.timeline.historical': 'Historical timeline', 'nav.timeline.alt': 'Alternative history',
  'top.date': 'Date', 'top.cash': 'Cash', 'top.debt': 'Debt', 'top.lastMonth': 'Last month', 'top.board': 'Board confidence', 'top.owner': 'Owner confidence',
  'top.save': 'Save game', 'top.saved': 'Game saved.', 'top.menu': 'Main menu', 'top.raceWeekend': 'Race weekend: {name}',
  'top.plus3': '+3 months', 'top.plus3.hint': 'Advance three months (stops for decisions)', 'top.next': 'Next month', 'top.next.hint': 'Advance one month (space bar)', 'top.working': 'Working…',
  'decision.required': 'Decision required', 'over.title': 'Your tenure is over', 'over.led': 'You led {name} from {from} to {to}.', 'over.books': 'Review the books',
  'stage.body': 'Body shop', 'stage.paint': 'Paint shop', 'stage.powertrain': 'Powertrain', 'stage.assembly': 'Final assembly', 'stage.inspection': 'Quality inspection',

  // ---- dashboard
  'dash.eyebrow': 'Command centre', 'dash.founded': 'Founded {year} in {country}.',
  'dash.performance': 'Performance', 'dash.noHistory': 'The history builds as months pass', 'dash.noHistory.sub': 'Advance a few months to see trends for revenue, profit, cash and sales.',
  'chart.revenue': 'Revenue per month', 'chart.profit': 'Profit per month', 'chart.cash': 'Cash and debt', 'chart.units': 'Cars sold per month', 'chart.margin': 'Margins',
  'tab.revenue': 'Revenue', 'tab.profit': 'Profit', 'tab.cash': 'Cash', 'tab.units': 'Sales', 'tab.margin': 'Margins',
  'series.revenue': 'Revenue', 'series.operating': 'Operating profit', 'series.net': 'Net profit', 'series.cash': 'Cash', 'series.debt': 'Debt', 'series.units': 'Cars sold', 'series.capacity': 'Plant capacity', 'series.opMargin': 'Operating margin', 'series.netMargin': 'Net margin',
  'kpi.12m': 'Last 12 months',
  'kpi.cash': 'Cash', 'kpi.cash.sub': 'Debt {debt} · credit headroom {headroom}', 'kpi.cash.hint': 'Cash on hand, and how much more you could borrow before the credit limit. Change shown is over the last 3 months.',
  'kpi.revenue': 'Revenue',
  'kpi.operating': 'Operating profit', 'kpi.operating.sub': '{margin} of revenue', 'kpi.operating.hint': 'Profit before interest, tax and asset sales, last 12 months. Change is against the 12 months before.',
  'kpi.units': 'Cars sold', 'kpi.units.sub': 'Plants {util} utilised',
  'kpi.share': 'World market share', 'kpi.share.sub': 'Rank {rank} of {total} makers', 'kpi.share.hint': 'Your cars sold over the 12 months as a share of the whole world car market.',
  'kpi.valuation': 'Company value', 'kpi.valuation.sub': '{x}× yearly revenue', 'kpi.valuation.sub.new': 'Earnings, brand and cash less debt', 'kpi.valuation.hint': 'Estimated value of the company: earnings power and brand strength, plus cash minus debt.',
  'dash.briefing': 'Executive briefing', 'dash.briefing.n.one': '{count} matter needs you', 'dash.briefing.n.other': '{count} matters need you', 'dash.clear': 'All clear',
  'dash.clear.title': 'Nothing needs your attention', 'dash.clear.sub': 'Plants are balanced, prices cover costs and finances are healthy. A good moment to invest in growth.', 'dash.briefing.more': '+ {n} more in order of importance',
  'dash.briefing.opps.one': '{count} opportunity to act on', 'dash.briefing.opps.other': '{count} opportunities to act on',
  'stat.rev12': 'Revenue, 12 months', 'stat.revMonth': 'Average per month', 'stat.net12': 'Net profit, 12 months', 'stat.opMargin': 'Operating margin', 'stat.netMargin': 'Net margin', 'stat.perCar': 'Revenue per car', 'stat.netDebt': 'Net debt', 'stat.interest': 'Interest rate', 'stat.headroom': 'Credit headroom', 'stat.perMonth': 'Cars per month', 'stat.util': 'Plant utilisation', 'stat.capacity': 'Usable capacity',
  'dash.production': 'Operations', 'dash.production.title': 'Production and capacity', 'dash.noFactory': 'No factory yet', 'dash.noFactory.sub': 'Build a plant to start making cars.',
  'dash.utilisation': 'Utilisation', 'dash.perMonth': '{n} cars / month', 'dash.bottleneck': 'bottleneck', 'dash.more': '+ {n} more plants',
  'dash.market': 'Market', 'dash.market.title': 'Position among makers', 'dash.regions': 'Your sales by region (cars per year)',
  'dash.programmes': 'Pipeline', 'dash.programmes.title': 'Programmes and objectives', 'dash.noDev': 'No vehicle in development.', 'dash.monthsLeft.one': '{count} month left', 'dash.monthsLeft.other': '{count} months left',
  'dash.engineers': 'Engineers needed for full speed: {need} · employed: {have}.', 'dash.owner': 'Owner expectations', 'dash.objectives': 'Board objectives', 'dash.by': 'by {year}',
  'dash.world': 'World', 'dash.news': 'Latest news', 'dash.allNews': 'All news', 'dash.conditions': 'Conditions', 'dash.conditions.title': 'World conditions', 'dash.noConditions': 'No special conditions right now.',

  // ---- insights: headline + why it matters, per kind
  'insight.overLimit.title': 'Debt is above your credit limit', 'insight.overLimit.why': 'Net debt of {debt} has exceeded the {limit} limit for {months} months. Creditors will act if this continues: cut costs, sell assets or raise prices.',
  'insight.cashRunway.title': 'Cash runway: about {months} months', 'insight.cashRunway.why': 'The company has been spending {burn} a month more than it earns. Slow investment or raise cash before it runs dry.',
  'insight.noVehicles.title': 'You have no vehicles yet', 'insight.noVehicles.why': 'Without a car there is nothing to sell. Open the design studio and engineer your first model.',
  'insight.readyNoLine.title': '{name} is ready for production', 'insight.readyNoLine.why': 'Development has finished but no plant builds it yet. Add a production line to start earning.',
  'insight.noPrice.title': '{name} has no price', 'insight.noPrice.why': 'A car without a price cannot be sold. Set one on the vehicles screen.',
  'insight.belowCost.title': '{name} sells below cost', 'insight.belowCost.why': 'Each car brings in {net} after dealer margin but costs {cost} to build. Raise the price or cut costs.',
  'insight.bottleneck.title': '{name}: {stage} limits output', 'insight.bottleneck.why': 'That stage handles only {cap} cars a month although the plant is rated for {nominal}. Expand it to unlock capacity.',
  'insight.idleCapacity.title': 'Plants are only {util}% used', 'insight.idleCapacity.why': 'Idle capacity still carries fixed costs. Add a model, raise volume, or consider selling a plant.',
  'insight.soldOut.title': '{name} is sold out', 'insight.soldOut.why': 'Buyers want {demand} a month but only {sold} are being sold. Add capacity or raise the price.',
  'insight.supplyDisruption.title': 'Supplier disruption', 'insight.supplyDisruption.why': '{suppliers} supplier(s) are delivering late for up to {months} more months; {loss}% of planned output was lost last month. Use safety stock or a second source.',
  'insight.engineersShort.title': 'Development is understaffed', 'insight.engineersShort.why': 'Your programmes need about {need} engineers for full speed and you employ {have}. Hire more or accept delays.',
  'insight.boardDeadline.title': 'Board objective at risk', 'insight.boardDeadline.why': '“{text}” is due by {year} and is {pct}% complete.',
  'insight.boardConfidence.title': 'Board confidence is low ({confidence}%)', 'insight.boardConfidence.why': 'Below 20% the board can dismiss you. Meet its objectives and return to profit.',
  'insight.ageingRange.title': '{name} is {years} years old', 'insight.ageingRange.why': 'Buyers favour newer designs. Plan a facelift or a new generation.',
  'insight.costlyDebt.title': 'Repay expensive debt', 'insight.costlyDebt.why': 'You hold {cash} in cash against {debt} of debt at {rate}% interest. Repaying part of it lifts profit.',
  'go.vehicles': 'Open vehicles', 'go.factories': 'Open factories', 'go.market': 'Open market', 'go.finance': 'Open finance', 'go.research': 'Open research', 'go.company': 'Open board', 'go.motorsport': 'Open motorsport',
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
