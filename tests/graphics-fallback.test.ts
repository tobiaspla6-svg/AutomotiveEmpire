// Graphics capability logic: what the game does on weak hardware, software rendering and with no WebGL at all.
import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer, judgeFps, recommendQuality, type HardwareInfo } from '../src/three/hardware';
import { QUALITY, resolveQuality } from '../src/three/quality';

const hw = (o: Partial<HardwareInfo> = {}): HardwareInfo => ({ webgl: 'webgl2', renderer: 'NVIDIA GeForce RTX 3060', software: false, mobile: false, cores: 8, memoryGB: 8, ...o });

describe('automatic graphics choice', () => {
  it('never picks High automatically, even on strong hardware', () => {
    expect(recommendQuality(hw())).toBe('medium');
    expect(recommendQuality(hw({ cores: 32, memoryGB: 8 }))).toBe('medium');
  });
  it('uses Low on software rendering, phones and very small machines', () => {
    expect(recommendQuality(hw({ software: true, renderer: 'Google SwiftShader' }))).toBe('low');
    expect(recommendQuality(hw({ mobile: true }))).toBe('low');
    expect(recommendQuality(hw({ cores: 2 }))).toBe('low');
    expect(recommendQuality(hw({ memoryGB: 2 }))).toBe('low');
  });
  it('turns 3D off when WebGL is missing', () => {
    expect(recommendQuality(hw({ webgl: 'none' }))).toBe('off');
  });
  it('recognises software rasterisers by name', () => {
    for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', 'llvmpipe (LLVM 15)', 'Microsoft Basic Render Driver', 'Mesa Offscreen']) expect(isSoftwareRenderer(r), r).toBe(true);
    for (const r of ['NVIDIA GeForce RTX 3060', 'Apple M2', 'AMD Radeon RX 6800', 'Intel(R) UHD Graphics 620']) expect(isSoftwareRenderer(r), r).toBe(false);
  });
});

describe('quality resolution', () => {
  it('an explicit preference wins over the hardware recommendation, except when 3D cannot run', () => {
    expect(resolveQuality('high', hw())).toBe('high');
    expect(resolveQuality('low', hw())).toBe('low');
    expect(resolveQuality('auto', hw())).toBe('medium');
    expect(resolveQuality('off', hw())).toBe('off');
    expect(resolveQuality('high', hw({ webgl: 'none' }))).toBe('off');
    expect(resolveQuality('medium', hw(), true)).toBe('off'); // a view failed earlier in the session
  });
  it('presets get strictly heavier from Low to High', () => {
    expect(QUALITY.low.lod).toBeGreaterThan(QUALITY.medium.lod);
    expect(QUALITY.medium.lod).toBeGreaterThan(QUALITY.high.lod);
    expect(QUALITY.low.hdr || QUALITY.low.transmission).toBe(false);
    expect(QUALITY.high.transmission).toBe(true);
    expect(QUALITY.low.dpr[1]).toBeLessThanOrEqual(QUALITY.medium.dpr[1]);
  });
});

describe('frame-rate verdict', () => {
  it('suggests stepping up when smooth, down when slow, and never below Low', () => {
    expect(judgeFps(60, 'low')).toBe('step-up');
    expect(judgeFps(60, 'high')).toBe('ok');
    expect(judgeFps(40, 'medium')).toBe('ok');
    expect(judgeFps(12, 'medium')).toBe('step-down');
    expect(judgeFps(12, 'low')).toBe('ok');
  });
});
