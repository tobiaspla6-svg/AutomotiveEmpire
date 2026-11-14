// Phase 5 — interactive, GPU-free 2D game surfaces over the existing simulation.
import { useState } from 'react';
import type { BodyType, EngineLayout, SegmentId, VehicleSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT } from '../i18n';
import { money, num, monthYear } from '../i18n/format';
import { starterVehicle, defaultVehicle } from '../sim/engineering';
import { annualUnits } from '../sim/company';
import { startDevelopment, setEngineers, setMarketing, investDealers } from '../sim/actions';
import { BLUEPRINTS, MILESTONES, RARITY, effectiveOdds, availableMilestones, equipPart, fixedPrice, lifetimeSales, openSalesChest, redeemPart, type ChestResult } from '../sim/progression';
import { posterForBody, CarPoster } from './ds/poster';
import { CampusArt2D, ChestArt2D, EngineArt2D } from './EmpireArt2D';

const BODY_OPTIONS: { id: BodyType; es: string; en: string; segment: SegmentId }[] = [
  { id:'hatch',es:'Compacto',en:'Hatchback',segment:'budget' },
  { id:'sedan',es:'Sedán',en:'Sedan',segment:'family' },
  { id:'coupe',es:'Gran turismo',en:'Grand tourer',segment:'sports' },
  { id:'suv',es:'SUV',en:'SUV',segment:'suv' },
  { id:'supercar',es:'Superdeportivo',en:'Supercar',segment:'supercar' },
];
const ENGINE_OPTIONS: {layout:EngineLayout;cc:number;from:number;es:string;en:string}[]=[
  {layout:'I4',cc:2000,from:1950,es:'Cuatro cilindros',en:'Inline four'},
  {layout:'I6',cc:3000,from:1950,es:'Seis en línea',en:'Straight six'},
  {layout:'V6',cc:3000,from:1965,es:'V6 moderno',en:'Modern V6'},
  {layout:'V8',cc:5000,from:1950,es:'V8 deportivo',en:'Performance V8'},
  {layout:'EV',cc:0,from:1990,es:'Eléctrico',en:'Electric'},
];
/** Factual historical reference names. Game presets are approximations, not official CAD/licensed parts. */
const ICONIC_ENGINES=[
  {id:'supra2jz',name:'Toyota 2JZ-GTE',from:1993,layout:'I6' as EngineLayout,cc:2997,aspiration:'twinturbo' as const,redline:6800,source:'Toyota Supra (1993)'},
  {id:'coyote',name:'Ford 5.0 Coyote',from:2011,layout:'V8' as EngineLayout,cc:4951,aspiration:'na' as const,redline:7000,source:'Mustang 5.0 (2011)'},
];
const label = (es: boolean, a: string, b: string) => es?a:b;

function PortalButton({view,children,small=false}:{view:string;children:React.ReactNode;small?:boolean}) {
  const setView=useStore(s=>s.setView);
  return <button className={'ae2d-portal'+(small?' small':'')} type="button" onClick={()=>setView(view)}>{children}<span aria-hidden="true">↗</span></button>;
}
function Headline({kicker,title,sub}:{kicker:string;title:string;sub?:string}) {
  return <header className="ae2d-heading"><span className="ae2d-kicker">{kicker}</span><h2>{title}</h2>{sub&&<p>{sub}</p>}</header>;
}
function Pill({children}:{children:React.ReactNode}) {return <span className="ae2d-pill">{children}</span>;}

