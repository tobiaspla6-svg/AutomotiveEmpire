// Factory (Flow reference 04-fabrica/A): four stations along the hall — chassis and mechanicals, body shop, paint
// booth, final assembly. The picture is the Flow original with its English station signs, bars and floor labels
// inpainted; station signs, live load meters and the production queue are React and come from the plant's real
// stages (sim/supply). Sparks and paint mist move only while the plant is producing and never in reduced motion.
import type { Company, Factory, GameState, VehicleModel } from '../../sim/types';
import type { Sector, SectorLoad } from '../art2d/FactoryLine2D';
import { useT } from '../../i18n';
import { num, money } from '../../i18n/format';
import { useStore } from '../../store/game';
import { addLine } from '../../sim/actions';
import { lineShareUsed, toolingCost } from '../../sim/company';
import { useState } from 'react';
import { Car2D } from '../art2d/Car2D';
import { Scene, at } from './Scene';
import { useL } from './FlowHQ';

/** Station sign position (native px of the cleaned 1376×578 background) and the simulation stage behind it. */
const STATIONS: { sector: Sector; n: string; es: string; en: string; sign: [number, number]; floor: number }[] = [
  { sector: 'powertrain', n: '01', es: 'Bastidor y mecánica', en: 'Chassis & mechanicals', sign: [92, 206], floor: 188 },
  { sector: 'body', n: '02', es: 'Carrocería', en: 'Body shop', sign: [414, 206], floor: 523 },
  { sector: 'paint', n: '03', es: 'Pintura', en: 'Paint booth', sign: [752, 206], floor: 857 },
  { sector: 'assembly', n: '04', es: 'Montaje final', en: 'Final assembly', sign: [1052, 206], floor: 1195 },
];
const SPARKS: [number, number][] = [[500, 334], [512, 392], [148, 330]];
const MIST: [number, number][] = [[795, 352], [905, 350]];

export function FlowFactoryScene({ load, active, onPick, producing }: { load: Record<Sector, SectorLoad>; active: Sector; onPick: (s: Sector) => void; producing: boolean }) {
  const l = useL();
  return <Scene bg="fabrica" className="fs-factory" label={l('Línea de montaje', 'Assembly line')}>
    {producing && SPARKS.map(([x, y], i) => <span key={'s' + i} className="fs-spark" style={{ ...at('fabrica', x, y), animationDelay: `${i * 0.27}s` }} />)}
    {producing && MIST.map(([x, y], i) => <span key={'m' + i} className="fs-mist" style={{ ...at('fabrica', x, y), animationDelay: `${i * 0.5}s` }} />)}
    {STATIONS.map((s) => {
      const L = load[s.sector], pct = Math.round(Math.min(1.2, L.use) * 100);
      return <button type="button" key={s.sector} className={'fs-station' + (L.bottleneck ? ' bn' : '')} aria-pressed={active === s.sector} data-station={s.sector}
        style={at('fabrica', s.sign[0], s.sign[1])} onClick={() => onPick(s.sector)}
        aria-label={`${s.n} ${l(s.es, s.en)}: ${pct}%${L.bottleneck ? l(', cuello de botella', ', bottleneck') : ''}`}>
        <b><em>{s.n} //</em> {l(s.es, s.en)}</b>
        <span className="fs-meter" aria-hidden="true"><em style={{ width: `${Math.min(100, pct)}%` }} /></span>
        <small>{pct}% {l('de su capacidad', 'of capacity')}{L.bottleneck ? ' · ▲ ' + l('cuello de botella', 'bottleneck') : ''}</small>
      </button>;
    })}
  </Scene>;
}

/** Production queue of a plant: the models on its lines, plus finished models that can be started there (addLine). */
export function FlowQueue({ p, f }: { g?: GameState; p: Company; f: Factory }) {
  const { lang } = useT(); const l = useL();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask), save = useStore((s) => s.save);
  const onLine = new Set(f.lines.map((x) => x.modelId));
  const models = p.models.filter((m) => onLine.has(m.id) || m.status === 'ready' || m.status === 'production');
  const [sel, setSel] = useState<string | null>(models.find((m) => !onLine.has(m.id))?.id ?? models[0]?.id ?? null);
  const m = models.find((x) => x.id === sel);
  const free = Math.max(0, Math.floor(f.capacity * (1 - lineShareUsed(f))));
  const units = Math.max(0, Math.min(free, Math.round(f.capacity * 0.25)));
  const reason = !m ? l('Elegí un modelo terminado.', 'Choose a finished model.')
    : onLine.has(m.id) ? l('Este modelo ya se fabrica en esta planta.', 'This model is already built in this plant.')
    : f.capacity <= 0 ? l('La planta todavía está en obra.', 'The plant is still being built.')
    : units <= 0 ? l('No queda capacidad libre en esta planta.', 'No free capacity left in this plant.') : null;
  const cost = m && !reason ? toolingCost(m, units, { c: p, f }) : 0;
  const start = () => m && ask(l(`Abrir una línea de ${num(units, lang)} autos/mes para ${m.name}. Herramental: ${money(cost, lang)}.`, `Open a ${num(units, lang)} cars/month line for ${m.name}. Tooling: ${money(cost, lang)}.`),
    () => { if (act((gg) => addLine(gg, f.id, m.id, units), l('Línea abierta.', 'Line opened.'))) void save('autosave'); });
  return <div className="fs-queue">
    <div style={{ flex: '1 1 600px', minWidth: 0 }}>
      <span className="fs-kicker">{l('Cola de producción', 'Production queue')}</span>
      {models.length === 0 ? <p className="fs-soft">{l('Ningún modelo terminado todavía: aprobá un diseño en Ingeniería.', 'No finished model yet: approve a design in Engineering.')}</p>
        : <div className="fs-queue-list" role="group" aria-label={l('Modelos', 'Models')}>{models.map((x) => <QueueItem key={x.id} m={x} on={sel === x.id} line={onLine.has(x.id) ? f.capacity * (f.lines.find((q) => q.modelId === x.id)?.share ?? 0) : null} onClick={() => setSel(x.id)} />)}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', maxWidth: 320 }}>
      <button type="button" className="fm-btn primary" data-action="start-line" disabled={!!reason} onClick={start} aria-describedby="fs-start-why">{l('Iniciar', 'Start')}</button>
      <small id="fs-start-why" className="fs-soft">{reason ?? l(`${num(units, lang)} autos/mes · herramental ${money(cost, lang)}`, `${num(units, lang)} cars/mo · tooling ${money(cost, lang)}`)}</small>
    </div>
  </div>;
}
function QueueItem({ m, on, line, onClick }: { m: VehicleModel; on: boolean; line: number | null; onClick: () => void }) {
  const { lang } = useT(); const l = useL();
  return <button type="button" className="fs-thumb" aria-pressed={on} onClick={onClick} data-model={m.id}>
    <Car2D body={m.spec.body} year={m.designYear} color={m.spec.color} />
    <b>{m.name}</b><small>{line !== null ? l(`En línea · ${num(line, lang)}/mes`, `On line · ${num(line, lang)}/mo`) : l('Listo para producir', 'Ready to build')}</small>
  </button>;
}
