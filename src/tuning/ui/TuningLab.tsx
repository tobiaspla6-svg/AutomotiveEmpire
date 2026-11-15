// Tuning Empire — experimental lab screen (Phase 6). A fictional car, its stats, compatible parts and stages, the ECU
// calibration, dyno curves (stock vs built) and a quarter-mile run. Everything comes from src/tuning; nothing here
// touches Automotive Empire's game, economy or saves.
import { useMemo, useState } from 'react';
import { CATEGORIES, PARTS, STAGES, VEHICLES, applyStage, calibrationProblems, dynoCurve, fitParts, knockLimitDeg, partFitProblem, simulateDrag, stockCalibration, topSpeedKmh, type Calibration, type DragResult, type PartCategory } from '../index';
import { LineChart } from './Chart';

const C_STOCK = '#3987e5', C_BUILD = '#d95926';   // categorical slots 1–2 (validated on #141c25)
const CAT_ES: Record<PartCategory, string> = { ecu: 'ECU', intake: 'Admisión', exhaust: 'Escape', turbo: 'Turbo', intercooler: 'Intercooler', injectors: 'Inyectores', clutch: 'Embrague', gearbox: 'Caja', differential: 'Diferencial', tyres: 'Neumáticos', weight: 'Reducción de peso' };
const s2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const k0 = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : '—');