export function EmpireHub2D() {
  const {g,p}=useGame(), {lang}=useT(), es=lang==='es';
  const sold=lifetimeSales(p), pending=availableMilestones(p);
  const active=p.models.filter(m=>m.status!=='retired');
  const next=MILESTONES.find(v=>v>sold);
  return <section className="ae2d">
    <div className="ae2d-hub-intro">
      <div><span className="ae2d-kicker">AUTOMOTIVE EMPIRE / {label(es,'TU IMPERIO','YOUR EMPIRE')}</span>
      <h2>{label(es,'Construí una leyenda.','Build a legend.')}</h2>
      <p>{label(es,'Entrá a cada edificio y tomá decisiones que cambian tu compañía.','Enter each building and make decisions that change your company.')}</p></div>
      <div className="ae2d-rank-badge"><span>{label(es,'AUTOS VENDIDOS','CARS SOLD')}</span><strong>{num(sold,lang)}</strong><small>{label(es,'Total de tu marca','Your brand total')}</small></div>
    </div>

    <div className="ae2d-campus" aria-label={label(es,'Mapa interactivo de tu empresa','Interactive company map')}>
      <CampusArt2D />
      <button className="ae2d-map-pin ae2d-pin-hq" onClick={()=>useStore.getState().setView('dashboard')}><b>{label(es,'OFICINAS','OFFICES')}</b><small>{label(es,'Informes','Reports')}</small></button>
      <button className="ae2d-map-pin ae2d-pin-factory" onClick={()=>useStore.getState().setView('factory2d')}><b>{label(es,'FÁBRICA','FACTORY')}</b><small>{p.factories.length} {label(es,'plantas','plants')}</small></button>
      <button className="ae2d-map-pin ae2d-pin-studio" onClick={()=>useStore.getState().setView('workshop2d')}><b>{label(es,'TALLER 2D','2D WORKSHOP')}</b><small>{label(es,'Diseñar auto','Build a car')}</small></button>
      <div className="ae2d-map-caption">{monthYear(g.month,g.year,lang)} · {p.name}</div>
    </div>

    <div className="ae2d-hub-actions">
      <article className="ae2d-feature ae2d-feature-gold">
        <span className="ae2d-kicker">{label(es,'ESTUDIO DE DISEÑO','DESIGN STUDIO')}</span>
        <div className="ae2d-feature-hero"><CarPoster kind={active[0]?posterForBody(active[0].spec.body):'coupe'} color={active[0]?.spec.color||p.color} equipped={p.arcade?.equipped} /></div>
        <h3>{active.length?active[0].name:label(es,'Tu primer auto empieza acá','Your first car starts here')}</h3>
        <p>{label(es,'Elegí motor, chasis, carrocería y detalles; después aprobá el desarrollo real.','Choose an engine, chassis, body and finish, then approve real development.')}</p>
        <PortalButton view="workshop2d">{label(es,'Diseñar auto','Design a car')}</PortalButton>
      </article>
      <article className="ae2d-feature ae2d-feature-purple">
        <span className="ae2d-kicker">{label(es,'RECOMPENSAS','REWARDS')}</span>
        <div className="ae2d-feature-chest"><ChestArt2D /></div>
        <h3>{pending.length?label(es,'Tenés un cofre para abrir','You have a chest to open'):label(es,'Coleccioná piezas','Collect blueprints')}</h3>
        <p>{next===undefined?label(es,'Alcanzaste todos los hitos actuales.','All current milestones reached.'):label(es,'Próximo hito: ','Next milestone: ')+num(next,lang)+label(es,' autos vendidos.',' cars sold.')}</p>
        <PortalButton view="collection2d">{label(es,'Ver cofres y piezas','Chests and parts')}</PortalButton>
      </article>
      <article className="ae2d-feature ae2d-feature-cyan">
        <span className="ae2d-kicker">{label(es,'TU MARCA','YOUR BRAND')}</span>
        <div className="ae2d-feature-number">{Math.round(p.awareness[p.homeRegion]||0)}<small>%</small></div>
        <h3>{label(es,'Hacé que te conozcan','Grow your reputation')}</h3>
        <p>{label(es,'Publicidad y concesionarios que afectan las ventas del simulador.','Real simulation actions: marketing and dealership reach.')}</p>
        <PortalButton view="campaign2d">{label(es,'Lanzar campaña','Launch a campaign')}</PortalButton>
      </article>
      <article className="ae2d-feature ae2d-feature-teal">
        <span className="ae2d-kicker">{label(es,'COMPETIDORES','RIVALS')}</span>
        <div className="ae2d-feature-number">{g.companies.filter(c=>c.alive).length}<small> {label(es,'marcas','brands')}</small></div>
        <h3>{label(es,'Subí en la clasificación','Climb the rankings')}</h3>
        <p>{label(es,'Compará ventas anuales con las marcas rivales de tu partida.','Compare real in-game annual sales with rival manufacturers.')}</p>
        <PortalButton view="league2d">{label(es,'Ver clasificación','View rankings')}</PortalButton>
      </article>
    </div>
    <div className="ae2d-footerlink"><PortalButton view="dashboard" small>{label(es,'Ver análisis avanzado','Advanced analysis')}</PortalButton><PortalButton view="vehicles" small>{label(es,'Catálogo de modelos','Vehicle catalogue')}</PortalButton></div>
  </section>;
}

