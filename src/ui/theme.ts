/** Colours the heatmap needs, as RGB triples or CSS strings. */
export interface Theme {
  zero: [number, number, number]; // neutral colour at 0
  pos: [number, number, number]; // far station wins
  neg: [number, number, number]; // near station wins
  ink: string;
  mute: string;
  grid: string;
}

const LIGHT: Theme = {
  zero: [243, 245, 246], pos: [47, 158, 115], neg: [204, 90, 65],
  ink: '#14202b', mute: '#5d6b78', grid: 'rgba(20,32,43,.20)',
};

const DARK: Theme = {
  zero: [36, 48, 58], pos: [52, 176, 126], neg: [222, 98, 74],
  ink: '#e8eef2', mute: '#92a1ad', grid: 'rgba(255,255,255,.17)',
};

const query = '(prefers-color-scheme: dark)';

/** Returns the palette matching the system colour scheme. */
export function getTheme(): Theme {
  return matchMedia(query).matches ? DARK : LIGHT;
}

/** Calls `callback` whenever the system colour scheme changes. */
export function onThemeChange(callback: () => void): void {
  matchMedia(query).addEventListener('change', callback);
}
