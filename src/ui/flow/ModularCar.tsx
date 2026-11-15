// Phase 6: a vehicle drawn from an art family record (sim/vehicleArt.ts, data in src/data/artFamilies.ts). The same
// component draws any family: shadow, body, the repaint of the family's paint mask (only when a colour other than
// the original is chosen and the mask is drawable), then the chosen variant layers at their boxes, in the family's
// stacking order. Everything shares the family canvas and one transform: nothing is stretched or re-framed per part.
// Variant images load only when chosen (plain <img> elements are created only for chosen layers).
import type { CSSProperties } from 'react';
import { DRAWABLE, layersFor, type VehicleArtFamily } from '../../sim/vehicleArt';
import { PaintStack, flowUrl, pctIn, type Finish } from './Scene';

export function ModularCar({ family: f, paint, parts, finish = 'metallic', className, label, style }: { family: VehicleArtFamily; paint?: string; parts?: Record<string, string>; finish?: Finish; className?: string; label?: string; style?: CSSProperties }) {
  const url = (file: string) => flowUrl(`${f.dir}/${file}`);
  const original = f.paint?.original;
  const safe = paint && /^#[0-9a-f]{6}$/i.test(paint) ? paint.toLowerCase() : original;
  const repaint = !!f.paint && DRAWABLE.includes(f.paint.mask.approval) && !!safe && safe !== original;
  const layers = layersFor(f, parts);
  return <div className={'mcar gt01 ' + (className ?? '')} style={{ aspectRatio: `${f.canvas.w} / ${f.canvas.h}`, ...style }} role="img" aria-label={label ?? f.name.en}
    data-family={f.id} data-paint={safe} data-finish={finish} data-parts={layers.join(' ')} data-repaint={repaint ? '1' : '0'}>
    <img className="gt01-layer" src={url(f.base.shadow.file)} alt="" />
    <img className="gt01-layer" src={url(f.base.body.file)} alt="" />
    {repaint && <PaintStack mask={`${f.dir}/${f.paint!.mask.file}`} paint={safe!} finish={finish} canvas={f.canvas} srcL={f.paint!.sourceLuma} />}
    {layers.map((k) => <img key={k} className="gt01-overlay" data-layer={k} src={url(f.layers[k].file)} alt="" style={pctIn(f.layers[k].box, f.canvas)} />)}
  </div>;
}

/** A cut-out [x, y, w, h] of a family drawing (option thumbnails), contained in its box. */
export function ModularCrop({ family: f, rect, paint, parts, finish }: { family: VehicleArtFamily; rect: [number, number, number, number]; paint?: string; parts?: Record<string, string>; finish?: Finish }) {
  const [x, y, w, h] = rect;
  return <div className="gt01-crop" style={{ aspectRatio: `${w} / ${h}`, '--ar': w / h } as CSSProperties}>
    <ModularCar family={f} paint={paint} parts={parts} finish={finish} style={{ position: 'absolute', width: `${(f.canvas.w / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }} />
  </div>;
}
