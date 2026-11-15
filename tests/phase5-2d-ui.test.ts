// Phase 5 UI acceptance at SSR level: actual React game views; no browser/WebGL required.
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll,describe,expect,it } from 'vitest';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { EmpireHub2D,Workshop2D,Collection2D,FactoryFloor2D,Campaigns2D,League2D,type CoTab } from '../src/ui/Empire2D';
import { SkillTree2D } from '../src/ui/SkillTree2D';
import { founder } from './helpers';

const live=()=>Object.assign(useStore.getInitialState(),useStore.getState());
const render=(c:ComponentType)=>{live();return renderToString(createElement(c));};

beforeAll(()=>{
 const mem=new Map<string,string>();
 (globalThis as Record<string,unknown>).localStorage={
  getItem:(k:string)=>mem.get(k)??null,
  setItem:(k:string,v:string)=>{mem.set(k,v)},
  removeItem:(k:string)=>{mem.delete(k)},
 };
});

describe('Phase 5 game-first 2D screens',()=>{
 it('starts at the 2D headquarters, not the old dashboard',()=>{
   setLang('en');useStore.getState().start(founder());
   expect(useStore.getState().view).toBe('hq2d');
   const h=render(EmpireHub2D);
   for(const phrase of ['Headquarters','Head office','Design workshop','Research','Factory','Garage','Dealers','Motorsport','Your range','Objectives'])expect(h).toContain(phrase);
   expect(h).toContain('flow/bg/headquarters.webp');   // the Flow campus scene
   expect(h).toContain('data-spot="factory"'); // every building is a real button
   expect(h).toContain('guide-steps');          // the onboarding checklist lives on the landing screen
   expect(h).not.toContain('<canvas');
 });
 it('renders all 2D gameplay routes without WebGL',()=>{
   setLang('en');
   for(const c of [Workshop2D,FactoryFloor2D,Collection2D,Campaigns2D,League2D,SkillTree2D]){
     const h=render(c);
     expect(h).not.toContain('<canvas');
     expect(h).toContain('<button');
     expect(h.length).toBeGreaterThan(500);
   }
 });
 it('renders Spanish in the workshop and reveals the 5 build stages',()=>{
   setLang('es');
   const h=render(Workshop2D);
   for(const phrase of ['Taller de ingeniería','Motor','Chasis','Transmisión','Suspensión y frenos','Carrocería','Ruedas y neumáticos','Acabados','Aprobar'])expect(h).toContain(phrase);
   expect(h).not.toContain('<canvas');
   expect(h).toContain('data-engine="honda-k20"'); // the iconic-engine catalogue opens on the current decade (2000s)
   setLang('en');
 });
 it('shows achievements, the collection and fixed-price redemptions in their tabs',()=>{
   setLang('en');useStore.getState().start(founder({year:2000}));
   live();
   const goals=renderToString(createElement(Collection2D));
   expect(goals).toContain('data-goal="first-car"');
   const cards=renderToString(createElement(Collection2D as ComponentType<{initialTab?:CoTab}>,{initialTab:'cards'}));
   expect(cards).toContain('card2d');
   const shop=renderToString(createElement(Collection2D as ComponentType<{initialTab?:CoTab}>,{initialTab:'shop'}));
   expect(shop).toContain('Collector packs (future)');
   expect(shop).toContain('Mercado Pago');
 });
 it('showcases era-locked free chests and real technical unlocks',()=>{
   setLang('en');useStore.getState().start(founder({year:1950}));
   live();const c=renderToString(createElement(Collection2D as ComponentType<{initialTab?:CoTab}>,{initialTab:'chests'}));
   expect(c).not.toContain('49.9%'); // rarity weights unavailable in 1950 transfer to common
   expect(c).toContain('100'); // effective odds of common at 1950
   expect(c).toContain('Starter chest');
   const tech=render(SkillTree2D);
   expect(tech).toContain('TECHNOLOGY SKILL TREE');
   expect(tech).toContain('RESEARCH');
 });
});
