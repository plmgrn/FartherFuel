/** Values the canvas map needs, read from the CSS tokens. */
export interface Theme {
  ink: string;
  muted: string;
  rule: string;
  contour: string;
  bg: string;
  font: string; // CSS font shorthand for canvas text
}

/**
 * Reads the current design tokens, so the map always matches the stylesheets.
 * @param canvas element whose computed font is used for map text
 */
export function readTheme(canvas: Element): Theme {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string): string => root.getPropertyValue(name).trim();
  const cs = getComputedStyle(canvas);

  return {
    ink: token('--ink'),
    muted: token('--muted'),
    rule: token('--rule'),
    contour: token('--contour'),
    bg: token('--bg'),
    font: `${cs.fontSize} ${cs.fontFamily}`,
  };
}

/** Calls `callback` whenever the system colour scheme changes. */
export function onThemeChange(callback: () => void): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback);
}