type Step='engine'|'chassis'|'body'|'finish'|'approval';
const STEPS:Step[]=['engine','chassis','body','finish','approval'];
const STEP_ES:Record<Step,string>={engine:'Motor',chassis:'Chasis',body:'Carrocería',finish:'Acabados',approval:'Aprobar'};
const STEP_EN:Record<Step,string>={engine:'Engine',chassis:'Chassis',body:'Body',finish:'Finish',approval:'Approve'};

export function Workshop2D() {
  const {g,p}=useGame(),{lang}=useT(),es=lang==='es';
  const [spec,setSpec]=useState<VehicleSpec>(()=>({...(g.mode==='founder'?starterVehicle(g.year,p.specialization):defaultVehicle(g.year)),color:p.color}));
  const [name,setName]=useState('');
  const [stage,setStage]=useState<Step>('engine');
  const act=useStore(s=>s.act),save=useStore(s=>s.save),setView=useStore(s=>s.setView);
  const stageIndex=STEPS.indexOf(stage);
  const setEngine=(layout:EngineLayout,cc:number)=>{
    const ev=layout==='EV';
    setSpec(v=>({...v,drive:ev?'RWD':v.drive,engine:{...v.engine,layout,displacement:ev?v.engine.displacement:cc,
      aspiration:'na',boost:0,motorKw:ev?Math.max(125,v.engine.motorKw):0,batteryKwh:ev?Math.max(55,v.engine.batteryKwh):0}}));
  };
  const stageName=(id:Step)=>es?STEP_ES[id]:STEP_EN[id];
  const chooseBody=(body:BodyType)=>setSpec(v=>({...v,body,seats:body==='coupe'||body==='supercar'?2:body==='suv'?5:4}));
  const approve=()=>{
    const segment=BODY_OPTIONS.find(o=>o.id===spec.body)?.segment??'family';
    if(act(gg=>startDevelopment(gg,name,spec,segment),label(es,'Nuevo programa de desarrollo aprobado.','New vehicle programme approved.'))) {
      void save('autosave');setView('vehicles');
    }
  };
  return <section className="ae2d ae2d-studio">
    <div className="ae2d-back"><PortalButton view="hq2d" small>{label(es,'Volver a la sede','Back to HQ')}</PortalButton></div>
    <Headline kicker={label(es,'TALLER DE INGENIERÍA / 2D','ENGINEERING WORKSHOP / 2D')} title={label(es,'Construí tu próximo auto','Build your next car')} sub={label(es,'Una pieza a la vez. Las decisiones se transfieren al simulador cuando aprobás el proyecto.','One step at a time. Your choices become a real simulation project when approved.')} />
    <div className="ae2d-steps" role="tablist" aria-label={label(es,'Etapas de diseño','Design stages')}>
      {STEPS.map((id,i)=><button role="tab" key={id} className={stage===id?'active':''} aria-selected={stage===id} onClick={()=>setStage(id)}><small>{String(i+1).padStart(2,'0')}</small>{stageName(id)}</button>)}
    </div>
    <div className="ae2d-workshop-layout">
      <div className="ae2d-workbench">
        {stage==='engine'&&<>
          <h3>{label(es,'1. Elegí el corazón del auto','1. Choose the heart of the car')}</h3>
          <div className="ae2d-engine-options">{ENGINE_OPTIONS.map(x=><button key={x.layout} disabled={g.year<x.from} className={spec.engine.layout===x.layout?'on':''} onClick={()=>setEngine(x.layout,x.cc)}><b>{x.layout}</b><small>{label(es,x.es,x.en)}</small><span>{g.year<x.from?label(es,'No disponible en esta época','Not in this era'):x.cc?((x.cc/1000).toFixed(1)+' L'):'EV'}</span></button>)}</div>
          <h4>{label(es,'Motores icónicos de la historia','Iconic real-world engines')}</h4>
          <p className="ae2d-soft">{label(es,'Referencias históricas: aplican parámetros aproximados, no piezas oficiales ni diseños licenciados.','Historic references: approximated specs, not official or licensed parts.')}</p>
          <div className="ae2d-history-engines">{ICONIC_ENGINES.map(x=><button key={x.id} disabled={g.year<x.from} onClick={()=>setSpec(v=>({...v,drive:'RWD',engine:{...v.engine,layout:x.layout,displacement:x.cc,aspiration:x.aspiration,boost:x.aspiration==='twinturbo'?.8:0,redline:x.redline}}))}><b>{x.name}</b><small>{x.source}</small><span>{g.year<x.from?label(es,'A partir de ','From ')+x.from:label(es,'Usar como inspiración','Use as inspiration')}</span></button>)}</div>
        </>}
        {stage==='chassis'&&<>
          <h3>{label(es,'2. Armá la base','2. Choose the platform')}</h3>
          <div className="ae2d-pick-grid">{([
            {v:'steel' as const,from:1950,es:'Acero',en:'Steel'},
            {v:'spaceframe' as const,from:1960,es:'Spaceframe',en:'Spaceframe'},
            {v:'aluminium' as const,from:1985,es:'Aluminio',en:'Aluminium'},
            {v:'carbon' as const,from:1990,es:'Carbono',en:'Carbon'},
          ]).map(x=><button key={x.v} disabled={g.year<x.from} className={spec.chassis===x.v?'on':''} onClick={()=>setSpec(v=>({...v,chassis:x.v}))}><span className="ae2d-part-symbol">⬡</span><b>{label(es,x.es,x.en)}</b><small>{g.year<x.from?label(es,'No disponible todavía','Not yet available'):label(es,'Elegir chasis','Select chassis')}</small></button>)}</div>
          <div className="ae2d-controls"><label>{label(es,'Tracción','Drivetrain')}<select value={spec.drive} onChange={e=>setSpec(v=>({...v,drive:e.target.value as VehicleSpec['drive']}))}><option value="FWD">FWD</option><option value="RWD">RWD</option><option value="AWD">AWD</option></select></label></div>
        </>}
        {stage==='body'&&<>
          <h3>{label(es,'3. Dale una silueta','3. Shape the body')}</h3>
          <div className="ae2d-pick-grid">{BODY_OPTIONS.map(x=><button key={x.id} className={spec.body===x.id?'on':''} onClick={()=>chooseBody(x.id)}><CarPoster kind={posterForBody(x.id)} color={spec.color}/><b>{label(es,x.es,x.en)}</b></button>)}</div>
        </>}
        {stage==='finish'&&<>
          <h3>{label(es,'4. Personalizá el estilo','4. Make it yours')}</h3>
          <div className="ae2d-colors" role="group" aria-label={label(es,'Color de carrocería','Body colour')}>
            {['#e9b65d','#e1564b','#3381aa','#5e677a','#efeee5','#20242c','#4f9569'].map(x=><button key={x} style={{background:x}} className={spec.color===x?'on':''} aria-label={'Paint '+x} aria-pressed={spec.color===x} onClick={()=>setSpec(v=>({...v,color:x}))}/>)}
          </div>
          <div className="ae2d-controls">
            <label>{label(es,'Interior','Interior')}<select value={spec.interior} onChange={e=>setSpec(v=>({...v,interior:e.target.value as VehicleSpec['interior']}))}><option value="basic">{label(es,'Básico','Basic')}</option><option value="standard">{label(es,'Estándar','Standard')}</option><option value="premium">Premium</option><option value="luxury">{label(es,'Lujo','Luxury')}</option></select></label>
            <label>{label(es,'Calidad de fabricación','Build quality')} <strong>{Math.round(spec.quality*100)}%</strong><input type="range" min=".2" max=".9" step=".1" value={spec.quality} onChange={e=>setSpec(v=>({...v,quality:Number(e.target.value)}))}/></label>
          </div>
          <p className="ae2d-soft">{label(es,'Las piezas ganadas en cofres son cosméticas por ahora; no reemplazan chasis ni motores reales.','Chest blueprints are currently cosmetic; they do not replace simulation engines or chassis.')}</p>
        </>}
        {stage==='approval'&&<>
          <h3>{label(es,'5. Presentá el proyecto','5. Submit the programme')}</h3>
          <label className="ae2d-name-field">{label(es,'Nombre del modelo','Model name')}<input value={name} maxLength={50} onChange={e=>setName(e.target.value)} placeholder={label(es,'Ej. Aurora GT','e.g. Aurora GT')}/></label>
          <div className="ae2d-spec-summary"><span>{label(es,'Motor','Engine')} <b>{spec.engine.layout} {spec.engine.layout==='EV'?'':(spec.engine.displacement/1000).toFixed(1)+' L'}</b></span><span>{label(es,'Chasis','Chassis')} <b>{spec.chassis}</b></span><span>{label(es,'Carrocería','Body')} <b>{spec.body}</b></span><span>{label(es,'Calidad','Quality')} <b>{Math.round(spec.quality*100)}%</b></span></div>
          {p.engineers<5&&<div className="ae2d-warning">{label(es,'Necesitás al menos 5 ingenieros para empezar.','You need at least 5 engineers to begin.')} <button className="ae2d-cta muted" onClick={()=>act(gg=>setEngineers(gg,5))}>{label(es,'Contratar equipo','Hire engineers')}</button></div>}
          <button data-action="2d-start-development" className="ae2d-cta" disabled={!name.trim()||p.engineers<5} onClick={approve}>{label(es,'Aprobar desarrollo','Approve development')}</button>
          <p className="ae2d-soft">{label(es,'El simulador comprobará tecnología, compatibilidad, ingeniería y financiación antes de aprobarlo.','The simulator checks technology, compatibility, engineering staff and funding.')}</p>
        </>}
      </div>
      <aside className="ae2d-workshop-preview">
        <span className="ae2d-kicker">{label(es,'VISTA PREVIA 2D','2D PREVIEW')}</span>
        {stage==='engine'?<EngineArt2D layout={spec.engine.layout}/>:<CarPoster kind={posterForBody(spec.body)} color={spec.color} equipped={p.arcade?.equipped}/>}
        <div className="ae2d-preview-title">{name||label(es,'Proyecto sin nombre','Unnamed project')}</div>
        <div className="ae2d-spec-bars"><span>{label(es,'Era','Era')} <b>{g.year}</b></span><span>{label(es,'Diseño','Design')} <b>{stageIndex+1} / 5</b></span></div>
        <div className="ae2d-stage-footer"><button disabled={stageIndex===0} onClick={()=>setStage(STEPS[stageIndex-1])}>{label(es,'Anterior','Previous')}</button><button disabled={stageIndex===STEPS.length-1} onClick={()=>setStage(STEPS[stageIndex+1])}>{label(es,'Continuar','Continue')} →</button></div>
      </aside>
    </div>
  </section>;
}

