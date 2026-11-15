// Headquarters (Flow reference 02-headquarters/A-campus): the night campus with its art-deco head office, design
// workshop, factory and garage. The picture is the Flow original with its generated header, bottom bar and pins
// removed (cropped or inpainted, see public/flow/bg/provenance.json); the header, pins and navigation are live React.
// Pins show real company data and lead to existing screens; buildings the company has not developed yet are shaded.
import { useState } from 'react';
import type { Company, GameState } from '../../sim/types';
import { useT } from '../../i18n';
import { money, num } from '../../i18n/format';
import { useStore } from '../../store/game';
import { REGION_IDS } from '../../data/world';
import { Icon, type IconName } from '../ds/icons';
import { companyLevel } from '../../sim/achievements';
import { lifetimeSales } from '../../sim/progression';
import { sfx } from '../game2d/sfx';
import { Scene, at } from './Scene';

export const useL = () => { const { lang } = useT(); return (es: string, en: string) => (lang === 'es' ? es : en); };

type Spot = 'office' | 'studio' | 'lab' | 'factory' | 'garage' | 'showroom' | 'track';
/** Pin tips and building centres, in the cleaned background's native pixels (1376×584). */
const SPOTS: Record<Spot, { tip: [number, number]; glow: [number, number, number]; icon: IconName; view: string }> = {
  office: { tip: [706, 92], glow: [735, 194, 260], icon: 'company', view: 'dashboard' },
  studio: { tip: [272, 208], glow: [290, 254, 230], icon: 'wrench', view: 'studio2d' },
  lab: { tip: [962, 98], glow: [965, 134, 110], icon: 'research', view: 'skills2d' },
  factory: { tip: [1126, 170], glow: [1140, 194, 260], icon: 'factory', view: 'factory2d' },
  garage: { tip: [972, 404], glow: [1000, 434, 250], icon: 'vehicle', view: 'garage2d' },
  showroom: { tip: [1330, 366], glow: [1330, 394, 110], icon: 'market', view: 'campaign2d' },
  track: { tip: [140, 112], glow: [150, 184, 200], icon: 'flag', view: 'motorsport' },
};

export function hqStatus(g: GameState, p: Company, l: (es: string, en: string) => string, lang: 'es' | 'en') {
  const cap = p.factories.reduce((a, f) => a + f.capacity, 0);
  const built = p.models.filter((m) => m.cumulativeUnits > 0 || m.status === 'production' || m.status === 'ready').length;
  const reach = REGION_IDS.reduce((a, r) => a + p.reach[r], 0);
  const lead = Object.values(p.tech).reduce((a, v) => a + v, 0) / 5;
  const S: Record<Spot, { name: string; status: string; active: boolean }> = {
    office: { name: l('Oficinas centrales', 'Head office'), status: money(p.cash, lang), active: true },
    studio: { name: l('Taller de diseño', 'Design workshop'), status: l(`${p.engineers} ingenieros`, `${p.engineers} engineers`), active: p.engineers > 0 },
    lab: { name: l('Investigación', 'Research'), status: l(`Nivel ${lead.toFixed(1)}`, `Level ${lead.toFixed(1)}`), active: true },
    factory: { name: l('Fábrica', 'Factory'), status: p.factories.length ? l(`${p.factories.length} plantas · ${num(cap, lang)}/mes`, `${p.factories.length} plants · ${num(cap, lang)}/mo`) : l('Sin planta', 'No plant yet'), active: cap > 0 },
    garage: { name: l('Garaje', 'Garage'), status: l(`${built} modelos`, `${built} models`), active: built > 0 },
    showroom: { name: l('Concesionarios', 'Dealers'), status: reach > 0 ? l(`${num(reach, lang)} autos/año`, `${num(reach, lang)} cars/yr`) : l('Sin red', 'No network'), active: reach > 0 },
    track: { name: l('Motorsport', 'Motorsport'), status: p.motorsport ? l('División activa', 'Division active') : l('Sin división', 'No division'), active: !!p.motorsport },
  };
  void g;
  return S;
}

export function FlowNav({ current }: { current: string }) {
  const l = useL(), setView = useStore((s) => s.setView);
  const tabs: { view: string; es: string; en: string; icon: IconName }[] = [
    { view: 'hq2d', es: 'Sede', en: 'HQ', icon: 'home' }, { view: 'studio2d', es: 'Taller', en: 'Workshop', icon: 'wrench' },
    { view: 'factory2d', es: 'Fábrica', en: 'Factory', icon: 'factory' }, { view: 'garage2d', es: 'Garaje', en: 'Garage', icon: 'vehicle' },
    { view: 'chests2d', es: 'Cofres', en: 'Chests', icon: 'box' },
  ];
  return <nav className="fs-nav" aria-label={l('Destinos', 'Destinations')}>
    {tabs.map((t) => <button type="button" key={t.view} className="fs-tab" data-dest={t.view} aria-current={current === t.view ? 'page' : undefined} onClick={() => { sfx.click(); setView(t.view); }}><Icon name={t.icon} size={22} />{l(t.es, t.en)}</button>)}
  </nav>;
}

export function FlowBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return <header className="fs-bar"><div className="fs-brand">Automotive<small>Empire</small></div><h2>{title}</h2><div className="fs-res">{children}</div></header>;
}

export function FlowCampus({ g, p }: { g: GameState; p: Company }) {
  const { lang } = useT(); const l = useL();
  const setView = useStore((s) => s.setView);
  const [hover, setHover] = useState<Spot | null>(null);
  const st = hqStatus(g, p, l, lang);
  return <div className="fs-screen fs-hq">
    <FlowBar title={l('Sede central', 'Headquarters')}>
      <span><Icon name="cash" size={20} />{money(p.cash, lang)}</span>
      <span><Icon name="trophy" size={20} />{l('Nivel', 'Level')} {companyLevel(p)} <small>· {num(lifetimeSales(p), lang)} {l('vendidos', 'sold')}</small></span>
    </FlowBar>
    <Scene bg="headquarters" label={l('Campus de la empresa', 'Company campus')}>
      {(Object.keys(SPOTS) as Spot[]).map((k) => { const [x, y, r] = SPOTS[k].glow; return st[k].active
        ? <span key={'g' + k} className={'fs-glow' + (hover === k ? ' on' : '')} style={{ ...at('headquarters', x, y), width: `${(r / 1376) * 100}%`, aspectRatio: '1.6' }} />
        : <span key={'s' + k} className="fs-shade" style={{ ...at('headquarters', x, y), width: `${(r / 1376) * 100}%`, aspectRatio: '1.6' }} />; })}
      {(Object.keys(SPOTS) as Spot[]).map((k) => {
        const s = SPOTS[k], [x, y] = s.tip;
        const flip = x > 1180;
        return <button type="button" key={k} className={'fs-pin' + (hover === k ? ' on' : '') + (st[k].active ? '' : ' dim') + (flip ? ' flip' : '')} data-spot={k} style={{ ...at('headquarters', x, y), transform: flip ? 'translate(calc(-100% + 29px), calc(-100% - 9px))' : 'translate(-29px, calc(-100% - 9px))' }}
          onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)} onBlur={() => setHover(null)}
          onClick={() => { sfx.click(); setView(s.view); }} aria-label={`${st[k].name}: ${st[k].status}`}>
          <i><Icon name={s.icon} size={22} /></i><span>{st[k].name}<small>{st[k].status}</small></span>
        </button>;
      })}
    </Scene>
    <FlowNav current="hq2d" />
  </div>;
}
