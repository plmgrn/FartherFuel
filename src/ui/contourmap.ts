import { onThemeChange, readTheme, type Theme } from './theme';

/** Everything the map needs to draw; it knows nothing about fuel. */
export interface MapSpec {
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  value: (x: number, y: number) => number; // field to draw contours of
  marker: { x: number; y: number }; // selected point
}

/** Point in data coordinates. */
export interface Point {
  x: number;
  y: number;
}

export interface ContourMap {
  /** Draws the map for the given spec. */
  render(spec: MapSpec): void;
  /** Called when the user clicks, drags or uses arrow keys. */
  onPick(callback: (point: Point) => void): void;
  /** Called on hover with the point under the cursor, or null outside. */
  onHover(callback: (point: Point | null) => void): void;
}

const MARGIN = { left: 48, right: 14, top: 12, bottom: 40 };
const GRID = { cols: 96, rows: 64 }; // sample cells of the field
const LEVELS_PER_SIDE = 4; // roughly how many contour lines each side of zero

/** A line segment in plot pixels: x1, y1, x2, y2. */
type Segment = [number, number, number, number];

/** Rounds a step to 1, 2 or 5 times a power of ten. */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/** Round tick values from 0 to max. */
function niceTicks(max: number): number[] {
  const step = niceStep(max / 6);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/**
 * Samples the field on a (cols + 1) x (rows + 1) grid of points.
 * Row 0 is the top of the map (y = yMax).
 * @returns the samples and the largest absolute value
 */
function sample(spec: MapSpec): { nodes: Float32Array; scale: number } {
  const { cols, rows } = GRID;
  const nodes = new Float32Array((cols + 1) * (rows + 1));
  let scale = 1e-9;

  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const v = spec.value((i / cols) * spec.xMax, (1 - j / rows) * spec.yMax);
      nodes[j * (cols + 1) + i] = v;
      scale = Math.max(scale, Math.abs(v));
    }
  }
  return { nodes, scale };
}

/**
 * Finds the line where the field equals `level` (marching squares).
 * @returns segments in pixels relative to the plot area
 */
function contourSegments(nodes: Float32Array, level: number, w: number, h: number): Segment[] {
  const { cols, rows } = GRID;
  const stride = cols + 1;
  const segments: Segment[] = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // corners clockwise from top-left, in grid units
      const cx = [i, i + 1, i + 1, i];
      const cy = [j, j, j + 1, j + 1];
      const v = [
        nodes[j * stride + i],
        nodes[j * stride + i + 1],
        nodes[(j + 1) * stride + i + 1],
        nodes[(j + 1) * stride + i],
      ];

      // each edge joins corner k to k+1; keep the crossing if the level lies between
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 4; k++) {
        const a = k;
        const b = (k + 1) % 4;
        if (v[a] >= level !== v[b] >= level) {
          const t = (level - v[a]) / (v[b] - v[a]);
          pts.push([
            ((cx[a] + (cx[b] - cx[a]) * t) / cols) * w,
            ((cy[a] + (cy[b] - cy[a]) * t) / rows) * h,
          ]);
        }
      }

      // two crossings make one segment, four (a saddle) make two
      if (pts.length === 2) segments.push([...pts[0], ...pts[1]]);
      if (pts.length === 4) {
        segments.push([...pts[0], ...pts[3]]);
        segments.push([...pts[1], ...pts[2]]);
      }
    }
  }
  return segments;
}

/**
 * Creates a contour map on a canvas. Redraws itself on resize and on a
 * colour scheme change.
 */