export function Collection2D(){
  const {g,p}=useGame(), {lang}=useT(), es=lang==='es';
  const act=useStore(s=>s.act),save=useStore(s=>s.save);
  const [reward,setReward]=useState<ChestResult|null>(null);
  const odds=effectiveOdds(g.year);
  const sales=lifetimeSales(p),inventory=p.arcade?.inventory??{},credits=p.arcade?.credits??0;
  const open=(m:number)=>{
    const captured:{value?:ChestResult}={};
    const ok=act(gg=>{const r=openSalesChest(gg,m);if(typeof r==='string')return r;captured.value=r;return null;});
    if(ok&&captured.value){setReward(captured.value);void save('autosave');}
  };
  return <section className="ae2d ae2d-collection">
    <Headline kicker={label(es,'GARAJE DE RECOMPENSAS','REWARDS GARAGE')} title={label(es,'Coleccioná. Desbloqueá. Exhibí.','Collect. Unlock. Showcase.')} sub={label(es,'Conseguí cofres por tus ventas reales. Las piezas son cosméticas y no alteran la economía.','Earn chests from actual sales. These cosmetic parts do not alter your simulation.')}/>
    <div className="ae2d-collection-showcase"><div><span className="ae2d-kicker">{label(es,'AUTO PERSONALIZADO CON TUS PIEZAS','CUSTOMIZED CAR WITH YOUR PARTS')}</span><CarPoster kind="coupe" color={p.color} equipped={p.arcade?.equipped}/></div><p>{label(es,'Las piezas equipadas ya aparecen en la ilustración 2D. Son estéticas: los motores, el rendimiento y el dinero de la partida siguen independientes.','Equipped blueprints now visibly customize your 2D car. They do not alter simulation horsepower or finances.')}</p></div>
    <div className="ae2d-collection-header"><div><strong>{num(sales,lang)}</strong><span>{label(es,'AUTOS VENDIDOS','CARS SOLD')}</span></div><div><strong>{num(credits,lang)}</strong><span>{label(es,'CRÉDITOS GANADOS','EARNED CREDITS')}</span></div><div><strong>{Object.keys(inventory).length}</strong><span>{label(es,'PIEZAS ÚNICAS','UNIQUE PARTS')}</span></div></div>
    <div className="ae2d-collection-grid">
      {MILESTONES.map(m=>{
        const owned=p.arcade?.claimedMilestones.includes(m),unlocked=sales>=m;
        return <button className={'ae2d-chest-tile '+(owned?'claimed':unlocked?'ready':'locked')} key={m} disabled={!unlocked||owned} onClick={()=>open(m)}><ChestArt2D opened={owned}/><b>{m===0?label(es,'Cofre inicial','Starter chest'):num(m,lang)+' '+label(es,'ventas','sales')}</b><span>{owned?label(es,'Abierto','Opened'):unlocked?label(es,'Abrir cofre','Open chest'):label(es,'Bloqueado','Locked')}</span></button>;
      })}
    </div>
    <div className="ae2d-chance"><b>{label(es,'Probabilidades de cofres gratuitos','Free chest probabilities')}</b><div>{(Object.keys(RARITY) as (keyof typeof RARITY)[]).map(r=><span key={r} style={{color:RARITY[r].color}}>{label(es,RARITY[r].es,RARITY[r].en)} {odds[r]}%</span>)}</div></div>
    <h3 className="ae2d-section-title">{label(es,'Inventario y tienda con créditos ganados','Inventory and earned-credit shop')}</h3>
    <div className="ae2d-card-collection">{BLUEPRINTS.filter(b=>b.firstYear<=g.year).map(b=>{
      const own=inventory[b.id]||0,rarity=RARITY[b.rarity],equipped=p.arcade?.equipped[b.slot]===b.id;
      return <article className="ae2d-part-card" style={{borderColor:rarity.color}} key={b.id}>
        <span className="ae2d-rarity" style={{color:rarity.color}}>{label(es,rarity.es,rarity.en)}</span>
        <div className={'ae2d-part-art ae2d-part-'+b.slot} style={{color:rarity.color}} aria-hidden="true">{b.slot==='engine'?'⚙':b.slot==='wheels'?'◉':b.slot==='chassis'?'⬡':'◆'}</div>
        <h4>{label(es,b.es,b.en)}</h4><small>{b.slot.toUpperCase()} · {b.firstYear}</small>
        <button disabled={equipped||(!own&&credits<fixedPrice(b.rarity))} onClick={()=>{
          if(own){if(act(gg=>equipPart(gg,b.id)))void save('autosave');}
          else if(act(gg=>redeemPart(gg,b.id)))void save('autosave');
        }}>{equipped?label(es,'Equipado','Equipped'):own?label(es,'Equipar','Equip'):label(es,'Canjear ','Redeem ')+fixedPrice(b.rarity)}</button>
      </article>;
    })}</div>
    <p className="ae2d-soft">{label(es,'Sin pagos reales ni compras aleatorias. Los paquetes pagos de contenido fijo requieren una etapa posterior con licencias y servidor seguro.','No real payments or paid random rewards. Fixed-content packs require licensing and a secure backend in a later phase.')}</p>
    {reward&&<div className="ae2d-reveal-backdrop" role="dialog" aria-modal="true" aria-label={label(es,'Recompensa conseguida','Reward unlocked')}>
      <div className="ae2d-reveal"><span className="ae2d-kicker">{label(es,'¡COFRE ABIERTO!','CHEST OPENED!')}</span><ChestArt2D opened/><h2 style={{color:RARITY[reward.part.rarity].color}}>{label(es,reward.part.es,reward.part.en)}</h2><b>{label(es,RARITY[reward.part.rarity].es,RARITY[reward.part.rarity].en)}</b>{reward.creditsAdded>0&&<p>+{reward.creditsAdded} {label(es,'créditos','credits')}</p>}<button className="ae2d-cta" autoFocus onClick={()=>setReward(null)}>{label(es,'Continuar','Continue')}</button></div>
    </div>}
  </section>;
}