export function TuningLab() {
  const [vid, setVid] = useState('kestrel');
  const base = VEHICLES[vid];
  const [chosen, setChosen] = useState<Partial<Record<PartCategory, string>>>({});
  const [cal, setCal] = useState<Calibration>(() => stockCalibration(base));
  const [runs, setRuns] = useState<{ stock: DragResult; build: DragResult } | null>(null);

  const ids = Object.values(chosen).filter((x): x is string => !!x);
  const { hw, errors: fitErrors } = useMemo(() => fitParts(base, ids, PARTS), [base, ids.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const stockHw = useMemo(() => fitParts(base, [], PARTS).hw, [base]);
  const stockCal = useMemo(() => stockCalibration(base), [base]);
  const calErrors = calibrationProblems(hw, cal);
  const ok = fitErrors.length === 0 && calErrors.length === 0;
  const dynoS = useMemo(() => dynoCurve(stockHw, stockCal, 100), [stockHw, stockCal]);
  const dynoB = useMemo(() => (ok ? dynoCurve(hw, cal, 100) : null), [hw, cal, ok]);

  const pickVehicle = (id: string) => { setVid(id); setChosen({}); setCal(stockCalibration(VEHICLES[id])); setRuns(null); };
  const loadStage = (id: string) => {
    const st = STAGES.find((s) => s.id === id)!;
    const r = applyStage(base, st, PARTS);
    if (!r.build) return;
    const next: Partial<Record<PartCategory, string>> = { ...chosen };
    for (const pid of st.parts) next[PARTS[pid].category] = pid;
    setChosen(next); setCal(r.build.calibration); setRuns(null);
  };
  const reset = () => { setChosen({}); setCal(stockCalibration(base)); setRuns(null); };
  const race = () => { if (ok) setRuns({ stock: simulateDrag(stockHw, stockCal), build: simulateDrag(hw, cal) }); };
  const setC = (k: keyof Calibration, v: number) => { setCal({ ...cal, [k]: v, ...(k === 'revLimit' ? { shiftRpm: v } : {}) }); setRuns(null); };
  const d = base.drivetrain, v = hw.vehicle;

  return <div className="tl">
    <header className="tl-head">
      <div><span className="tl-kicker">Tuning Empire · prototipo técnico</span><h1>Laboratorio de preparación</h1></div>
      <p className="tl-warn" role="note">Experimental. Autos y piezas ficticios; física simplificada y documentada (docs/phase6/TUNING.md). Sin economía, historia ni guardado.</p>
    </header>

    <section className="tl-cars" aria-label="Vehículo">
      {Object.values(VEHICLES).map((x) => <button key={x.id} type="button" className="tl-car" aria-pressed={x.id === vid} data-vehicle={x.id} onClick={() => pickVehicle(x.id)}>
        <b>{x.name}</b><small>{x.year} · {x.engine.name} · {x.drivetrain.drive}</small>
      </button>)}
    </section>

    <div className="tl-grid">
      <section className="tl-panel" aria-label="Estadísticas">
        <h2>{base.name}</h2>
        <dl className="tl-stats">
          <dt>Motor</dt><dd>{base.engine.code} · {base.engine.displacementL.toFixed(1)} L {base.engine.aspiration === 'turbo' ? 'turbo' : 'atmosférico'}</dd>
          <dt>Masa</dt><dd>{v.massKg} kg{v.massKg !== base.massKg ? ` (de serie ${base.massKg})` : ''}</dd>
          <dt>Tracción</dt><dd>{d.drive} · diferencial {v.drivetrain.diffTraction >= 0.95 ? 'autoblocante' : 'abierto'}</dd>
          <dt>Caja</dt><dd>{v.drivetrain.gears.map((g) => g.toFixed(2)).join(' / ')} · final {v.drivetrain.finalDrive.toFixed(2)}</dd>
          <dt>Neumático</dt><dd>{v.tyre.name} · μ {v.tyre.mu.toFixed(2)}</dd>
          <dt>Embrague</dt><dd>{v.drivetrain.clutchCapNm} Nm</dd>
          <dt>Potencia</dt><dd data-stat="peak-kw">{k0(dynoB?.peakKw ?? NaN)} kW a {dynoB?.peakKwRpm ?? '—'} rpm <small>(serie {k0(dynoS.peakKw)})</small></dd>
          <dt>Torque</dt><dd>{k0(dynoB?.peakNm ?? NaN)} Nm <small>(serie {k0(dynoS.peakNm)})</small></dd>
          <dt>Vel. máx.</dt><dd>{ok ? k0(topSpeedKmh(hw, cal)) : '—'} km/h</dd>
        </dl>
        {dynoB?.fuelLimited && <p className="tl-note" data-limit="fuel">⚠ Límite de inyectores: la potencia queda recortada por el caudal de combustible.</p>}
        {dynoB && dynoB.peakNm > v.drivetrain.clutchCapNm && <p className="tl-note" data-limit="clutch">⚠ El embrague ({v.drivetrain.clutchCapNm} Nm) no aguanta el torque ({k0(dynoB.peakNm)} Nm): va a patinar.</p>}
      </section>

      <section className="tl-panel" aria-label="Modificaciones">
        <h2>Stages</h2>
        <div className="tl-stages">
          {STAGES.map((st) => { const why = applyStage(base, st, PARTS).errors[0]; return <button key={st.id} type="button" className="tl-btn" disabled={!!why} title={why} data-stage={st.id} onClick={() => loadStage(st.id)}>{st.name}{why && <small>{why}</small>}</button>; })}
          <button type="button" className="tl-btn ghost" onClick={reset} data-action="reset">Restaurar de serie</button>
        </div>
        <h2>Piezas</h2>
        <div className="tl-parts">
          {CATEGORIES.map((cat) => {
            const list = Object.values(PARTS).filter((p) => p.category === cat);
            return <label key={cat} className="tl-part"><span>{CAT_ES[cat]}</span>
              <select value={chosen[cat] ?? ''} data-cat={cat} onChange={(e) => { setChosen({ ...chosen, [cat]: e.target.value || undefined }); setRuns(null); }}>
                <option value="">De serie</option>
                {list.map((p) => { const why = partFitProblem(p, base); return <option key={p.id} value={p.id} disabled={!!why}>{p.name}{why ? ' — no compatible' : ''}</option>; })}
              </select>
            </label>;
          })}
        </div>
      </section>

      <section className="tl-panel" aria-label="Calibración de la ECU">
        <h2>Calibración</h2>
        {!hw.remappable && <p className="tl-soft">ECU de serie: el mapa no se puede modificar. Instalá una reprogramación de ECU.</p>}
        <div className="tl-cal">
          {base.engine.aspiration === 'turbo' && <label>Presión de turbo <b>{cal.boostBar.toFixed(2)} bar</b>
            <input type="range" min={0.5} max={2.2} step={0.05} value={cal.boostBar} disabled={!hw.remappable} onChange={(e) => setC('boostBar', +e.target.value)} data-field="boost" /></label>}
          <label>Corte de vueltas <b>{cal.revLimit} rpm</b>
            <input type="range" min={6000} max={base.engine.mechanicalLimitRpm + 400} step={100} value={cal.revLimit} disabled={!hw.remappable} onChange={(e) => setC('revLimit', +e.target.value)} data-field="rev" /></label>
          <label>Avance de encendido <b>{cal.timingDeg >= 0 ? '+' : ''}{cal.timingDeg}°</b> <small>(límite de detonación +{knockLimitDeg(hw, cal.boostBar).toFixed(1)}°)</small>
            <input type="range" min={-2} max={6} step={1} value={cal.timingDeg} disabled={!hw.remappable} onChange={(e) => setC('timingDeg', +e.target.value)} data-field="timing" /></label>
          <label>Régimen de largada <b>{cal.launchRpm} rpm</b>
            <input type="range" min={2000} max={6500} step={100} value={cal.launchRpm} onChange={(e) => setC('launchRpm', +e.target.value)} data-field="launch" /></label>
        </div>
        {[...fitErrors, ...calErrors].map((e) => <p key={e} className="tl-error" role="alert">✕ {e}</p>)}
      </section>
    </div>

    <div className="tl-charts">
      <LineChart id="power" title="Potencia (banco)" xLabel="Régimen" xUnit="rpm" yUnit="kW" xFmt={(x) => `${(x / 1000).toFixed(1)}k`}
        series={[{ name: 'De serie', color: C_STOCK, points: dynoS.points.map((p) => ({ x: p.rpm, y: p.kw })) }, ...(dynoB ? [{ name: 'Preparado', color: C_BUILD, points: dynoB.points.map((p) => ({ x: p.rpm, y: p.kw })) }] : [])]} />
      <LineChart id="torque" title="Torque (banco)" xLabel="Régimen" xUnit="rpm" yUnit="Nm" xFmt={(x) => `${(x / 1000).toFixed(1)}k`}
        series={[{ name: 'De serie', color: C_STOCK, points: dynoS.points.map((p) => ({ x: p.rpm, y: p.nm })) }, ...(dynoB ? [{ name: 'Preparado', color: C_BUILD, points: dynoB.points.map((p) => ({ x: p.rpm, y: p.nm })) }] : [])]} />
    </div>

    <section className="tl-panel tl-race" aria-label="Carrera">
      <div className="tl-race-head"><h2>Cuarto de milla</h2>
        <button type="button" className="tl-btn primary" disabled={!ok} onClick={race} data-action="race">Simular carrera</button>
        {!ok && <small className="tl-soft">Corregí los errores de piezas o calibración para correr.</small>}
      </div>
      {runs && <>
        <table className="tl-results" data-results>
          <thead><tr><th></th><th>60 ft</th><th>1/8 milla</th><th>Trampa 1/8</th><th>1/4 milla</th><th>Trampa 1/4</th><th>Patinamiento</th><th>Embrague patina</th></tr></thead>
          <tbody>
            {([['De serie', runs.stock, C_STOCK], ['Preparado', runs.build, C_BUILD]] as const).map(([n, r, c]) => <tr key={n} data-run={n === 'De serie' ? 'stock' : 'build'}>
              <th><i style={{ background: c }} />{n}</th><td>{s2(r.et60ft)} s</td><td>{s2(r.et8)} s</td><td>{k0(r.trap8Kmh)} km/h</td><td data-et4>{s2(r.et4)} s</td><td>{k0(r.trap4Kmh)} km/h</td><td>{r.wheelspinS.toFixed(1)} s</td><td>{r.clutchSlipS.toFixed(1)} s</td>
            </tr>)}
          </tbody>
        </table>
        <p className="tl-soft">Cambios de marcha (preparado): {runs.build.shifts.map((s) => `${s.toGear}ª a ${k0(s.kmh)} km/h`).join(' · ')}. Tiempos desde el primer movimiento (sin tiempo de reacción).</p>
        <LineChart id="speed" title="Velocidad en la carrera" xLabel="Tiempo" xUnit="s" yUnit="km/h" xFmt={(x) => x.toFixed(0)}
          series={[{ name: 'De serie', color: C_STOCK, points: runs.stock.trace.map((p) => ({ x: p.t, y: p.kmh })) }, { name: 'Preparado', color: C_BUILD, points: runs.build.trace.map((p) => ({ x: p.t, y: p.kmh })) }]} />
      </>}
    </section>
  </div>;
}
