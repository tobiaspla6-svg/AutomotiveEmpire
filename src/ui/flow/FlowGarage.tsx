// Garage (Flow reference 05-garaje/A): the selected vehicle large on the display floor, its sheet on the left and the
// collection below. Only vehicles the player has really built or finished developing are listed. The same vehicle
// uses the same drawing and configuration as in the design studio; Customise opens the studio on it.
import { create } from 'zustand';
import { useGame, useStore } from '../../store/game';
import { useT } from '../../i18n';
import { money, num } from '../../i18n/format';
import type { VehicleModel } from '../../sim/types';
import { configOf, familyFor } from '../../sim/vehicleConfig';
import { ModularCar } from './ModularCar';
import { ART_FAMILIES } from '../../data/artFamilies';
import { SEGMENTS } from '../../data/world';
import { Icon } from '../ds/icons';
import { Car2D } from '../art2d/Car2D';
import { sfx } from '../game2d/sfx';
import { GT01Car, Scene } from './Scene';
import { FlowNav, useL } from './FlowHQ';
import { useStudio } from './studioStore';

/** The garage remembers its selection when the player leaves and comes back. */
const useGarageSel = create<{ id: string | null; set: (id: string) => void }>((set) => ({ id: null, set: (id) => set({ id }) }));
export const garageModels = (models: VehicleModel[]) => models.filter((m) => m.status === 'production' || m.status === 'ready' || m.cumulativeUnits > 0);

/** One drawing per vehicle, everywhere: the GT-01 layers for its family, otherwise the vector side view (labelled). */
export function VehicleArt({ m, className }: { m: VehicleModel; className?: string }) {
  const { p } = useGame();
  const cfg = configOf(p, m.id, m);
  const fam = familyFor(m.spec.body, m.designYear), art = fam && ART_FAMILIES[fam.id];
  if (art) return <ModularCar family={art} className={className} paint={cfg.paint} parts={cfg.parts} finish={cfg.finish} label={m.name} />;
  return fam
    ? <GT01Car className={className} paint={cfg.paint} ride={cfg.parts.rideHeight} parts={cfg.parts} finish={cfg.finish} label={m.name} />
    : <div className={(className ?? '') + ' vector'} role="img" aria-label={m.name}><Car2D body={m.spec.body} year={m.designYear} color={cfg.paint} illustrated /></div>;
}

export function FlowGarage() {
  const { p } = useGame(); const { lang } = useT(); const l = useL();
  const setView = useStore((s) => s.setView), open = useStudio((s) => s.open);
  const sel = useGarageSel();
  const list = garageModels(p.models);
  // without a remembered choice, open on a vehicle that has approved art (if the collection has one)
  const m = list.find((x) => x.id === sel.id) ?? list.find((x) => familyFor(x.spec.body, x.designYear)) ?? list[0];
  const s = m?.stats;
  // explicit scales: top speed 100–350 km/h, 0–100 km/h from 20 s down to 2.5 s, handling = the simulator's 0–100 drivability score
  const bars = s ? [
    { k: l('Velocidad', 'Top speed'), v: (s.topSpeed - 100) / 250, txt: `${Math.round(s.topSpeed)} km/h`, scale: '100–350 km/h' },
    { k: l('Aceleración', 'Acceleration'), v: (20 - s.zeroTo100) / 17.5, txt: `0–100 ${s.zeroTo100.toFixed(1)} s`, scale: '20 → 2,5 s' },
    { k: l('Manejo', 'Handling'), v: s.scores.drivability / 100, txt: `${Math.round(s.scores.drivability)}/100`, scale: '0–100' },
  ] : [];
  const seg = m ? SEGMENTS.find((x) => x.id === m.segment)?.name ?? m.segment : '';
  const vector = m && !familyFor(m.spec.body, m.designYear);
  return <section className="fs-screen">
    <div className="fs-garage">
      <aside className="fs-gside">
        <button type="button" className="fm-btn small secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setView('hq2d')}>← {l('Volver', 'Back')}</button>
        <h2>{l('Garaje', 'Garage')}<small>{l('Colección', 'Collection')}</small></h2>
        {m && s ? <div className="fs-gcard" data-model={m.id}>
          <h3>{m.name}</h3>
          <div className="fs-tags"><span>{seg}</span><span>{m.designYear}</span><span>{m.status === 'production' ? l('En producción', 'In production') : m.status === 'ready' ? l('Listo', 'Ready') : l('Retirado', 'Retired')}</span><span data-art-family={familyFor(m.spec.body, m.designYear)?.id ?? 'vector'}>{(() => { const f = familyFor(m.spec.body, m.designYear); return f ? l(`Arte: ${f.es}`, `Art: ${f.en}`) : l('Arte vectorial provisional', 'Provisional vector art'); })()}</span></div>
          <div className="fs-bars">{bars.map((b) => <label key={b.k}><span>{b.k}<em>{b.txt}</em></span>
            <span className="fs-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, b.v)) * 100)} aria-label={`${b.k} ${b.txt}, ${l('escala', 'scale')} ${b.scale}`}><em style={{ width: `${Math.max(2, Math.min(1, b.v) * 100)}%` }} /></span></label>)}</div>
          <p className="fs-soft" style={{ margin: 0 }}>{num(m.cumulativeUnits, lang)} {l('fabricados', 'built')} · {m.price ? money(m.price, lang) : '—'}</p>
        </div> : <div className="fs-gcard"><h3>{l('Colección vacía', 'Empty collection')}</h3><p className="fs-soft">{l('Todavía no terminaste ningún vehículo. Diseñá uno y aprobalo en Ingeniería.', 'You have not finished a vehicle yet. Design one and approve it in Engineering.')}</p>
          <button type="button" className="fm-btn small primary" onClick={() => setView('workshop2d')}>{l('Ir a Ingeniería', 'Go to Engineering')}</button></div>}
        {m && <button type="button" className="fm-btn primary" data-action="customize" onClick={() => { sfx.click(); open(m.id); setView('studio2d'); }}><Icon name="wrench" size={22} />{l('Personalizar', 'Customise')}</button>}
      </aside>
      <div className="fs-gmain">
        <Scene bg="garaje" label={m ? m.name : l('Garaje', 'Garage')}>
          {m && <VehicleArt m={m} className="fs-gcar" />}
          {vector && <p className="fs-note">{l('Dibujo vectorial provisional: no hay asset aprobado para esta familia y época.', 'Provisional vector drawing: no approved asset for this family and era.')}</p>}
        </Scene>
        <div className="fs-gtray" role="group" aria-label={l('Vehículos propios', 'Your vehicles')}>
          {list.map((x) => <button type="button" key={x.id} className="fs-thumb" aria-pressed={x.id === m?.id} data-model={x.id} ref={x.id === m?.id ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) : undefined} onClick={() => { sfx.click(); sel.set(x.id); }}>
            <VehicleArt m={x} /><b>{x.name}</b><small>{x.designYear}</small>
          </button>)}
        </div>
      </div>
    </div>
    <FlowNav current="garage2d" />
  </section>;
}