export function FactoryFloor2D(){
  const {g,p}=useGame(),{lang}=useT(),es=lang==='es';
  const setView=useStore(s=>s.setView), active=p.models.filter(m=>m.status==='ready'||m.status==='production');
  return <section className="ae2d">
    <Headline kicker={label(es,'PLANTA INDUSTRIAL','ASSEMBLY PLANT')} title={label(es,'De piezas a automóviles','From parts to cars')} sub={label(es,'Una fábrica se construye por etapas. El simulador mantiene los costos, la producción y las restricciones reales.','Production flows through real simulation stages and industrial constraints.')}/>
    <div className="ae2d-assembly">
      {[
        {id:1,es:'Materias primas',en:'Raw materials',sub:'01'},
        {id:2,es:'Chasis y carrocería',en:'Chassis & body',sub:'02'},
        {id:3,es:'Instalar motor',en:'Powertrain install',sub:'03'},
        {id:4,es:'Pintura y acabados',en:'Paint & finish',sub:'04'},
        {id:5,es:'Control de calidad',en:'Quality checks',sub:'05'},
      ].map(x=><div className="ae2d-assembly-step" key={x.id}><span>{x.sub}</span><div className="ae2d-assembly-machine" aria-hidden="true"><span>⚙</span><i/></div><b>{label(es,x.es,x.en)}</b></div>)}
    </div>
    <div className="ae2d-factory-info">
      <article><span>{label(es,'PLANTAS','PLANTS')}</span><strong>{p.factories.length}</strong><p>{label(es,'Talleres y plantas registrados en tu compañía','Factories currently owned by your company')}</p></article>
      <article><span>{label(es,'MODELOS LISTOS','READY MODELS')}</span><strong>{active.length}</strong><p>{label(es,'Modelos aprobados o en producción','Approved or producing models')}</p></article>
      <article><span>{label(es,'PRODUCCIÓN MENSUAL','MONTHLY PRODUCTION')}</span><strong>{num(p.ledger[p.ledger.length-1]?.production||0,lang)}</strong><p>{monthYear(g.month,g.year,lang)}</p></article>
    </div>
    <div className="ae2d-footerlink"><button className="ae2d-cta" onClick={()=>setView('factories')}>{label(es,'Gestionar líneas y construir fábricas','Manage lines and build factories')} →</button><PortalButton view="workshop2d">{label(es,'Crear un modelo','Create a model')}</PortalButton></div>
  </section>;
}

