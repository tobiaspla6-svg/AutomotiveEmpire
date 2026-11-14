// Guard around every 3D view (Phase 4C).
//
//  • Lazy: the Three.js code is a separate chunk, downloaded only once the view is on screen and the browser is idle.
//  • Safe: with graphics off, no WebGL, a lost context or a rendering error, the view's illustration is shown instead
//    and the rest of the interface keeps working. A failure is remembered, so later views do not try again.
//  • Quiet: the poster is shown while loading, so the layout never jumps and the interface stays responsive.
import { Component, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { reportWebglFailure } from '../three/hardware';
import { useGraphics } from '../three/quality';

export const RoadCarViewer = lazy(() => import('../three/views').then((m) => ({ default: m.RoadCarViewer })));
export const RaceCarViewer = lazy(() => import('../three/views').then((m) => ({ default: m.RaceCarViewer })));
export const ShowroomViewer = lazy(() => import('../three/views').then((m) => ({ default: m.ShowroomViewer })));
export const FpsTestViewer = lazy(() => import('../three/views').then((m) => ({ default: m.FpsTestViewer })));
export const VehicleViewer = lazy(() => import('../three/views').then((m) => ({ default: m.VehicleViewer })));

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) { console.warn('3D view failed, showing the illustration instead:', err.message); reportWebglFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
/** Run `cb` when the browser is idle (or shortly after, where requestIdleCallback does not exist). */
const idle = (cb: () => void): number => { const w = window as IdleWindow; return w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 700 }) : window.setTimeout(cb, 80); };
const cancelIdle = (h: number) => { const w = window as IdleWindow; if (w.cancelIdleCallback) w.cancelIdleCallback(h); else window.clearTimeout(h); };

export function Guard3D({ children, poster, className, style, eager = false }: { children: ReactNode; poster: ReactNode; className?: string; style?: CSSProperties; eager?: boolean }) {
  const { enabled } = useGraphics();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!enabled || visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, visible]);
  useEffect(() => {
    if (!enabled || !visible) return;
    const h = idle(() => setArmed(true));
    return () => cancelIdle(h);
  }, [enabled, visible]);
  return (
    <div ref={ref} className={'guard3d ' + (className ?? '')} style={style} data-3d={enabled && armed ? 'on' : 'off'}>
      {enabled && armed ? <Boundary fallback={poster}><Suspense fallback={poster}>{children}</Suspense></Boundary> : poster}
    </div>
  );
}
