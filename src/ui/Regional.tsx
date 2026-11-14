// Regional prices of one model.
import { useMemo, useState } from 'react';
import type { RegionId, VehicleModel } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { setRegionalPrice } from '../sim/actions';
import { computeMarket, tariff } from '../sim/market';
import { CURRENCY, SALES_TAX, fxNow, localPrice, regionalPrice, regionalValue } from '../sim/regional';
import { REGIONS } from '../data/world';
import { cpi } from '../sim/util';
import { useT } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num } from '../i18n/format';
import { ImpactPreview } from './Impact';

export function RegionalPricing({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const mk = useMemo(() => computeMarket(g), [g.year, g.month, m.price, JSON.stringify(m.regional ?? {})]);
  const dem = mk.demand.get(m.id);
  const [edit, setEdit] = useState<{ r: RegionId; v: number } | null>(null);
  if (m.status !== 'production' || !(m.price > 0)) return null;
  const local = (r: RegionId) => p.factories.some((f) => f.region === r && f.lines.some((l) => l.modelId === m.id));
  return (
    <div className="panel col">
      <h3>{t('rp.title')} <span className="tiny muted">({t('rp.titleNote')})</span></h3>
      <p className="tiny muted">{t('rp.intro')}</p>
      <div className="tablewrap"><table>
        <thead><tr><th>{t('rp.c.market')}</th><th className="r">{t('rp.c.demand')}</th><th className="r">{t('rp.c.sold')}</th><th className="r">{t('rp.c.value')}</th><th className="r">{t('rp.c.tax')}</th><th className="r">{t('rp.c.tariff')}</th><th className="r">{t('rp.c.currency')}</th><th className="r">{t('rp.c.price')}</th><th className="r">{t('rp.c.local')}</th><th className="r">{t('rp.c.suggested')}</th><th /></tr></thead>
        <tbody>{REGIONS.map(({ id: r, name }) => {
          const tf = tariff(g, p, m, r), suggested = (m.price * regionalValue(g, r)) / (1 + tf);
          const set = !!m.regional?.[r];
          return (
            <tr key={r}><td><b>{term(name)}</b><div className="tiny muted">{CURRENCY[r]}</div></td>
              <td className="r">{fmtNum(dem?.[r] ?? 0)}</td><td className="r">{fmtNum(m.lastSales[r])}</td>
              <td className="r">{Math.round(regionalValue(g, r) * 100)}%</td><td className="r">{Math.round(SALES_TAX[r] * 100)}%</td>
              <td className="r">{Math.round(tf * 100)}% · {fmtMoney((local(r) ? 150 : 700) * cpi(g.year))}</td>
              <td className="r">{fxNow(g, r).toFixed(3)}</td>
              <td className="r">{set ? <b>{fmtMoney(regionalPrice(g, m, r))}</b> : <span className="muted">{fmtMoney(m.price)}</span>}</td>
              <td className="r">{set ? fmtNum(localPrice(g, m, r)) : '—'}</td>
              <td className="r">{fmtMoney(suggested)}</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}>
                {edit?.r === r ? <>
                  <input type="number" aria-label={t('rp.priceIn', { name: term(name) })} style={{ width: 90 }} value={Math.round(edit.v)} onChange={(e) => setEdit({ r, v: Number(e.target.value) })} />
                  <button className="btn sm" onClick={() => { if (act((gg) => setRegionalPrice(gg, m.id, r, edit.v), t('rp.setDone'))) setEdit(null); }}>{t('rp.set')}</button>
                </> : <button className="btn sm" onClick={() => setEdit({ r, v: Math.round(set ? regionalPrice(g, m, r) : suggested) })}>{t('rp.price')}</button>}
                {set && <button className="btn sm ghost" onClick={() => act((gg) => setRegionalPrice(gg, m.id, r, null), t('rp.worldDone'))}>{t('rp.world')}</button>}
              </td></tr>);
        })}</tbody></table></div>
      {edit && <ImpactPreview deps={[edit.r, edit.v]} horizon={6} run={(gg) => setRegionalPrice(gg, m.id, edit.r, edit.v)} />}
      <span className="tiny muted">{t('rp.note')}</span>
    </div>
  );
}
