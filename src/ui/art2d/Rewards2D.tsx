// Chests and collectible cards. Each rarity has its own material, colour, glow and opening effect; cards show the
// blueprint's own illustration (wheel, engine, body kit or chassis) in a rarity frame with a foil sheen from
// legendary up. Animations are CSS (empire2d.css) and stop under prefers-reduced-motion.
import { memo, useId } from 'react';
import type { Blueprint, PartRarity } from '../../sim/progression';
import { RARITY } from '../../sim/progression';
import { Car2D, Wheel } from './Car2D';
import { Engine2D } from './Engine2D';
import { Chassis2D } from './Parts2D';
import { SolidArt, abox, box, over, shadeMat, type Mat, type Solid } from './solids';
import { hexRgb, surface, type Projector, type V3 } from './vector3d';

export const RARITY_ORDER: PartRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'relic'];
// each rarity is built differently: body finish, band metal, corner caps, ornaments, gems, and for the relic a
// translucent crystal shell around a glowing core with floating shards
const LOOK: Record<PartRarity, { body: Mat; band: Mat; gem: string; caps: boolean; crown: boolean; crystal?: boolean }> = {
  common: { body: { c: [112, 76, 46], spec: 0.08 }, band: { c: [92, 96, 102], spec: 0.3 }, gem: '#c7d0da', caps: false, crown: false },
  rare: { body: { c: [44, 82, 132], spec: 0.35 }, band: { c: [170, 180, 192], spec: 0.7, metal: true }, gem: '#66b4f5', caps: true, crown: false },
  epic: { body: { c: [74, 48, 120], spec: 0.45 }, band: { c: [186, 168, 220], spec: 0.8, metal: true }, gem: '#be83ff', caps: true, crown: false },
  legendary: { body: { c: [28, 26, 30], spec: 0.6 }, band: { c: [222, 176, 78], spec: 0.9, metal: true }, gem: '#f0c36c', caps: true, crown: true },
  mythic: { body: { c: [128, 22, 54], spec: 0.6 }, band: { c: [230, 186, 96], spec: 0.9, metal: true }, gem: '#ff7eb0', caps: true, crown: true },
  relic: { body: { c: [40, 150, 140], spec: 0.8, alpha: 0.55 }, band: { c: [200, 250, 240], spec: 0.9, metal: true }, gem: '#75ead0', caps: true, crown: true, crystal: true },
};

