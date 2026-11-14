/** Earned-only collectible blueprints. No paid chance-based purchases. */
import type { Company, GameState } from './types';
import { player } from './world';

export type PartSlot = 'engine' | 'chassis' | 'body' | 'wheels';
export type PartRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'relic';
export interface Blueprint {
  id: string; es: string; en: string; slot: PartSlot; rarity: PartRarity; firstYear: number;
}
export interface ArcadeProgress {
  claimedMilestones: number[];
  inventory: Record<string, number>;
  equipped: Partial<Record<PartSlot, string>>;
  credits: number;
}
export interface ChestResult { part: Blueprint; duplicate: boolean; creditsAdded: number; milestone: number }
export const MILESTONES = [0, 50, 250, 1000, 5000, 20000] as const;
export const RARITY: Record<PartRarity, { es: string; en: string; color: string; probability: number }> = {
  common: { es: 'Común', en: 'Common', color: '#a8b5bf', probability: 49.9 },
  rare: { es: 'Raro', en: 'Rare', color: '#66b4f5', probability: 30 },
  epic: { es: 'Épico', en: 'Epic', color: '#be83ff', probability: 14 },
  legendary: { es: 'Legendario', en: 'Legendary', color: '#f0c36c', probability: 5 },
  mythic: { es: 'Mítico', en: 'Mythic', color: '#ef7eac', probability: 1 },
  relic: { es: 'Reliquia', en: 'Relic', color: '#75ead0', probability: 0.1 },
};
export const BLUEPRINTS: readonly Blueprint[] = [
  {id:'steel-rims',es:'Llantas de acero',en:'Steel wheels',slot:'wheels',rarity:'common',firstYear:1950},
  {id:'inline-four',es:'Tapa de cuatro cilindros',en:'Four-cylinder cover',slot:'engine',rarity:'common',firstYear:1950},
  {id:'sedan',es:'Silueta sedán',en:'Sedan silhouette',slot:'body',rarity:'common',firstYear:1950},
  {id:'steel-frame',es:'Bastidor clásico',en:'Classic steel frame',slot:'chassis',rarity:'common',firstYear:1950},
  {id:'five-spoke',es:'Llantas deportivas',en:'Sport five-spoke wheels',slot:'wheels',rarity:'rare',firstYear:1965},
  {id:'aluminium-v6',es:'V6 de aluminio',en:'Aluminium V6',slot:'engine',rarity:'rare',firstYear:1985},
  {id:'fastback',es:'Carrocería fastback',en:'Fastback silhouette',slot:'body',rarity:'rare',firstYear:1965},
  {id:'independent',es:'Suspensión independiente',en:'Independent suspension',slot:'chassis',rarity:'rare',firstYear:1965},
  {id:'forged',es:'Llantas forjadas',en:'Forged performance wheels',slot:'wheels',rarity:'epic',firstYear:1995},
  {id:'twinturbo',es:'Admisión biturbo',en:'Twin-turbo intake',slot:'engine',rarity:'epic',firstYear:1990},
  {id:'aero-gt',es:'Gran turismo aerodinámico',en:'Aerodynamic grand tourer',slot:'body',rarity:'epic',firstYear:1990},
  {id:'spaceframe',es:'Estructura spaceframe',en:'Spaceframe structure',slot:'chassis',rarity:'epic',firstYear:1990},
  {id:'race-v8',es:'V8 de competición',en:'Competition V8',slot:'engine',rarity:'legendary',firstYear:1970},
  {id:'endurance',es:'GT de resistencia',en:'Endurance GT',slot:'body',rarity:'legendary',firstYear:1985},
  {id:'carbon-frame',es:'Monocasco de carbono',en:'Carbon monocoque',slot:'chassis',rarity:'legendary',firstYear:1995},
  {id:'hybrid',es:'Híbrido extremo',en:'Extreme hybrid unit',slot:'engine',rarity:'mythic',firstYear:2015},
  {id:'hyperbody',es:'Hiperdeportivo',en:'Hypercar silhouette',slot:'body',rarity:'mythic',firstYear:2010},
  {id:'prototype',es:'Prototipo experimental',en:'Experimental prototype',slot:'engine',rarity:'relic',firstYear:2020},
];
export const emptyArcade = (): ArcadeProgress => ({claimedMilestones:[],inventory:{},equipped:{},credits:0});
export function lifetimeSales(c: Company) {
  return Math.max(0,Math.floor(c.models.reduce((sum,m)=>sum+Math.max(0,Number.isFinite(m.cumulativeUnits)?m.cumulativeUnits:0),0)));
}
export function availableMilestones(c: Company) {
  return MILESTONES.filter(n=>lifetimeSales(c)>=n && !c.arcade?.claimedMilestones.includes(n));
}
function hash(value: string) {
  let h=2166136261;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);
  return h>>>0;
}
function random(seed:number) {
  let x=seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;
}
function draw(seed:number):PartRarity {
  let roll=random(seed)*100;
  for(const r of Object.keys(RARITY) as PartRarity[]) {
    roll-=RARITY[r].probability;if(roll<0)return r;
  }
  return 'relic';
}
export function previewChest(g:GameState,milestone:number):Blueprint {
  const seed=hash(g.playerId+':'+g.id+':'+milestone+':free-chest-v1');
  const rarity=draw(seed);
  let available=BLUEPRINTS.filter(b=>b.firstYear<=g.year && b.rarity===rarity);
  if(!available.length)available=BLUEPRINTS.filter(b=>b.firstYear<=g.year && b.rarity==='common');
  return available[Math.min(available.length-1,Math.floor(random(hash(String(seed)+':part'))*available.length))];
}
export function openSalesChest(g:GameState,milestone:number):ChestResult|string {
  const c=player(g);
  if(!(MILESTONES as readonly number[]).includes(milestone))return 'Unknown chest milestone.';
  if(lifetimeSales(c)<milestone)return 'Sales milestone not reached.';
  if(c.arcade?.claimedMilestones.includes(milestone))return 'Chest already opened.';
  const part=previewChest(g,milestone), a=c.arcade??=emptyArcade();
  const duplicate=!!a.inventory[part.id];
  const creditsAdded=duplicate?{common:15,rare:35,epic:75,legendary:160,mythic:350,relic:1000}[part.rarity]:0;
  a.inventory[part.id]=(a.inventory[part.id]??0)+1;
  a.claimedMilestones.push(milestone);a.credits+=creditsAdded;
  return {part,duplicate,creditsAdded,milestone};
}
export function fixedPrice(r:PartRarity) {
  return {common:25,rare:100,epic:350,legendary:900,mythic:2500,relic:10000}[r];
}
export function redeemPart(g:GameState,id:string):string|null {
  const part=BLUEPRINTS.find(b=>b.id===id);
  if(!part)return 'Unknown blueprint.';
  if(g.year<part.firstYear)return 'Blueprint not invented in this era.';
  const a=player(g).arcade??=emptyArcade(),price=fixedPrice(part.rarity);
  if(a.credits<price)return 'Not enough earned credits.';
  a.credits-=price;a.inventory[id]=(a.inventory[id]??0)+1;
  return null;
}
export function equipPart(g:GameState,id:string):string|null {
  const b=BLUEPRINTS.find(x=>x.id===id);
  if(!b)return 'Unknown blueprint.';
  if(g.year<b.firstYear)return 'Blueprint not available in this era.';
  const a=player(g).arcade;
  if(!a?.inventory[id])return 'Blueprint not owned.';
  a.equipped[b.slot]=id;return null;
}
