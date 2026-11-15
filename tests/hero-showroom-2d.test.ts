import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroShowroom2D } from '../src/ui/art2d/HeroShowroom2D';

describe('Phase 5B native SVG showroom', () => {
  const draw = (color:string, body:'sedan'|'coupe'|'suv'='sedan') =>
    renderToString(createElement(HeroShowroom2D,{color,body,label:'An original car studio'}));

  it('uses lightweight real vector paths, no canvas, bitmaps, remote images or brands', () => {
    const html=draw('#315b8e');
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 1280 720"');
    expect(html).toContain('role="img"');
    expect(html).toContain('An original car studio');
    expect(html).toContain('ae-hero-vehicle');
    expect(html).toContain('studioFloor');
    expect((html.match(/<ellipse/g)??[]).length).toBeGreaterThan(7); // Wheels + ground shadows.
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('https:');
    expect(html).not.toContain('Mercedes');
  });

  it('changes vehicle paint without changing the design-studio lighting', () => {
    const blue=draw('#315b8e'),red=draw('#ad3437');
    expect(blue).toContain('#315b8e');
    expect(red).toContain('#ad3437');
    expect(red).not.toContain('#315b8e');
    expect(blue).not.toBe(red);
  });

  it('has distinctive coupe and SUV glasshouse geometries', () => {
    const sedan=draw('#315b8e','sedan');
    const coupe=draw('#315b8e','coupe');
    const suv=draw('#315b8e','suv');
    expect(sedan).not.toBe(coupe);
    expect(coupe).not.toBe(suv);
    expect(suv).not.toBe(sedan);
  });

  it('provides unique paint gradient ids for more than one showroom on a page', () => {
    const first=renderToString(createElement('div',{},[
      createElement(HeroShowroom2D,{key:'a',color:'#315b8e'}),
      createElement(HeroShowroom2D,{key:'b',color:'#ad3437'}),
    ]));
    const ids=[...first.matchAll(/id="(paintTop[^"]+)"/g)].map(match=>match[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('limits untrusted paint input to a valid CSS hexadecimal colour', () => {
    const html=draw('url(javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('#315b8e');
  });
});