function chestSolids(cam: Projector, rarity: PartRarity, open: boolean): Solid[] {
  const L = LOOK[rarity], tier = RARITY_ORDER.indexOf(rarity), S: Solid[] = [];
  const W = 0.62, D = 0.4, H = 0.36;
  if (L.crystal) S.push(abox(cam, [0, 0, 0.3], 0.3, 0.18, 0.18, { c: [190, 255, 240], spec: 0 }));      // glowing core
  S.push(abox(cam, [0, 0, H / 2], W, D, H / 2, L.body));
  for (const x of [-0.42, 0, 0.42]) S.push(abox(cam, [x, 0, H / 2], 0.045, D + 0.012, H / 2 + 0.004, L.band));
  S.push(abox(cam, [0, 0, H - 0.03], W + 0.01, D + 0.012, 0.03, L.band));
  if (L.caps) for (const x of [-W, W]) for (const y of [-D, D]) S.push(abox(cam, [x, y, H / 2], 0.05, 0.05, H / 2 + 0.01, L.band));
  // lid: a half barrel hinged at the back edge; open means rotated back about the hinge
  const ang = open ? -1.95 : 0, hinge: V3 = [0, D, H];
  const rot = (p: V3): V3 => { const dy = p[1] - hinge[1], dz = p[2] - hinge[2]; return [p[0], hinge[1] + dy * Math.cos(ang) - dz * Math.sin(ang), hinge[2] + dy * Math.sin(ang) + dz * Math.cos(ang)]; };
  const lidAt = (u: number, v: number, r = D): V3 => rot([-W + 2 * W * u, -Math.cos(v * Math.PI) * r, H + Math.sin(v * Math.PI) * r * 0.85]);
  S.push({ ...solidFrom(surface(cam, 10, 14, (u, v) => lidAt(u, v), shadeMat(L.body), { inside: (q) => [q[0], rot([0, 0, H])[1], rot([0, 0, H])[2]] })), alpha: L.body.alpha });
  for (const x of [-0.42, 0, 0.42]) S.push(solidFrom(surface(cam, 1, 14, (u, v) => lidAt((x + W) / (2 * W) + (u - 0.5) * 0.075, v, D + 0.012), shadeMat(L.band), { inside: (q) => [q[0], rot([0, 0, H])[1], rot([0, 0, H])[2]] })));
  for (const sx of [-1, 1]) S.push(solidFrom(surface(cam, 1, 14, (u, v) => { const p = lidAt(sx < 0 ? 0 : 1, v, D * u); return p; }, shadeMat(L.body), { cull: false })));
  // lock plate and gem on the front
  const front = -D - 0.012;
  S.push(over(abox(cam, [0, front, H - 0.02], 0.09, 0.012, 0.1, L.band), 2), over(box(cam, [0, front - 0.02, H - 0.02], [0.05, 0, 0.05], [0, 0.01, 0], [-0.05, 0, 0.05], { c: hexRgb(L.gem), spec: 0.9, metal: true }), 3));
  if (L.crown) for (const x of [-0.25, 0, 0.25]) S.push(over(box(cam, rot([x, -0.02, H + D * 0.85 + 0.05]), [0.035, 0, 0.035], [0, 0.035, 0], [0, 0, 0.06], L.band), 2));
  if (tier >= 4) for (const x of [-W, W]) S.push(over(box(cam, [x, front - 0.01, 0.12], [0.03, 0, 0.03], [0, 0.01, 0], [-0.03, 0, 0.03], { c: hexRgb(L.gem), spec: 0.9, metal: true }), 3));
  if (L.crystal) for (const [x, y, z] of [[-0.8, 0.1, 0.9], [0.85, -0.1, 0.75], [0.3, 0.2, 1.15], [-0.4, -0.2, 1.2]] as V3[]) S.push(box(cam, [x, y, z], [0.05, 0.02, 0.05], [0, 0.04, 0], [-0.04, 0, 0.07], { c: [170, 245, 230], spec: 0.9, metal: true, alpha: 0.85 }));
  return S;
}
const solidFrom = (facets: Solid['facets']): Solid => ({ facets, depth: facets.length ? facets.reduce((a, f) => a + f.depth, 0) / facets.length : 0 });

