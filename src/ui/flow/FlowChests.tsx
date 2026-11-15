// Chests (Flow reference 06-cofres/B, reward state): the green trunk on its pedestal in the parts store, the earned
// chests in a tray below. The picture is the Flow original with its title, BACK button and generated card inpainted;
// the reward card is the game's real card. Rules are unchanged: one chest per real sales milestone, deterministic
// result, odds shown, no purchase of any kind. Open consumes the milestone once (and is disabled while opening);
// Claim confirms the part is in the collection. Only one chest drawing exists (the Flow trunk): the tray tints it by
// tier with a CSS filter and every rarity also has a name and a symbol, so colour is never the only signal.
import { useState } from 'react';
import { useGame, useStore } from '../../store/game';
import { useT } from '../../i18n';
import { num } from '../../i18n/format';
import { BLUEPRINTS, MILESTONES, RARITY, effectiveOdds, equipPart, lifetimeSales, openSalesChest, type ChestResult, type PartRarity } from '../../sim/progression';
import { PartCard, RARITY_ORDER } from '../art2d/Rewards2D';
import { sfx } from '../game2d/sfx';
import { BG, Scene, at, flowUrl } from './Scene';
import { FlowNav, useL } from './FlowHQ';

export const RARITY_SYMBOL: Record<PartRarity, string> = { common: '●', rare: '◆', epic: '▲', legendary: '★', mythic: '✦', relic: '✷' };
const TINT = ['saturate(0.12) brightness(0.95)', 'hue-rotate(75deg)', 'hue-rotate(135deg)', 'hue-rotate(-95deg) saturate(1.5) brightness(1.08)', 'hue-rotate(190deg) saturate(1.3)', 'hue-rotate(35deg) saturate(1.4) brightness(1.1)'];
/** The trunk's box in the cleaned background (native px), used for the tray thumbnails. */
const TRUNK = { x: 255, y: 250, w: 445, h: 360 };