export function Campaigns2D(){
  const {g,p}=useGame(),{lang}=useT(),es=lang==='es';
  const [budget,setBudget]=useState(Math.max(0,p.marketingBudget));
  const [dealers,setDealers]=useState(1);
  const act=useStore(s=>s.act),save=useStore(s=>s.save);
  const commit=()=>{if(act(gg=>{setMarketing(gg,budget);return null;},label(es,'Presupuesto publicitario actualizado.','Marketing budget updated.')))void save('autosave');};
  return <section className="ae2d">
    <Headline kicker={label(es,'DEPARTAMENTO DE MARKETING','MARKETING DEPARTMENT')} title={label(es,'Hacé famosa tu marca','Make your brand famous')} sub={label(es,'La publicidad afecta el reconocimiento de marca. Los concesionarios amplían el alcance comercial real.','Marketing affects brand awareness. Dealership investment expands actual commercial reach.')}/>
    <div className="ae2d-campaign-layout">
      <article className="ae2d-campaign-card"><span className="ae2d-kicker">{label(es,'CAMPAÑA DE MARCA','BRAND CAMPAIGN')}</span><div className="ae2d-billboard"><b>{p.name.toUpperCase()}</b><span>{label(es,'EL FUTURO LO CONSTRUÍS VOS','ENGINEER TOMORROW')}</span></div><h3>{label(es,'Presupuesto mensual','Monthly marketing budget')}</h3>
        <div className="ae2d-campaign-budget">{money(budget,lang)}</div>
        <input aria-label={label(es,'Presupuesto publicitario','Marketing budget')} type="range" min="0" max={Math.max(1000000,Math.min(10000000,Math.ceil(Math.max(p.marketingBudget,p.cash*.10)/100000)*100000))} step="100000" value={budget} onChange={e=>setBudget(Number(e.target.value))}/>
        <button className="ae2d-cta" onClick={commit}>{label(es,'Confirmar campaña','Confirm campaign')}</button></article>
      <article className="ae2d-campaign-card"><span className="ae2d-kicker">{label(es,'RED DE VENTAS','DEALER NETWORK')}</span><div className="ae2d-dealer-graphic" aria-hidden="true">◈ — ◇ — ◈ — ◇</div><h3>{label(es,'Abrí nuevos puntos de venta','Open new dealerships')}</h3><p>{label(es,'Una inversión real: aumenta el alcance de ventas y sale de la caja de tu empresa.','This spends company cash to increase actual selling capacity.')}</p>
        <label>{label(es,'Inversión (millones USD)','Investment (USD millions)')}<input type="number" min="1" max="100" value={dealers} onChange={e=>setDealers(Number(e.target.value))}/></label>
        <button className="ae2d-cta" disabled={!Number.isFinite(dealers)||dealers<=0} onClick={()=>{if(act(gg=>investDealers(gg,p.homeRegion,dealers*1e6)))void save('autosave');}}>{label(es,'Invertir en concesionarios','Invest in dealers')}</button></article>
    </div>
  </section>;
}

