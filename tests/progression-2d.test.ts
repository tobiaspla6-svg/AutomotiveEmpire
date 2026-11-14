import { describe,expect,it } from 'vitest';
import { founder,player } from './helpers';
import type { VehicleModel } from '../src/sim/types';
import {
  BLUEPRINTS, RARITY, MILESTONES, availableMilestones, effectiveOdds, equipPart,
  fixedPrice, lifetimeSales, openSalesChest, previewChest, redeemPart,
} from '../src/sim/progression';

describe('Phase 5 earned-only 2D progression',()=>{
  it('offers the welcome chest, preserves cash and is serializable',()=>{
    const g=founder({year:2000});
    const p=player(g),cash=p.cash,debt=p.debt,tech={...p.tech};
    expect(availableMilestones(p)).toEqual([0]);
    const prize=openSalesChest(g,0);
    expect(typeof prize).not.toBe('string');
    expect(p.arcade!.claimedMilestones).toEqual([0]);
    expect(Object.values(p.arcade!.inventory).reduce((a,b)=>a+b,0)).toBe(1);
    expect(p.arcade!.credits).toBeGreaterThan(0);
    expect(p.cash).toBe(cash);expect(p.debt).toBe(debt);expect(p.tech).toEqual(tech);
    const snap=JSON.parse(JSON.stringify(g));
    expect(player(snap).arcade).toEqual(p.arcade);
    expect(openSalesChest(g,0)).toBe('Chest already opened.');
  });

  it('only unlocks milestones on real cumulative model sales',()=>{
    const g=founder(),p=player(g);
    expect(lifetimeSales(p)).toBe(0);
    expect(openSalesChest(g,50)).toBe('Sales milestone not reached.');
    p.models.push({cumulativeUnits:260} as VehicleModel);
    expect(availableMilestones(p)).toEqual([0,50,250]);
    const reward=openSalesChest(g,50);
    expect(typeof reward).toBe('object');
    expect(availableMilestones(p)).toEqual([0,250]);
    expect(openSalesChest(g,5000)).toBe('Sales milestone not reached.');
  });

  it('discloses precisely adjusted probabilities by era',()=>{
    const overall=Object.values(RARITY).reduce((sum,x)=>sum+x.probability,0);
    expect(overall).toBeCloseTo(100,10);
    for(const year of [1950,1970,1995,2020,2030]){
      const odds=effectiveOdds(year);
      expect(Object.values(odds).reduce((a,b)=>a+b,0)).toBeCloseTo(100,8);
      for(const [rarity,chance] of Object.entries(odds)){
        if(chance>0&&rarity!=='common')
          expect(BLUEPRINTS.some(b=>b.rarity===rarity&&b.firstYear<=year)).toBe(true);
      }
    }
    expect(effectiveOdds(1950).common).toBe(100);
  });

  it('chooses deterministic era-appropriate rewards without burning simulation RNG',()=>{
    const g=founder({year:1965}),before=g.rng.s;
    const a=previewChest(g,0),b=previewChest(g,0);
    expect(a).toEqual(b);
    expect(a.firstYear).toBeLessThanOrEqual(1965);
    expect(g.rng.s).toBe(before);
    expect(MILESTONES).toHaveLength(6);
  });

  it('allows equipping only inventory pieces and redeems for fixed earned prices',()=>{
    const g=founder({year:2000}),p=player(g);
    expect(equipPart(g,'forged')).toBe('Blueprint not owned.');
    expect(redeemPart(g,'forged')).toBe('Not enough earned credits.');
    openSalesChest(g,0);
    const id=Object.keys(p.arcade!.inventory)[0];
    expect(equipPart(g,id)).toBeNull();
    const found=BLUEPRINTS.find(x=>x.id===id)!;
    expect(p.arcade!.equipped[found.slot]).toBe(id);
    expect(redeemPart(g,id)).toBe('Blueprint already owned.');
    p.arcade!.credits=fixedPrice('rare');
    expect(redeemPart(g,'five-spoke')).toBeNull();
    expect(p.arcade!.credits).toBe(0);
    expect(p.arcade!.inventory['five-spoke']).toBe(1);
  });

  it('never makes future technology or paid random drops available in old eras',()=>{
    const g=founder({year:1970}),p=player(g);
    expect(redeemPart(g,'prototype')).toBe('Blueprint not invented in this era.');
    p.arcade={claimedMilestones:[],inventory:{prototype:1},equipped:{},credits:99999};
    expect(equipPart(g,'prototype')).toBe('Not available in this era.');
  });
});