export function ChestRoom({ withNav = false }: { withNav?: boolean }) {
  const { g, p } = useGame(); const { lang } = useT(); const l = useL();
  const act = useStore((s) => s.act), save = useStore((s) => s.save), setView = useStore((s) => s.setView);
  const sales = lifetimeSales(p), claimed = p.arcade?.claimedMilestones ?? [];
  const ready = MILESTONES.filter((m) => sales >= m && !claimed.includes(m));
  const [sel, setSel] = useState<number | null>(ready[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<ChestResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [skip, setSkip] = useState(false);
  const odds = effectiveOdds(g.year);
  const selReady = sel !== null && (ready as readonly number[]).includes(sel);
  const openChest = () => {
    if (sel === null || busy) return;
    setBusy(true); setDone(null); setSkip(false);
    const cap: { v?: ChestResult } = {};
    if (act((gg) => { const r = openSalesChest(gg, sel); if (typeof r === 'string') return r; cap.v = r; return null; }) && cap.v) { sfx.chest(cap.v.part.rarity); setReward(cap.v); void save('autosave'); }
    setBusy(false);
  };
  const claim = (equip: boolean) => {
    if (!reward) return;
    if (equip && !reward.duplicate && reward.part.firstYear <= g.year) act((gg) => equipPart(gg, reward.part.id));
    setDone(l(`${reward.part.es} quedó en tu colección.`, `${reward.part.en} is in your collection.`));
    setReward(null); setSel(ready.find((m) => m !== sel) ?? null); sfx.claim();
  };
  const r = reward?.part.rarity;
  return <section className="fs-screen fs-chests">
    <Scene bg="cofres" label={l('Sala de cofres', 'Chest room')}>
      <div className={'fs-dimmer' + (reward ? ' lit' : '')} />
      <div className="fs-chest-title"><small>Automotive Empire</small><b>{l('Cofres', 'Chests')}</b></div>
      {withNav && <button type="button" className="fm-btn small secondary fs-scene-back" style={{ position: 'absolute', right: '2%', top: '3%' }} onClick={() => setView('hq2d')}>← {l('Volver', 'Back')}</button>}
      {reward && r && <>
        {!skip && <span className="fs-burst" style={{ background: `radial-gradient(closest-side, ${RARITY[r].color}cc, ${RARITY[r].color}00)` }} />}
        <div className="fs-reward" style={{ ...at('cofres', 394, 112, 176, 276), animation: skip ? 'none' : undefined }} role="dialog" aria-label={l('Recompensa', 'Reward')}>
          <PartCard part={reward.part} owned={1} lang={lang} />
        </div>
      </>}
      {!reward && !done && <p className="fs-note" style={{ top: 'auto', bottom: 12 }}>{selReady ? l('Cofre listo: abrilo para ver la pieza.', 'Chest ready: open it to see the part.') : l('Ganás un cofre en cada hito real de ventas.', 'You earn a chest at each real sales milestone.')}</p>}
      {done && <p className="fs-note" role="status" style={{ top: 'auto', bottom: 12 }}>✓ {done}</p>}
    </Scene>
    <div className="fs-chesttray">
      <div className="fs-queue-list" role="group" aria-label={l('Cofres', 'Chests')}>
        {MILESTONES.map((m, i) => {
          const isClaimed = claimed.includes(m), isReady = (ready as readonly number[]).includes(m), tier = RARITY_ORDER[Math.min(5, i)];
          return <button type="button" key={m} className="fs-chestbtn" data-milestone={m} aria-pressed={sel === m} disabled={!isReady || !!reward} onClick={() => { setSel(m); setDone(null); }}
            aria-label={`${m === 0 ? l('Cofre inicial', 'Starter chest') : l(`Cofre de ${num(m, lang)} ventas`, `${num(m, lang)}-sales chest`)}: ${isClaimed ? l('abierto', 'opened') : isReady ? l('listo', 'ready') : l(`faltan ${num(m - sales, lang)} ventas`, `${num(m - sales, lang)} sales to go`)}`}>
            <span className="art" style={{ backgroundImage: `url(${flowUrl(BG.cofres.src)})`, backgroundSize: `${(BG.cofres.w / TRUNK.w) * 100}% auto`, backgroundPosition: `${(TRUNK.x / (BG.cofres.w - TRUNK.w)) * 100}% ${(TRUNK.y / (BG.cofres.h - TRUNK.h)) * 100}%`, filter: TINT[Math.min(5, i)] + (isReady ? '' : ' grayscale(0.6) brightness(0.6)') }}>
              {!isReady && <span className="lock" aria-hidden="true">{isClaimed ? '✓' : '🔒'}</span>}
            </span>
            <b>{RARITY_SYMBOL[tier]} {m === 0 ? l('Inicial', 'Starter') : num(m, lang)}</b>
            <small>{isClaimed ? l('Abierto', 'Opened') : isReady ? l('Listo', 'Ready') : l(`Faltan ${num(m - sales, lang)}`, `${num(m - sales, lang)} to go`)}</small>
          </button>;
        })}
      </div>
      {reward
        ? <div className="fs-toolbar">
            <button type="button" className="fm-btn primary" data-action="claim-chest" autoFocus onClick={() => claim(false)}>{l('Reclamar', 'Claim')}</button>
            {!reward.duplicate && reward.part.firstYear <= g.year && <button type="button" className="fm-btn secondary" onClick={() => claim(true)}>{l('Reclamar y equipar', 'Claim & equip')}</button>}
            {!skip && <button type="button" className="fm-btn small secondary" onClick={() => setSkip(true)}>{l('Saltar animación', 'Skip animation')}</button>}
            <span className="fs-soft">{RARITY_SYMBOL[reward.part.rarity]} {lang === 'es' ? RARITY[reward.part.rarity].es : RARITY[reward.part.rarity].en} · {reward.duplicate ? l(`repetida: +${reward.creditsAdded} créditos`, `duplicate: +${reward.creditsAdded} credits`) : l(`nueva · +${reward.creditsAdded} créditos`, `new · +${reward.creditsAdded} credits`)}</span>
          </div>
        : <button type="button" className="fm-btn primary" data-action="open-chest" disabled={!selReady || busy} onClick={openChest}>{l('Abrir', 'Open')}</button>}
    </div>
    <div className="fs-panel" aria-label={l('Probabilidades', 'Odds')}>
      <span className="fs-kicker">{l(`Probabilidades en ${g.year}`, `Odds in ${g.year}`)}</span>
      <div className="fs-chiprow" style={{ marginTop: 8 }}>{RARITY_ORDER.map((k) => <span key={k} className="fs-chip" style={{ cursor: 'default', borderColor: RARITY[k].color }}>{RARITY_SYMBOL[k]} {lang === 'es' ? RARITY[k].es : RARITY[k].en} {odds[k]}%</span>)}</div>
      <p className="fs-soft" style={{ margin: '8px 0 0' }}>{l('Los cofres solo se ganan con ventas reales; no se compran. Rarezas sin piezas inventadas todavía pasan su probabilidad a Común.', 'Chests are only earned with real sales; they are never sold. Rarities with no part invented yet pass their share to Common.')} {BLUEPRINTS.length} {l('piezas en total.', 'parts in all.')}</p>
    </div>
    {withNav && <FlowNav current="chests2d" />}
  </section>;
}

export function FlowChestsScreen() { return <ChestRoom withNav />; }
