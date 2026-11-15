// Tiny synthesised sound effects (Web Audio, no files): a click, a claim jingle and chest openings that grow richer
// with rarity. They play only after a user gesture, can be muted (remembered in this browser), and do nothing where
// Web Audio is unavailable (tests, old browsers). Sound is off until the player turns it on.
import type { PartRarity } from '../../sim/progression';

const KEY = 'ae.sound.muted';
let ctx: AudioContext | null = null;
export const isMuted = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
export const setMuted = (m: boolean) => { try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* storage blocked */ } };

function audio(): AudioContext | null {
  if (isMuted() || typeof window === 'undefined') return null;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx ??= new AC(); if (ctx.state === 'suspended') void ctx.resume(); return ctx; } catch { return null; }
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.06) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at); o.stop(a.currentTime + at + dur + 0.02);
}
export const sfx = {
  click: () => tone(660, 0, 0.06, 'triangle', 0.03),
  claim: () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.05)); },
  chest: (r: PartRarity) => {
    const notes = { common: [392, 523], rare: [440, 587, 698], epic: [466, 622, 740, 932], legendary: [523, 659, 784, 1047], mythic: [554, 698, 831, 1109, 1397], relic: [587, 740, 880, 1175, 1480, 1760] }[r];
    tone(110, 0, 0.25, 'sawtooth', 0.03);
    notes.forEach((f, i) => tone(f, 0.25 + i * 0.09, 0.4, r === 'relic' || r === 'mythic' ? 'sine' : 'triangle', 0.05));
  },
};
