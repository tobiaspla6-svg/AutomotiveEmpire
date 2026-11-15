// Design workshop (Flow reference 03-taller/A): a large car in the centre of the workshop hall, categories on the left,
// an inspector on the right and the compatible parts in a tray below. The configuration is structured data
// (sim/vehicleConfig) saved per vehicle; the preview is the GT-01 built from layers derived from the Flow original.
// A part without an approved layer can be recorded in the configuration but the stage says plainly that it is not
// drawn; structural options that need another body family are disabled with the reason. Mechanical choices go to the
// engineering workshop, where the simulator's rules apply.
import { useEffect, useMemo, useState } from 'react';
import { useGame, useStore } from '../../store/game';
import { useT } from '../../i18n';
import { money } from '../../i18n/format';
import type { VehicleModel } from '../../sim/types';
import {
  BODY_FAMILIES, INTERIOR, ORIGINAL_PAINT, PAINTS, PART_CATEGORIES, configOf, isElectrified, familyFor, incompatibility, partById, partsFor, saveVehicleConfig,
  type InteriorConfig, type PartCategory, type PartOption, type VehicleConfig,
} from '../../sim/vehicleConfig';
import { Icon, type IconName } from '../ds/icons';
import { Car2D } from '../art2d/Car2D';
import { sfx } from '../game2d/sfx';
import { GT01Car, GT01Crop, Scene } from './Scene';
import { ModularCar, ModularCrop } from './ModularCar';
import { ART_FAMILIES } from '../../data/artFamilies';
import { FlowBar, FlowNav, useL } from './FlowHQ';
import { useStudio } from './studioStore';

const CAT: Record<PartCategory, { es: string; en: string; icon: IconName }> = {
  body: { es: 'Carrocería y kits', en: 'Body & kits', icon: 'vehicle' }, bumpers: { es: 'Paragolpes y parrillas', en: 'Bumpers & grilles', icon: 'layers' },
  lights: { es: 'Faros', en: 'Lights', icon: 'bolt' }, handles: { es: 'Manijas', en: 'Handles', icon: 'sliders' }, mirrors: { es: 'Espejos', en: 'Mirrors', icon: 'eye' },
  wheels: { es: 'Ruedas y neumáticos', en: 'Wheels & tyres', icon: 'wheel' }, suspension: { es: 'Suspensión y altura', en: 'Suspension & height', icon: 'gauge' },
  paint: { es: 'Pintura y materiales', en: 'Paint & materials', icon: 'target' }, roof: { es: 'Techo', en: 'Roof', icon: 'up' },
  interior: { es: 'Interior', en: 'Interior', icon: 'users' }, powertrain: { es: 'Motor y transmisión', en: 'Engine & gearbox', icon: 'research' }, aero: { es: 'Aerodinámica', en: 'Aerodynamics', icon: 'route' },
};
const FINISH = { metallic: ['Metalizada', 'Metallic'], solid: ['Sólida', 'Solid'], pearl: ['Perlada', 'Pearl'], matte: ['Mate', 'Matte'] } as const;
const INT_LABEL: Record<string, [string, string]> = {
  comfort: ['Confort', 'Comfort'], sport: ['Deportivos', 'Sport'], bucket: ['Baquets', 'Buckets'], round: ['Redondo', 'Round'], 'flat-bottom': ['Base plana', 'Flat-bottom'], yoke: ['Yugo', 'Yoke'],
  analogue: ['Analógico', 'Analogue'], digital: ['Digital', 'Digital'], 'wide-screen': ['Pantalla ancha', 'Wide screen'], standard: ['Estándar', 'Standard'], floating: ['Flotante', 'Floating'],
  cloth: ['Tela', 'Cloth'], leather: ['Cuero', 'Leather'], alcantara: ['Alcántara', 'Alcantara'], vegan: ['Sintético', 'Synthetic'], plastic: ['Plástico', 'Plastic'], aluminium: ['Aluminio', 'Aluminium'], wood: ['Madera', 'Wood'], carbon: ['Carbono', 'Carbon'],
};

interface History { past: VehicleConfig[]; now: VehicleConfig; future: VehicleConfig[] }