export const Chest2D = memo(function Chest2D({ rarity = 'common', state = 'closed', className }: { rarity?: PartRarity; state?: 'closed' | 'ready' | 'opening' | 'open'; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = LOOK[rarity], tier = RARITY_ORDER.indexOf(rarity), open = state === 'opening' || state === 'open';
  return (
    <div className={`chest2d chest2d-${rarity} chest2d-${state} ${className ?? ''}`} role="img" aria-label={`${RARITY[rarity].en} chest`}>
      <SolidArt build={(cam) => chestSolids(cam, rarity, open)} eye={[-1.7, -2.6, 1.6]} target={[0, 0, 0.35]} deps={rarity + open} aspect={160 / 140}
        underlay={({ vb }) => { const [x, y, w, h] = vb; return (state === 'ready' || open) ? <g><defs><radialGradient id={`g${id}`}><stop offset="0" stopColor={L.gem} stopOpacity="0.75" /><stop offset="1" stopColor={L.gem} stopOpacity="0" /></radialGradient></defs><circle className="chest2d-glow" cx={x + w / 2} cy={y + h * 0.5} r={w * 0.5} fill={`url(#g${id})`} /></g> : null; }}>
        {({ vb }) => { const [x, y, w, h] = vb, cx = x + w / 2, cy = y + h * 0.42; return <g>
          {open && <g className="chest2d-rays" style={{ mixBlendMode: 'screen' }}>{Array.from({ length: 8 + tier * 2 }, (_, i) => { const a = (i / (8 + tier * 2)) * Math.PI * 2; return <path key={i} d={`M${cx} ${cy}L${cx + Math.cos(a) * w * 0.6} ${cy + Math.sin(a) * w * 0.6}`} stroke={L.gem} strokeWidth={w * (0.008 + tier * 0.002)} strokeOpacity="0.5" />; })}</g>}
          {tier >= 3 && <g className="chest2d-sparkles" fill="#fff">{[[0.15, 0.2], [0.85, 0.25], [0.8, 0.7], [0.18, 0.72]].slice(0, tier - 1).map(([px, py], i) => { const sx = x + w * px, sy = y + h * py, r = w * 0.03; return <path key={i} d={`M${sx} ${sy - r}L${sx + r * 0.3} ${sy - r * 0.3}L${sx + r} ${sy}L${sx + r * 0.3} ${sy + r * 0.3}L${sx} ${sy + r}L${sx - r * 0.3} ${sy + r * 0.3}L${sx - r} ${sy}L${sx - r * 0.3} ${sy - r * 0.3}Z`} />; })}</g>}
        </g>; }}
      </SolidArt>
    </div>
  );
});

/** The illustration on a card: what the blueprint actually is. */
export function BlueprintArt({ part }: { part: Blueprint }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (part.slot === 'wheels') {
    const look = part.id === 'steel-rims' ? 'steel' : part.id === 'five-spoke' ? 'fivespoke' : 'forged';
    return <svg viewBox="0 0 120 90" className="part2d">
      <defs><radialGradient id={`t${uid}`} cx="50%" cy="45%" r="55%"><stop offset="0.72" stopColor="#1b1d22" /><stop offset="1" stopColor="#050506" /></radialGradient><linearGradient id={`m${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f8" /><stop offset="0.5" stopColor="#9aa4b1" /><stop offset="1" stopColor="#d7dde4" /></linearGradient></defs>
      <Wheel x={60} y={45} R={38} rimShare={0.68} look={look} caliper={look === 'forged' ? '#d2342c' : null} uid={uid} />
    </svg>;
  }
  if (part.slot === 'engine') {
    const engine = part.id === 'inline-four' ? { layout: 'I4' as const, displacement: 1600, valvetrain: 'ohv' as const }
      : part.id === 'aluminium-v6' ? { layout: 'V6' as const, displacement: 3000, valvetrain: 'dohc4' as const }
      : part.id === 'twinturbo' ? { layout: 'I6' as const, displacement: 3000, aspiration: 'twinturbo' as const, valvetrain: 'dohc4' as const }
      : part.id === 'race-v8' ? { layout: 'V8' as const, displacement: 5000, redline: 8500, valvetrain: 'dohc4' as const }
      : part.id === 'hybrid' ? { layout: 'V6' as const, displacement: 3500, hybridKw: 120, aspiration: 'turbo' as const }
      : { layout: 'EV' as const, motorKw: 400, batteryKwh: 100 };
    return <Engine2D engine={engine} compact />;
  }
  if (part.slot === 'chassis') {
    const type = part.id === 'steel-frame' ? 'ladder' : part.id === 'spaceframe' ? 'spaceframe' : part.id === 'carbon-frame' ? 'carbon' : 'steel';
    return <Chassis2D type={type} />;
  }
  const body = part.id === 'sedan' ? 'sedan' : part.id === 'hyperbody' ? 'supercar' : 'coupe';
  return <Car2D body={body} year={part.firstYear < 1980 ? 1968 : 2012} color={RARITY[part.rarity].color} equipped={{ body: part.id }} ground={false} />;
}

const SLOT_EN = { body: 'BODY', wheels: 'WHEELS', engine: 'ENGINE', chassis: 'CHASSIS' } as const;
const SLOT_ES = { body: 'CARROCERÍA', wheels: 'RUEDAS', engine: 'MOTOR', chassis: 'CHASIS' } as const;
export const PartCard = memo(function PartCard({ part, owned = 0, equipped = false, locked = false, lang, children }: { part: Blueprint; owned?: number; equipped?: boolean; locked?: boolean; lang: 'en' | 'es'; children?: React.ReactNode }) {
  const r = RARITY[part.rarity], tier = RARITY_ORDER.indexOf(part.rarity);
  return (
    <article className={`card2d card2d-${part.rarity}${tier >= 3 ? ' card2d-foil' : ''}${owned ? '' : ' card2d-missing'}${locked ? ' card2d-locked' : ''}${equipped ? ' card2d-equipped' : ''}`} style={{ ['--rar' as string]: r.color }} data-part={part.id}>
      <header><span className="card2d-rarity">{lang === 'es' ? r.es : r.en}</span><span className="card2d-stars" aria-label={`${tier + 1} / 6`}>{'★'.repeat(tier + 1)}</span></header>
      <div className="card2d-art"><BlueprintArt part={part} /></div>
      <h4>{lang === 'es' ? part.es : part.en}</h4>
      <footer><span>{(lang === 'es' ? SLOT_ES : SLOT_EN)[part.slot]}</span><span>{part.firstYear}+</span>{owned > 1 && <span>×{owned}</span>}</footer>
      {children}
    </article>
  );
});
