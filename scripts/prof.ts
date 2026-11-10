import { newCeoGame, advanceMonth } from '../src/sim/world';
import { computeMarket } from '../src/sim/market';
import { refreshStats } from '../src/sim/company';
const g = newCeoGame({ makerId: 'toyota', year: 2000, difficulty: 'normal', historyMode: 'historical' });
let t = Date.now(); for (let i = 0; i < 20; i++) computeMarket(g); console.log('market x20', Date.now() - t);
const models = g.companies.flatMap((c) => c.models); console.log('models', models.length);
t = Date.now(); for (const m of models) refreshStats(g, m); console.log('refresh all', Date.now() - t);
for (let k = 0; k < 14; k++) { t = Date.now(); advanceMonth(g); console.log('month', g.month, g.year, Date.now() - t); }