export function League2D(){
  const {g,p}=useGame(),{lang}=useT(),es=lang==='es';
  const [period,setPeriod]=useState<'monthly'|'annual'>('annual');
  const measure=(company:typeof p)=>period==='annual'?annualUnits(company):(company.ledger[company.ledger.length-1]?.units??0);
  const rank=g.companies.filter(c=>c.alive).map(c=>({id:c.id,name:c.name,color:c.color,annual:measure(c),me:c.id===p.id})).sort((a,b)=>b.annual-a.annual);
  const myRank=rank.findIndex(x=>x.me)+1;
  return <section className="ae2d">
    <Headline kicker={label(es,'LA LIGA DE FABRICANTES','MANUFACTURER LEAGUE')} title={label(es,'¿Quién domina las calles?','Who rules the roads?')} sub={label(es,'Clasificación de rivales de esta partida: volumen anual estimado por la simulación. No son jugadores online.','Rankings from this save: simulated annual sales. These are not real online players.')}/>
    <div className="ae2d-period" role="group" aria-label={label(es,'Período del ranking','Ranking period')}><button className={period==='monthly'?'on':''} onClick={()=>setPeriod('monthly')}>{label(es,'Último mes','Last month')}</button><button className={period==='annual'?'on':''} onClick={()=>setPeriod('annual')}>{label(es,'Últimos 12 meses','Last 12 months')}</button></div>
    <div className="ae2d-league-top"><div><span>{label(es,'TU POSICIÓN','YOUR RANK')}</span><strong>#{myRank}</strong></div><div><span>{period==='annual'?label(es,'TUS VENTAS ANUALES','YOUR ANNUAL SALES'):label(es,'VENTAS ÚLTIMO MES','LAST MONTH SALES')}</span><strong>{num(measure(p),lang)}</strong></div><div><span>{label(es,'RIVALES ACTIVOS','ACTIVE RIVALS')}</span><strong>{rank.length-1}</strong></div></div>
    <div className="ae2d-leaderboard" role="table" aria-label={label(es,'Clasificación de marcas','Brand rankings')}>
      {rank.slice(0,20).map((c,i)=><div className={'ae2d-league-row'+(c.me?' me':'')} role="row" key={c.id}><span className="ae2d-league-position">#{i+1}</span><i className="ae2d-league-brand" style={{background:c.color}}/><b>{c.name}</b><span className="ae2d-league-sales">{num(c.annual,lang)} {period==='annual'?label(es,'autos/año','cars/year'):label(es,'autos/mes','cars/month')}</span>{c.me&&<Pill>{label(es,'VOS','YOU')}</Pill>}</div>)}
    </div>
    <p className="ae2d-soft">{label(es,'Las ligas semanales online y sus premios necesitarán perfiles, guardados verificados y un servidor para impedir trampas.','Online weekly leagues and prizes need profiles, verified saves and an anti-cheat backend.')}</p>
  </section>;
}
