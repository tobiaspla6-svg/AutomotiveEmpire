import { useState } from 'react';
import type { GameState } from '../sim/types';
import { forecast, type Impact } from '../sim/forecast';
import { useGame } from '../store/game';
import { useT } from '../i18n';
import { money } from '../i18n/format';
import { StatLine } from './common';


/**
 * "Estimate impact" for a decision: plays the decision forward on a copy of the game (see sim/forecast.ts) and shows
 * the immediate cost, the monthly and cumulative effect, a before/after comparison and the main risks.
 */
export function ImpactPreview({ run, deps, horizon = 6 }: { run: (g: GameState) => string | null | void; deps: unknown[]; horizon?: number }) {
  const { g } = useGame();
  const { t, lang } = useT();
  const fmtMoney = (v: number) => money(v, lang);
  const signed = (v: number) => <span className={v < 0 ? 'bad' : v > 0 ? 'good' : ''}>{v > 0 ? '+' : ''}{fmtMoney(v)}</span>;
  const [res, setRes] = useState<{ key: string; impact: Impact } | null>(null);
  const key = JSON.stringify([g.year, g.month, ...deps]);
  const shown = res && res.key === key ? res.impact : null;
  return (
    <div className="col" style={{ gap: 3 }}>
      {!shown && <div className="row"><button className="btn sm ghost" onClick={() => setRes({ key, impact: forecast(g, run, horizon) })}>{t('impact.estimate')}</button></div>}
      {shown && (shown.error ? <p className="small bad">{shown.error}</p> : (
        <div className="col" style={{ gap: 2 }}>
          <span className="tiny muted">{t('impact.note', { n: shown.horizon })}</span>
          <StatLine label={t('impact.paidNow')} value={fmtMoney(shown.upfront)} />
          <StatLine label={t('impact.monthlyProfit')} value={signed(shown.monthlyProfit)} /><StatLine label={t('impact.monthlyCash')} value={signed(shown.monthlyCash)} />
          <StatLine label={t('impact.netCash', { n: shown.horizon })} value={signed(shown.netCash)} />
          <StatLine label={t('impact.debt')} value={<>{fmtMoney(shown.before.debt)} → <b>{fmtMoney(shown.after.debt)}</b></>} />
          <StatLine label={t('impact.headroom')} value={<>{fmtMoney(shown.before.headroom)} → <b className={shown.after.headroom < 0 ? 'bad' : ''}>{fmtMoney(shown.after.headroom)}</b></>} />
          <StatLine label={t('impact.profit')} value={<>{fmtMoney(shown.before.monthlyProfit)} → <b>{fmtMoney(shown.after.monthlyProfit)}</b></>} />
          {shown.risks.map((r) => <div key={r} className="tiny warn">⚠ {r}</div>)}
          <div className="row"><button className="btn sm ghost" onClick={() => setRes(null)}>{t('impact.hide')}</button></div>
        </div>
      ))}
    </div>
  );
}
