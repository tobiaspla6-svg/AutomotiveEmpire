import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/game';
import { importFromFile, loadSlot, localSaves, type SaveMeta } from '../store/saves';
import { CarViewer } from '../three/CarViewer';
import { RaceCar, RoadCar } from '../three/CarModel';
import { defaultVehicle } from '../sim/engineering';
import { fmtMoney, MONTHS } from '../sim/util';

const MODE_LABEL: Record<string, string> = { ceo: 'Historical CEO', founder: 'Company Founder', motorsport: 'Motorsport Director' };

export function MainMenu() {
  const go = useStore((s) => s.go), start = useStore((s) => s.start), notify = useStore((s) => s.notify);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => localSaves.list().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { void refresh(); }, []);
  const classic = useMemo(() => { const s = defaultVehicle(1966, 'coupe'); s.color = '#a3161b'; s.engine.layout = 'V12'; s.tireWidth = 205; s.wheelDia = 15; s.sport = 0.7; return s; }, []);
  const concept = useMemo(() => { const s = defaultVehicle(2024, 'hatch'); s.color = '#2f6fd6'; s.tireWidth = 225; s.wheelDia = 19; s.engine.layout = 'EV'; return s; }, []);
  const load = async (slot: string) => {
    try { start(await loadSlot(slot)); } catch (err) { notify((err as Error).message, true); }
  };
  return (
    <div className="menu">
      <div className="menu-inner">
        <header className="brand">
          <h1>Automotive <span>Empire</span></h1>
          <span className="dim">Engineer the cars. Run the company. Win the races. 1950 – today.</span>
        </header>
        <div className="modes">
          <button className="mode" onClick={() => go('setup-ceo')}>
            <div className="art" style={{ pointerEvents: 'none' }}><CarViewer distance={8.2}><RoadCar spec={classic} /></CarViewer></div>
            <div className="body">
              <span className="n">Mode 1</span><h2>Historical Automotive CEO</h2>
              <p className="dim">Take the chair at an established manufacturer in any year of its history.</p>
              <ul><li>18 real manufacturers, each with its own finances, plants, model range and board</li><li>Redesign the range, open factories abroad, acquire rivals</li><li>Follow history — or change it</li></ul>
              <span className="go">Choose a manufacturer →</span>
            </div>
          </button>
          <button className="mode" onClick={() => go('setup-founder')}>
            <div className="art" style={{ pointerEvents: 'none' }}><CarViewer distance={7.6}><RoadCar spec={concept} /></CarViewer></div>
            <div className="body">
              <span className="n">Mode 2</span><h2>Automotive Company Founder</h2>
              <p className="dim">Start a new marque from an empty drawing board and your seed capital.</p>
              <ul><li>Pick country, year, capital, speciality, plant and engineering team</li><li>Engineer your first car from the cylinder bore up</li><li>Build it, price it, sell it — then go racing</li></ul>
              <span className="go">Found a company →</span>
            </div>
          </button>
          <button className="mode" onClick={() => go('setup-motorsport')}>
            <div className="art" style={{ pointerEvents: 'none' }}><CarViewer distance={7.8}><RaceCar discipline="f1" year={1992} color="#e8b04a" color2="#15171b" wing={0.6} /></CarViewer></div>
            <div className="body">
              <span className="n">Mode 3</span><h2>Professional Motorsport Director</h2>
              <p className="dim">Run a works or independent racing team through full championship seasons.</p>
              <ul><li>Grand Prix single-seaters, Hypercar, LMDh, GT and touring cars</li><li>Design the car to the regulations of the era, hire drivers, develop</li><li>Call the strategy in a live, physics-driven race simulation</li></ul>
              <span className="go">Build a team →</span>
            </div>
          </button>
        </div>
        <section className="panel">
          <div className="row between wrap" style={{ marginBottom: 8 }}>
            <h3>Continue</h3>
            <div className="row">
              <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { start(await importFromFile(f)); } catch (err) { notify((err as Error).message, true); } e.target.value = ''; }} />
              <button className="btn sm" onClick={() => file.current?.click()}>Import save file…</button>
            </div>
          </div>
          {saves.length === 0 ? <p className="muted">No saved games yet. Games are saved automatically in this browser (IndexedDB) at the end of every month.</p> : (
            <table><thead><tr><th>Save</th><th>Mode</th><th>Date</th><th className="r">Cash</th><th>Saved</th><th /></tr></thead><tbody>
              {saves.map((s) => (
                <tr key={s.slot}>
                  <td><b>{s.company}</b> <span className="muted">· {s.slot}</span></td><td>{MODE_LABEL[s.mode] ?? s.mode}</td><td>{MONTHS[s.month - 1]} {s.year}</td><td className="r">{fmtMoney(s.cash)}</td>
                  <td className="muted">{new Date(s.savedAt).toLocaleString()}</td>
                  <td className="r"><button className="btn sm primary" onClick={() => load(s.slot)}>Load</button> <button className="btn sm ghost" onClick={async () => { await localSaves.remove(s.slot); void refresh(); }}>Delete</button></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
        <p className="muted small">An unofficial simulation. Manufacturer names are used descriptively for historical context; no logos, liveries or licensed assets are included. Historical facts are distinguished from estimated game data throughout (<span className="tag h">historical</span> <span className="tag a">approx.</span> <span className="tag e">estimate</span>). Circuits, drivers, sponsors and independent teams are fictional.</p>
      </div>
    </div>
  );
}
