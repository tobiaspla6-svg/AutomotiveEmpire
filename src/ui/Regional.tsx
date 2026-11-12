// Regional prices of one model.
import { useMemo, useState } from 'react';
import type { RegionId, VehicleModel } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { setRegionalPrice } from '../sim/actions';
import { computeMarket, tariff } from '../sim/market';
import { CURRENCY, SALES_TAX, fxNow, localPrice, regionalPrice, regionalValue } from '../sim/regional';
import { REGIONS } from '../data/world';
import { cpi, fmtMoney, fmtNum } from '../sim/util';
import { ImpactPreview } from './Impact';

export function RegionalPricing({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const mk = useMemo(() => computeMarket(g), [g.year, g.month, m.price, JSON.stringify(m.regional ?? {})]);
  const dem = mk.demand.get(m.id);
  const [edit, setEdit] = useState<{ r: RegionId; v: number } | null>(null);
  if (m.status !== 'production' || !(m.price > 0)) return null;
  const local = (r: RegionId) => p.factories.some((f) => f.region === r && f.lines.some((l) => l.modelId === m.id));
  return (
    <div className="panel col">
      <h3>Regional prices <span className="tiny muted">(estimates; currencies and purchasing power are generated game data)</span></h3>
      <p className="tiny muted">Without a regional price the car sells at its world price everywhere. A regional price is fixed in local currency, so its dollar value rises and falls with the exchange rate. Buyers compare it with what the car is worth to them in that market: purchasing power and sales taxes differ, and imported cars pay tariffs and shipping.</p>
      <div className="tablewrap"><table>
        <thead><tr><th>Market</th><th className="r">Demand / mo</th><th className="r">Sold / mo</th><th className="r">Value to buyers</th><th className="r">Sales tax</th><th className="r">Tariff · shipping</th><th className="r">Currency</th><th className="r">Price ($)</th><th className="r">Local list</th><th className="r">Suggested</th><th /></tr></thead>
        <tbody>{REGIONS.map(({ id: r, name }) => {
          const t = tariff(g, p, m, r), suggested = (m.price * regionalValue(g, r)) / (1 + t);
          const set = !!m.regional?.[r];
          return (
            <tr key={r}><td><b>{name}</b><div className="tiny muted">{CURRENCY[r]}</div></td>
              <td className="r">{fmtNum(dem?.[r] ?? 0)}</td><td className="r">{fmtNum(m.lastSales[r])}</td>
              <td className="r">{Math.round(regionalValue(g, r) * 100)}%</td><td className="r">{Math.round(SALES_TAX[r] * 100)}%</td>
              <td className="r">{Math.round(t * 100)}% · {fmtMoney((local(r) ? 150 : 700) * cpi(g.year))}</td>
              <td className="r">{fxNow(g, r).toFixed(3)}</td>
              <td className="r">{set ? <b>{fmtMoney(regionalPrice(g, m, r))}</b> : <span className="muted">{fmtMoney(m.price)}</span>}</td>
              <td className="r">{set ? fmtNum(localPrice(g, m, r)) : '—'}</td>
              <td className="r">{fmtMoney(suggested)}</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}>
                {edit?.r === r ? <>
                  <input type="number" aria-label={`Price in ${name}`} style={{ width: 90 }} value={Math.round(edit.v)} onChange={(e) => setEdit({ r, v: Number(e.target.value) })} />
                  <button className="btn sm" onClick={() => { if (act((gg) => setRegionalPrice(gg, m.id, r, edit.v), 'Regional price set.')) setEdit(null); }}>Set</button>
                </> : <button className="btn sm" onClick={() => setEdit({ r, v: Math.round(set ? regionalPrice(g, m, r) : suggested) })}>Price</button>}
                {set && <button className="btn sm ghost" onClick={() => act((gg) => setRegionalPrice(gg, m.id, r, null), 'Back to the world price.')}>World</button>}
              </td></tr>);
        })}</tbody></table></div>
      {edit && <ImpactPreview deps={[edit.r, edit.v]} horizon={6} run={(gg) => setRegionalPrice(gg, m.id, edit.r, edit.v)} />}
      <span className="tiny muted">"Value to buyers" is what the car is worth there relative to the world value (purchasing power and taxes). "Suggested" keeps the same price-to-value ratio as the world price after the tariff. The currency index is local units per dollar, 1.000 at the start.</span>
    </div>
  );
}
