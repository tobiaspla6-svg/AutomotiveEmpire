// Phase 4D: accounting identities on the ledger (Δequity = profit, cash flow = Δcash) over 20 years of play with player actions between months.
// Run: npx tsx scripts/audit-accounting.ts
import { newCeoGame, newFounderGame, capitalOptions, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { resolveDecision } from '../src/sim/events';
import { defaultVehicle } from '../src/sim/engineering';
for (const [label, mk] of [['ceo bmw 1990',()=>newCeoGame({makerId:'bmw',year:1990,difficulty:'normal',historyMode:'historical',seed:11})],['founder 2005',()=>newFounderGame({name:'A',country:'Italy',year:2005,capital:capitalOptions(2005)[2],specialization:'sports',factory:2,engineers:1,research:1,workforce:1,color:'#fff',difficulty:'normal',historyMode:'historical',seed:5})]] as const) {
  const g=(mk as any)(); const p=player(g);
  let bad=0, worst=0, n=0, cashBad=0;
  for(let i=0;i<240&&!g.gameOver;i++){
    // between-tick player actions (these were the suspected cause of the mismatch)
    if(i%7===3){ A.setMarketing(g, 200000); A.investDealers(g,'NA',3e6); }
    if(i%11===5 && p.factories.length) A.upgradeAutomation(g,p.factories[0].id,Math.min(0.9,p.factories[0].automation+0.1));
    if(i%13===2) A.takeLoan(g, 2e6); if(i%17===4) A.repayLoan(g,1e6);
    if(g.decision) resolveDecision(g,0,g.rng);
    advanceMonth(g);
    const L=p.ledger.at(-1)!, P=p.ledger.at(-2); if(!P) continue; n++;
    const d=(L.equity-P.equity)-L.profit; if(Math.abs(d)>1000){ bad++; worst=Math.max(worst,Math.abs(d)); }
    const dc=(L.cash-L.cashStart)-(L.operatingCash+L.investingCash+L.financingCash); if(Math.abs(dc)>1000) cashBad++;
  }
  console.log(label,'months',n,'equity≠profit',bad,'worst',(worst/1e6).toFixed(2)+'M','cashflow≠Δcash',cashBad);
}
