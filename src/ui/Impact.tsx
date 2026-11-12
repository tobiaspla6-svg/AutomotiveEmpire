import { useState } from 'react';
import type { GameState } from '../sim/types';
import { forecast, type Impact } from '../sim/forecast';
import { useGame } from '../store/game';
import { fmtMoney } from '../sim/util';
import { StatLine } from './common';

const signed = (v: number) => <span className={v < 0 ? 'bad' : v > 0 ? 'good' : ''}>{v > 0 ? '+' : ''}{fmtMoney(v)}</span>;

/**
 * "Estimate impact" for a decision: plays the decision forward on a copy of the game (see sim/forecast.ts) and shows
 * the immediate cost, the monthly and cumulative effect, a before/after comparison and the main risks.
 */
export function ImpactPreview({ run, deps, horizon = 6 }: { run: (g: GameState) => string | null | void; deps: unknown[]; horizon?: number }) {
  const { g } = useGame();
  const [res, setRes] = useState<{ key: string; impact: Impact } | null>(null);
  const key = JSON.stringify([g.year, g.month, ...deps]);
  const shown = res && res.key === key ? res.impact : null;
  return (
    <div className="col" style={{ gap: 3 }}>
      {!shown && <div className="row"><button className="btn sm ghost" onClick={() => setRes({ key, impact: forecast(g, run, horizon) })}>Estimate impact</button></div>}
      {shown && (shown.error ? <p className="small bad">{shown.error}</p> : (
        <div className="col" style={{ gap: 2 }}>
          <span className="tiny muted">Estimate: this decision played forward {shown.horizon} months against not taking it. One possible future, not a guarantee.</span>
          <StatLine label="Paid now" value={fmtMoney(shown.upfront)} />
          <StatLine label="Effect on monthly profit" value={signed(shown.monthlyProfit)} /><StatLine label="Effect on monthly cash flow" value={signed(shown.monthlyCash)} />
          <StatLine label={`Net cash after ${shown.horizon} months`} value={signed(shown.netCash)} />
          <StatLine label="Debt" value={<>{fmtMoney(shown.before.debt)} → <b>{fmtMoney(shown.after.debt)}</b></>} />
          <StatLine label="Credit headroom" value={<>{fmtMoney(shown.before.headroom)} → <b className={shown.after.headroom < 0 ? 'bad' : ''}>{fmtMoney(shown.after.headroom)}</b></>} />
          <StatLine label="Monthly profit" value={<>{fmtMoney(shown.before.monthlyProfit)} → <b>{fmtMoney(shown.after.monthlyProfit)}</b></>} />
          {shown.risks.map((r) => <div key={r} className="tiny warn">⚠ {r}</div>)}
          <div className="row"><button className="btn sm ghost" onClick={() => setRes(null)}>Hide</button></div>
        </div>
      ))}
    </div>
  );
}
