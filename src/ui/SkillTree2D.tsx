import { useState } from 'react';
import type { TechArea } from '../sim/types';
import { TECHS } from '../data/tech';
import { researchRef } from '../sim/company';
import { setRd } from '../sim/actions';
import { useGame,useStore } from '../store/game';
import { useT } from '../i18n';
import { money,num } from '../i18n/format';

const BRANCHES:readonly {id:TechArea;icon:string;es:string;en:string;subEs:string;subEn:string}[]=[
  {id:'engine',icon:'⚙',es:'Motores',en:'Powertrains',subEs:'Inyección, turbos y electrificación',subEn:'Fuel injection, boost and EVs'},
  {id:'chassis',icon:'⬡',es:'Chasis',en:'Chassis',subEs:'Frenos, suspensiones y materiales',subEn:'Brakes, suspension and materials'},
  {id:'aero',icon:'↗',es:'Aerodinámica',en:'Aerodynamics',subEs:'Carga y resistencia al aire',subEn:'Downforce and drag'},
  {id:'electronics',icon:'⌁',es:'Electrónica',en:'Electronics',subEs:'Seguridad y sistemas de asistencia',subEn:'Safety and driver assistance'},
  {id:'manufacturing',icon:'▦',es:'Fabricación',en:'Manufacturing',subEs:'Automatización y fábricas digitales',subEn:'Automation and digital factories'},
];

export function SkillTree2D() {
  const {g,p}=useGame(),{lang}=useT(),es=lang==='es';
  const act=useStore(s=>s.act),save=useStore(s=>s.save);
  const [selected,setSelected]=useState<TechArea>('engine');
  const [monthly,setMonthly]=useState<number|null>(null);
  const target=BRANCHES.find(a=>a.id===selected)!;
  const value=p.tech[selected],reference=researchRef(g.year);
  const budget=monthly??p.rdBudget[selected];
  const historical=TECHS.filter(t=>t.area===selected).sort((a,b)=>a.year-b.year);
  const learned=historical.filter(t=>t.year<=value);
  const future=historical.filter(t=>t.year>value);
  const now=g.year+(g.month-1)/12;
  const choose=(id:TechArea)=>{setSelected(id);setMonthly(null);};
  const commit=()=>{
    if(!Number.isFinite(budget)||budget<0)return;
    if(act(gg=>{setRd(gg,selected,budget);return null;},es?'Inversión mensual en investigación actualizada.':'Monthly research investment updated.'))void save('autosave');
  };
  return <section className="ae2d ae2d-skills">
    <header className="ae2d-heading">
      <span className="ae2d-kicker">{es?'ÁRBOL DE HABILIDADES TECNOLÓGICAS':'TECHNOLOGY SKILL TREE'}</span>
      <h2>{es?'Desbloqueá el futuro.':'Unlock the future.'}</h2>
      <p>{es?'Cada tecnología aparece cuando tu equipo alcanza el nivel de ingeniería correspondiente. Invertí dinero de la empresa en investigación para avanzar.':'Research spending advances your real engineering capabilities and unlocks technology. No artificial loot-based power bonuses.'}</p>
    </header>
    <div className="ae2d-skill-branches" role="tablist" aria-label={es?'Áreas de investigación':'Research areas'}>
      {BRANCHES.map(a=>{
        const count=TECHS.filter(x=>x.area===a.id&&x.year<=p.tech[a.id]).length;
        const total=TECHS.filter(x=>x.area===a.id).length;
        return <button role="tab" key={a.id} aria-selected={selected===a.id} className={'ae2d-skill-branch'+(selected===a.id?' on':'')} onClick={()=>choose(a.id)}>
          <span aria-hidden="true">{a.icon}</span><b>{es?a.es:a.en}</b><small>{count} / {total}</small>
          <i><em style={{width:(total?count/total*100:0)+'%'}}/></i>
        </button>;
      })}
    </div>
    <div className="ae2d-skill-layout">
      <div className="ae2d-skill-track">
        <div className="ae2d-skill-track-head">
          <div><span className="ae2d-kicker">{es?'RAMA DE INVESTIGACIÓN':'RESEARCH BRANCH'}</span><h3>{es?target.es:target.en}</h3><p>{es?target.subEs:target.subEn}</p></div>
          <div className="ae2d-skill-year"><small>{es?'NIVEL TECNOLÓGICO':'TECH LEVEL'}</small><strong>{value.toFixed(1)}</strong></div>
        </div>
        <div className="ae2d-skill-timeline">
          {historical.length===0?<p>{es?'Sin desarrollos en esta rama.':'No advances yet.'}</p>:historical.map((tech,index)=>{
            const owned=tech.year<=value;
            const next=!owned&&index===learned.length;
            return <div key={tech.id} className={'ae2d-skill-node'+(owned?' done':next?' next':' locked')}>
              <span className="ae2d-skill-node-icon" aria-hidden="true">{owned?'✓':next?'◇':'🔒'}</span>
              <div><b>{tech.name}</b><small>{tech.year} · {owned?(es?'Descubierto':'Unlocked'):next?(es?'Próximo avance':'Next unlock'):(es?'Bloqueado':'Locked')}</small>{next&&tech.note&&<p>{tech.note}</p>}</div>
            </div>;
          })}
        </div>
      </div>
      <aside className="ae2d-skill-fund">
        <span className="ae2d-kicker">{es?'INVESTIGACIÓN Y DESARROLLO':'RESEARCH & DEVELOPMENT'}</span>
        <h3>{es?'Financiá la próxima tecnología':'Fund your next unlock'}</h3>
        <div className="ae2d-skill-metric"><span>{es?'Nivel actual':'Current level'}</span><strong>{value.toFixed(1)}</strong></div>
        <div className="ae2d-skill-metric"><span>{es?'Calendario':'Calendar year'}</span><strong>{now.toFixed(1)}</strong></div>
        <div className="ae2d-skill-metric"><span>{es?'Tecnologías disponibles':'Technologies unlocked'}</span><strong>{num(learned.length,lang)} / {num(historical.length,lang)}</strong></div>
        <label className="ae2d-skill-budget">{es?'Presupuesto mensual':'Monthly budget'}<strong>{money(budget,lang)}</strong>
          <input type="range" min="0" max={Math.max(reference*10,budget,p.rdBudget[selected])} step={Math.max(1000,Math.round(reference/20))} value={budget} onChange={e=>setMonthly(Number(e.target.value))}/>
        </label>
        <button className="ae2d-cta" disabled={budget===p.rdBudget[selected]} onClick={commit}>{es?'Confirmar inversión':'Confirm investment'}</button>
        {future.length>0?<p>{es?'Próximo descubrimiento: ':'Next discovery: '}<b>{future[0].name}</b> ({future[0].year}).</p>:<p>{es?'Descubriste todas las tecnologías actuales de esta rama.':'All currently catalogued technologies unlocked.'}</p>}
        <p className="ae2d-soft">{es?'La inversión se descuenta mensualmente por las reglas económicas existentes. No compra directamente el descubrimiento.':'Your normal simulation pays this R&D budget every month; spending does not instantly unlock an advance.'}</p>
        <button className="ae2d-portal small" onClick={()=>useStore.getState().setView('research')}>{es?'Ver ingeniería avanzada':'Advanced R&D view'} ↗</button>
      </aside>
    </div>
  </section>;
}
