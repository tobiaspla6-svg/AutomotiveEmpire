// Icon set: one visual language (24 px grid, 1.6 px rounded strokes, currentColor). Paths are inline, so there is no
// icon font or network request.
import type { SVGProps } from 'react';

const P: Record<string, string> = {
  dashboard: 'M4 4h7v8H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  vehicle: 'M2.5 15.5v-3l2.1-4.2a2 2 0 0 1 1.8-1.1h6.2a2 2 0 0 1 1.5.7l2.2 2.6 2.7.7a1.5 1.5 0 0 1 1 1.4v2.9M2.5 15.5h2.2M8.7 15.5h6.6M19.3 15.5h2.2M5.4 8.5h8.4',
  wheel: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 3v6.5M12 14.5V21M3.6 9.5l5.9 2.5M14.5 12l5.9 2.5',
  factory: 'M3 20.5V10.5l6 3.8v-3.8l6 3.8V4.5h5a1 1 0 0 1 1 1v15zM7 17.5h2M12 17.5h2M17 17.5h1',
  market: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  research: 'M9 3h6M10 3v6.3L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.3V3M7.4 14h9.2',
  finance: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.9 9.4c-.5-.9-1.5-1.4-2.9-1.4-1.8 0-2.9.9-2.9 2.1s1 1.7 2.9 2.1 2.9.9 2.9 2.1-1.1 2.1-2.9 2.1c-1.5 0-2.6-.6-3.1-1.5M12 6.5V8M12 16v1.5',
  flag: 'M5 21V4M5 4.5h11l-1.9 3.6L16 11.7H5',
  company: 'M3.5 8h17a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M2.5 13.5h19M10.5 13.5v2h3v-2',
  news: 'M5 4h12a1 1 0 0 1 1 1v14.5M5 4a1 1 0 0 0-1 1v13a1.5 1.5 0 0 0 1.5 1.5H19a1.5 1.5 0 0 0 1.5-1.5V8.5H18M8 8.5h6M8 12h6M8 15.5h3.5',
  save: 'M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5zM7.5 3.5v5h7v-5M7.5 20.5v-7h9v7',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  home: 'M3.5 11.5L12 4l8.5 7.5M5.5 10v10h13V10M10 20v-5h4v5',
  alert: 'M12 3.8l9.3 16.2H2.7zM12 10v4.3M12 17.2v.1',
  check: 'M4.5 12.5l5 5 10-11',
  close: 'M5.5 5.5l13 13M18.5 5.5l-13 13',
  arrow: 'M4 12h15M13 6l6 6-6 6',
  chevron: 'M9 5.5l6.5 6.5L9 18.5',
  play: 'M7 4.5l12.5 7.5L7 19.5z',
  fast: 'M4 5l8 7-8 7zM12 5l8 7-8 7z',
  cash: 'M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 12h.1M18 12h.1',
  gauge: 'M4.6 17a8.5 8.5 0 1 1 14.8 0M12 13l3.5-4M12 13h.1',
  users: 'M9 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM2.8 19.5a6.2 6.2 0 0 1 12.4 0M16 4.9a3.2 3.2 0 0 1 0 6.1M18 13.7a6.2 6.2 0 0 1 3.2 5.8',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z',
  wrench: 'M14.5 6.2a4 4 0 0 0 4.9 5.1L20.4 13 11 22.4a2.1 2.1 0 0 1-3-3l9.4-9.4-1.7-1A4 4 0 0 0 14.5 6.2z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 12h17M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z',
  trophy: 'M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5v1.2A3 3 0 0 0 7.8 10M16.5 6h3v1.2A3 3 0 0 1 16.2 10M12 14v4M8.5 20.5h7M10 18h4',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.2M12 7.8v.1',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  layers: 'M12 3.5l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  box: 'M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9zM12 12l8.5-4.5M12 12L3.5 7.5M12 12v9',
  route: 'M6 19a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM18 9.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM8.2 16.8h6.3a3 3 0 0 0 0-6H9.5a3 3 0 0 1 0-6h6.3',
  up: 'M6 14.5l6-6 6 6',
  down: 'M6 9.5l6 6 6-6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  upload: 'M12 16V4.5M7 9.5l5-5 5 5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5.5M14 11v5.5',
  help: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.4a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.3 1-1.3 2M12 16.9v.1',
};
export type IconName = keyof typeof P;
export const ICON_NAMES = Object.keys(P) as IconName[];

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

/** The game's emblem: a stylised wheel and shoulder line, used in the menu and the top bar. */
export function Emblem({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="emb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6c98c" /><stop offset="1" stopColor="#a67d36" /></linearGradient></defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#101216" stroke="#3a3f4a" />
      <path d="M5 21.5l4-7.2a2 2 0 0 1 1.7-1h6.1a2 2 0 0 1 1.5.7l3 3.7 5.7.8v3z" fill="url(#emb)" />
      <circle cx="11" cy="22.5" r="3" fill="#101216" stroke="url(#emb)" strokeWidth="1.6" />
      <circle cx="22" cy="22.5" r="3" fill="#101216" stroke="url(#emb)" strokeWidth="1.6" />
    </svg>
  );
}