export function createContourMap(canvas: HTMLCanvasElement): ContourMap {
  const ctx = canvas.getContext('2d')!;
  let spec: MapSpec | null = null;
  let plot = { x: 0, y: 0, w: 1, h: 1 }; // plot area in CSS pixels
  let pickCb: (p: Point) => void = () => {};
  let hoverCb: (p: Point | null) => void = () => {};
  let dragging = false;

  /** Writes text with a background coloured outline, so lines do not cut it. */
  function haloText(text: string, x: number, y: number, th: Theme, color: string): void {
    ctx.lineWidth = 4;
    ctx.strokeStyle = th.bg;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** Draws the whole chart for the current spec. */
  function draw(): void {
    if (!spec) return;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;

    // match the backing store to the screen density
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const th = readTheme(canvas);
    plot = {
      x: MARGIN.left,
      y: MARGIN.top,
      w: W - MARGIN.left - MARGIN.right,
      h: H - MARGIN.top - MARGIN.bottom,
    };
    const X = (x: number) => plot.x + (x / spec!.xMax) * plot.w;
    const Y = (y: number) => plot.y + (1 - y / spec!.yMax) * plot.h;

    ctx.font = th.font;
    ctx.lineWidth = 1;

    // gridlines and tick labels
    ctx.strokeStyle = th.rule;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of niceTicks(spec.xMax)) {
      const x = Math.round(X(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
      ctx.fillText(String(t), x, plot.y + plot.h + 5);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of niceTicks(spec.yMax)) {
      const y = Math.round(Y(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
      ctx.fillText(String(t), plot.x - 6, y);
    }

    // frame and axis titles
    ctx.strokeStyle = th.ink;
    ctx.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.w, plot.h);
    ctx.fillStyle = th.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(spec.xLabel, plot.x + plot.w / 2, H - 2);
    ctx.save();
    ctx.translate(12, plot.y + plot.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText(spec.yLabel, 0, -4);
    ctx.restore();

    // contour lines at round values, zero (break-even) drawn heavier
    const { nodes, scale } = sample(spec);
    const step = niceStep(scale / LEVELS_PER_SIDE);
    const top = Math.floor(scale / step);
    const labels: Array<{ text: string; x: number; y: number; zero: boolean }> = [];

    for (let k = -top; k <= top; k++) {
      const level = k * step;
      const segments = contourSegments(nodes, level, plot.w, plot.h);

      ctx.strokeStyle = k === 0 ? th.ink : th.contour;
      ctx.lineWidth = k === 0 ? 2 : 1;
      ctx.beginPath();
      for (const s of segments) {
        ctx.moveTo(plot.x + s[0], plot.y + s[1]);
        ctx.lineTo(plot.x + s[2], plot.y + s[3]);
      }
      ctx.stroke();

      // label on the segment closest to a target column, alternating sides
      const targetX = (Math.abs(k) % 2 === 0 ? 0.85 : 0.15) * plot.w;
      let best: Segment | null = null;
      for (const s of segments) {
        const mx = (s[0] + s[2]) / 2;
        const my = (s[1] + s[3]) / 2;
        const inside = mx > 14 && mx < plot.w - 14 && my > 8 && my < plot.h - 8;
        if (inside && (!best || Math.abs(mx - targetX) < Math.abs((best[0] + best[2]) / 2 - targetX))) {
          best = s;
        }
      }
      if (best) {
        const text = (k > 0 ? '+' : '') + Number(level.toPrecision(6));
        labels.push({ text, x: plot.x + (best[0] + best[2]) / 2, y: plot.y + (best[1] + best[3]) / 2, zero: k === 0 });
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of labels) haloText(l.text, l.x, l.y, th, l.zero ? th.ink : th.muted);

    // selection marker with dotted guides
    const mx = X(spec.marker.x);
    const my = Y(spec.marker.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = th.muted;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, plot.y);
    ctx.lineTo(mx, plot.y + plot.h);
    ctx.moveTo(plot.x, my);
    ctx.lineTo(plot.x + plot.w, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = th.ink;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = th.bg;
    ctx.stroke();
  }

  /** Converts a pointer event to data coordinates, clamped to the plot. */
  function toData(e: PointerEvent): Point & { inside: boolean } {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const fx = Math.max(0, Math.min(1, (px - plot.x) / plot.w));
    const fy = Math.max(0, Math.min(1, (py - plot.y) / plot.h));
    return {
      x: fx * spec!.xMax,
      y: (1 - fy) * spec!.yMax,
      inside: px >= plot.x && px <= plot.x + plot.w && py >= plot.y && py <= plot.y + plot.h,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!spec || !toData(e).inside) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    pickCb(toData(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!spec) return;
    const p = toData(e);
    if (dragging) pickCb(p);
    else hoverCb(p.inside ? p : null);
  });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointercancel', () => (dragging = false));
  canvas.addEventListener('pointerleave', () => hoverCb(null));

  // arrow keys nudge the marker by 1/60 of each axis
  canvas.addEventListener('keydown', (e) => {
    if (!spec) return;
    const { x, y } = spec.marker;
    const dx = spec.xMax / 60;
    const dy = spec.yMax / 60;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: x - dx, y }, ArrowRight: { x: x + dx, y },
      ArrowUp: { x, y: y + dy }, ArrowDown: { x, y: y - dy },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    pickCb({
      x: Math.max(0, Math.min(spec.xMax, next.x)),
      y: Math.max(0, Math.min(spec.yMax, next.y)),
    });
  });

  new ResizeObserver(draw).observe(canvas);
  onThemeChange(draw);

  return {
    render(next) {
      spec = next;
      draw();
    },
    onPick: (cb) => (pickCb = cb),
    onHover: (cb) => (hoverCb = cb),
  };
}
