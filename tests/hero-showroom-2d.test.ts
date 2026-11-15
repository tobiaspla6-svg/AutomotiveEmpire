import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroShowroom2D } from '../src/ui/art2d/HeroShowroom2D';
import { camera, surface, batch, paint, hexRgb } from '../src/ui/art2d/vector3d';
import type { BodyType } from '../src/sim/types';

describe('Phase 5B showroom: perspective vector car', () => {
  const draw = (color: string, body: BodyType = 'sedan', compact = false) =>
    renderToString(createElement(HeroShowroom2D, { color, body, compact, label: 'An original car studio' }));

  it('is plain SVG: no canvas, bitmaps, remote images or brands', () => {
    const html = draw('#315b8e');
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('An original car studio');
    expect(html).toContain('ae-hero-vehicle');
    expect(html).toContain('studioFloor');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('https:');
  });

  it('stays light: facets are batched by colour into a few hundred paths', () => {
    for (const body of ['sedan', 'coupe', 'suv', 'pickup'] as BodyType[]) {
      const paths = (draw('#315b8e', body).match(/<path/g) ?? []).length;
      expect(paths, body).toBeGreaterThan(80);
      expect(paths, body).toBeLessThan(700);
    }
  });

  it('follows the paint colour and every body type draws a different car', () => {
    const blue = draw('#315b8e'), red = draw('#ad3437');
    expect(blue).toContain('data-paint="#315b8e"');
    expect(red).toContain('data-paint="#ad3437"');
    expect(blue).not.toBe(red);
    const bodies: BodyType[] = ['hatch', 'sedan', 'wagon', 'coupe', 'roadster', 'supercar', 'suv', 'pickup'];
    const out = new Set(bodies.map((b) => draw('#315b8e', b)));
    expect(out.size).toBe(bodies.length);
  });

  it('gives each showroom on a page its own ids', () => {
    const html = renderToString(createElement('div', {}, [
      createElement(HeroShowroom2D, { key: 'a', color: '#315b8e' }),
      createElement(HeroShowroom2D, { key: 'b', color: '#ad3437', compact: true }),
    ]));
    const ids = [...html.matchAll(/id="(paintTop[^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('only accepts a hexadecimal paint colour', () => {
    const html = draw('url(javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('data-paint="#315b8e"');
  });
});

describe('vector3d renderer', () => {
  const cam = camera({ eye: [0, -5, 0], target: [0, 0, 0], focal: 100, cx: 0, cy: 0 });
  const sphere = (u: number, v: number): [number, number, number] => {
    const th = u * Math.PI, ph = v * Math.PI * 2;
    return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
  };
  it('culls the far half of a closed surface', () => {
    const all = surface(cam, 12, 24, sphere, () => [200, 0, 0], { cull: false, inside: () => [0, 0, 0] });
    const front = surface(cam, 12, 24, sphere, () => [200, 0, 0], { inside: () => [0, 0, 0] });
    expect(front.length).toBeGreaterThan(all.length * 0.25); // a perspective camera sees a bit less than half
    expect(front.length).toBeLessThan(all.length * 0.6);
  });
  it('batches same-coloured facets into one path', () => {
    const f = surface(cam, 6, 12, sphere, () => [100, 100, 100], { inside: () => [0, 0, 0] });
    expect(batch(f)).toHaveLength(1);
  });
  it('lights a surface facing the key light more than one facing away', () => {
    const up = paint(hexRgb('#808080'), [0, 0, 1], [0, 1, 0]);
    const down = paint(hexRgb('#808080'), [0, 0, -1], [0, 1, 0]);
    expect(up[0] + up[1] + up[2]).toBeGreaterThan(down[0] + down[1] + down[2]);
  });
});