export function FlowStudio() {
  const { g, p } = useGame(); const { lang } = useT(); const l = useL();
  const act = useStore((s) => s.act), save = useStore((s) => s.save), ask = useStore((s) => s.ask), setView = useStore((s) => s.setView);
  const target = useStudio((s) => s.target), open = useStudio((s) => s.open);
  const model: VehicleModel | undefined = p.models.find((m) => m.id === target);
  const key = model ? model.id : 'draft';
  const savedCfg = configOf(p, key, model);   // read every render: saving mutates the game in place
  const [h, setH] = useState<History>({ past: [], now: savedCfg, future: [] });
  useEffect(() => { setH({ past: [], now: savedCfg, future: [] }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cat, setCat] = useState<PartCategory>('wheels');
  const cfg = h.now;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(savedCfg);
  const set = (next: VehicleConfig) => { sfx.click(); setH({ past: [...h.past.slice(-49), cfg], now: next, future: [] }); };
  const undo = () => h.past.length && setH({ past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [cfg, ...h.future] });
  const redo = () => h.future.length && setH({ past: [...h.past, cfg], now: h.future[0], future: h.future.slice(1) });
  const reset = () => ask(l('¿Restablecer la configuración guardada? Se pierden los cambios sin guardar.', 'Reset to the saved configuration? Unsaved changes are lost.'), () => setH({ past: [...h.past, cfg], now: savedCfg, future: [] }));
  const doSave = () => { if (act((gg) => saveVehicleConfig(gg, key, cfg), l('Configuración guardada.', 'Configuration saved.'))) { sfx.claim(); void save('autosave'); } };

  // the vehicle drawn: GT-01 family when it represents this body and era; otherwise the period side view, labelled
  const body = model?.spec.body ?? 'sedan', year = model?.designYear ?? g.year;
  const family = familyFor(body, year);
  const electric = isElectrified(model);
  const stats = useMemo(() => model?.stats ?? null, [model]);
  const unseen = Object.entries(cfg.parts).map(([, id]) => partById(id)).filter((x): x is PartOption => !!x && x.asset === 'missing');
  const choose = (o: PartOption) => set({ ...cfg, parts: { ...cfg.parts, [o.slot]: o.id } });
  const setInt = <K extends keyof InteriorConfig>(k: K, v: InteriorConfig[K]) => set({ ...cfg, interior: { ...cfg.interior, [k]: v } });
  const famName = BODY_FAMILIES.find((f) => f.id === cfg.bodyFamilyId);

  // a family drawn from data (Phase 6: the 1990 SUV) or the GT-01 layers; options are those drawn for the family
  const art = family ? ART_FAMILIES[family.id] : undefined;
  const tray = (cat === 'paint' || cat === 'interior' || cat === 'powertrain') ? null : partsFor(cfg.bodyFamilyId, cat);
  const orig = ORIGINAL_PAINT[cfg.bodyFamilyId];
  const paints = orig ? [orig, ...PAINTS.filter((c) => c !== orig)] : PAINTS;
  const crop = (rect: [number, number, number, number], parts: Record<string, string>) => art
    ? <ModularCrop family={art} rect={rect} paint={cfg.paint} finish={cfg.finish} parts={parts} />
    : <GT01Crop rect={rect} paint={cfg.paint} finish={cfg.finish} parts={parts} />;
  return <section className="fs-screen fs-studio-screen">
    <FlowBar title={l('Taller de diseño', 'Design workshop')}>
      <span className="fs-toolbar">
        <label className="fs-soft">{l('Vehículo', 'Vehicle')}{' '}
          <select value={key} onChange={(e) => { if (dirty && !window.confirm(l('Hay cambios sin guardar. ¿Descartarlos?', 'There are unsaved changes. Discard them?'))) return; open(e.target.value); }} data-field="studio-target">
            <option value="draft">{l('Próximo diseño (borrador)', 'Next design (draft)')}</option>
            {p.models.filter((m) => m.status !== 'retired').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <button type="button" className="fm-btn small secondary" onClick={undo} disabled={!h.past.length} aria-label={l('Deshacer', 'Undo')}>↶ {l('Deshacer', 'Undo')}</button>
        <button type="button" className="fm-btn small secondary" onClick={redo} disabled={!h.future.length} aria-label={l('Rehacer', 'Redo')}>↷ {l('Rehacer', 'Redo')}</button>
        <button type="button" className="fm-btn small secondary" onClick={reset} disabled={!dirty}>{l('Restablecer', 'Reset')}</button>
        {dirty && <span className="fs-dirty" role="status">● {l('Cambios sin guardar', 'Unsaved changes')}</span>}
        <button type="button" className="fm-btn small primary" data-action="studio-save" onClick={doSave} disabled={!dirty}><Icon name="save" size={18} />{l('Guardar', 'Save')}</button>
      </span>
    </FlowBar>

    <div className="fs-studio">
      <nav className="fs-cats" aria-label={l('Categorías', 'Categories')}>
        {PART_CATEGORIES.map((c) => <button type="button" key={c} className="fs-cat" aria-pressed={cat === c} data-cat={c} onClick={() => setCat(c)}><Icon name={CAT[c].icon} size={24} />{l(CAT[c].es, CAT[c].en)}</button>)}
      </nav>

      <div className="fs-stage">
        {cat === 'interior' ? <InteriorView cfg={cfg} setInt={setInt} l={l} /> : <Scene bg="taller" label={l('Vista previa del vehículo', 'Vehicle preview')}>
          {art ? <ModularCar family={art} className="fs-car" paint={cfg.paint} parts={cfg.parts} finish={cfg.finish} label={model?.name ?? l(art.name.es, art.name.en)} />
            : family
            ? <GT01Car className="fs-car" paint={cfg.paint} ride={cfg.parts.rideHeight} parts={cfg.parts} finish={cfg.finish} label={model?.name ?? 'GT-01'} />
            : model && <div className="fs-car vector"><Car2D body={model.spec.body} year={model.designYear} color={cfg.paint} illustrated /></div>}
          {!family && <p className="fs-note">{l(`Representación vectorial provisional: no hay asset aprobado para «${body}» en ${year}. Tienen capas el GT-01 fastback (2005+) y el SUV 1990 (1984–2004).`, `Provisional vector drawing: no approved asset for "${body}" in ${year}. Layers exist for the GT-01 fastback (2005+) and the 1990 SUV (1984–2004).`)}</p>}
          {family && unseen.length > 0 && <p className="fs-note" data-pending>{l('Elegido pero sin dibujar (falta asset): ', 'Chosen but not drawn (asset missing): ')}{unseen.map((u) => l(u.es, u.en)).join(', ')}</p>}
        </Scene>}
      </div>

      <aside className="fs-inspector">
        <div className="fs-panel">
          <h3>{l('Pintura', 'Paint')}</h3>
          <div className="fs-swatches" role="group" aria-label={l('Color de pintura', 'Paint colour')}>
            {paints.map((c) => <button type="button" key={c} className="fs-swatch" style={{ background: c }} aria-pressed={cfg.paint === c} aria-label={c === orig ? l(`${c} (original)`, `${c} (original)`) : c} data-original={c === orig ? '1' : undefined} onClick={() => set({ ...cfg, paint: c })} />)}
          </div>
          <div className="fs-chiprow" style={{ marginTop: 12 }} role="group" aria-label={l('Acabado', 'Finish')}>
            {(Object.keys(FINISH) as (keyof typeof FINISH)[]).map((f) => <button type="button" key={f} className="fs-chip" aria-pressed={cfg.finish === f} onClick={() => set({ ...cfg, finish: f })}>{FINISH[f][lang === 'es' ? 0 : 1]}</button>)}
          </div>
          <p className="fs-soft" style={{ marginTop: 8 }}>{l('El acabado cambia los reflejos de la pintura sobre la carrocería y las piezas; vidrios, gomas y ópticas no se tiñen.', 'The finish changes the paint reflections on the body and parts; glass, rubber and lamps are not tinted.')}</p>
        </div>
        <div className="fs-panel">
          <h3>{model?.name ?? l('Próximo diseño', 'Next design')}</h3>
          <p className="fs-soft">{famName ? l(famName.es, famName.en) : ''} · {l('anclajes', 'anchors')} {cfg.anchorVersion}</p>
          {stats ? <dl className="fs-stats">
            <dt>{l('Potencia', 'Power')}</dt><dd>{Math.round(stats.engine.powerKw)} kW</dd>
            <dt>0–100 km/h</dt><dd>{stats.zeroTo100.toFixed(1)} s</dd>
            <dt>{l('Velocidad máx.', 'Top speed')}</dt><dd>{Math.round(stats.topSpeed)} km/h</dd>
            <dt>{l('Precio', 'Price')}</dt><dd>{model?.price ? money(model.price, lang) : '—'}</dd>
          </dl> : <p className="fs-soft">{l('La mecánica del próximo diseño se define en Ingeniería; allí se aplica esta configuración visual al aprobarlo.', "The next design's mechanics are set in Engineering; this visual configuration is applied when it is approved.")}</p>}
        </div>
      </aside>

      <div className="fs-tray" role="group" aria-label={l('Piezas compatibles', 'Compatible parts')}>
        {tray && tray.map((o) => {
          const why = incompatibility(cfg, o, { electric }, lang);
          const on = cfg.parts[o.slot] === o.id;
          return <button type="button" key={o.id} className="fs-opt" aria-pressed={on} disabled={!!why} data-part={o.id} onClick={() => choose(o)}>
            <div className={'fs-thumbbox' + (o.thumb ? '' : ' missing')}>{o.thumb ? crop(o.thumb, { ...cfg.parts, [o.slot]: o.id }) : o.slot === 'rideHeight' ? <span className="fs-soft">{l(o.es, o.en)}</span> : <span className="fs-pending">{l('Falta asset', 'Asset missing')}</span>}</div>
            <span className="fs-opt-text"><b>{l(o.es, o.en)}</b>
            <small>{why ?? (o.asset === 'layer' ? l('Variante verificada: cambia en la vista', 'Verified variant: changes the view') : o.asset === 'base' ? l('Dibujada en la carrocería base; sin alternativa todavía', 'Drawn in the base body; no alternative yet') : l('Se guarda; sin representación todavía', 'Saved; not drawn yet'))}</small></span>
          </button>;
        })}
        {tray && tray.length === 0 && <p className="fs-soft" data-empty-tray>{l(`${famName ? famName.es : 'Esta familia'}: sin variantes de esta categoría todavía. Se conserva la pieza del dibujo original.`, `${famName ? famName.en : 'This family'}: no variants in this category yet. The original drawing's part is kept.`)}</p>}
        {cat === 'paint' && <p className="fs-soft">{l('Elegí color y acabado en el panel de pintura. El repintado usa la máscara de carrocería: no tiñe cristales, neumáticos ni ópticas.', 'Choose colour and finish in the paint panel. The repaint uses the body mask: it does not tint glass, tyres or lamps.')}</p>}
        {cat === 'interior' && <p className="fs-soft">{l('Configuración del interior a la izquierda. No hay lienzo de interior aprobado: se guardan los datos y se muestran como muestras de material.', 'Interior configuration on the left. There is no approved interior canvas: the data is saved and shown as material samples.')}</p>}
        {cat === 'powertrain' && <div className="fs-toolbar">
          {model ? <span className="fs-soft">{model.spec.engine.layout} · {(model.spec.engine.displacement / 1000).toFixed(1)} L · {model.spec.gearbox} · {model.spec.drive}</span>
            : <span className="fs-soft">{l('Motor, transmisión, chasis y suspensión los calcula el simulador.', 'Engine, gearbox, chassis and suspension are computed by the simulator.')}</span>}
          <button type="button" className="fm-btn small primary" onClick={() => { if (dirty) doSave(); setView(model ? 'vehicles' : 'workshop2d'); }}>{model ? l('Abrir ficha del modelo', 'Open model sheet') : l('Abrir Ingeniería', 'Open Engineering')}</button>
        </div>}
        {cat === 'suspension' && <p className="fs-soft" style={{ alignSelf: 'center' }}>{l('La altura mueve la carrocería respecto de las ruedas (capas). El tipo de suspensión es mecánico: se elige en Ingeniería.', 'Height moves the body against the wheels (layers). The suspension type is mechanical: chosen in Engineering.')}</p>}
      </div>
    </div>
    <FlowNav current="studio2d" />
  </section>;
}

function InteriorView({ cfg, setInt, l }: { cfg: VehicleConfig; setInt: <K extends keyof InteriorConfig>(k: K, v: InteriorConfig[K]) => void; l: (es: string, en: string) => string }) {
  const { lang } = useT();
  const lab = (v: string) => INT_LABEL[v]?.[lang === 'es' ? 0 : 1] ?? v;
  const group = <K extends keyof InteriorConfig>(k: K, title: string, values: readonly InteriorConfig[K][]) =>
    <fieldset><legend>{title}</legend><div className="fs-chiprow">{values.map((v) => <button type="button" key={String(v)} className="fs-chip" aria-pressed={cfg.interior[k] === v} onClick={() => setInt(k, v)}>{lab(String(v))}</button>)}</div></fieldset>;
  return <div className="fs-interior" data-view="interior">
    <p className="fs-soft" style={{ gridColumn: '1 / -1', margin: 0 }}><span className="fs-pending">{l('Representación pendiente', 'Drawing pending')}</span> {l('Vista independiente del interior: todavía no hay lienzo ni anclajes de interior aprobados, así que se muestran las elecciones y sus materiales.', 'Separate interior view: there is no approved interior canvas or anchors yet, so the choices and their materials are shown.')}</p>
    {group('seats', l('Asientos', 'Seats'), INTERIOR.seats)}
    {group('steering', l('Volante', 'Steering wheel'), INTERIOR.steering)}
    {group('dashboard', l('Tablero', 'Dashboard'), INTERIOR.dashboard)}
    {group('console', l('Consola', 'Console'), INTERIOR.console)}
    {group('upholstery', l('Tapizado', 'Upholstery'), INTERIOR.upholstery)}
    {group('trim', l('Molduras', 'Trim'), INTERIOR.trim)}
    <fieldset><legend>{l('Color', 'Colour')}</legend><div className="fs-swatches">{INTERIOR.colour.map((c) => <button type="button" key={c} className="fs-swatch" style={{ background: c }} aria-pressed={cfg.interior.colour === c} aria-label={c} onClick={() => setInt('colour', c)} />)}</div></fieldset>
  </div>;
}
