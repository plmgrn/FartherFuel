import { getTheme, onThemeChange, type Theme } from './theme';

/** Everything the heatmap needs to draw; it knows nothing about fuel. */
export interface HeatmapSpec {
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  value: (x: number, y: number) => number; // colour field
  breakeven: (x: number) => number; // y of the zero line at x
  marker: { x: number; y: number }; // selected point
}

/** Point in data coordinates. */
export interface Point {
  x: number;
  y: number;
}

export interface Heatmap {
  /** Draws the map and returns the largest absolute value in the field. */
  render(spec: HeatmapSpec): number;
  /** Called when the user clicks, drags or uses arrow keys. */
  onPick(callback: (point: Point) => void): void;
  /** Called on hover with the point under the cursor, or null outside. */
  onHover(callback: (point: Point | null) => void): void;
}

const MARGIN = { left: 50, right: 12, top: 10, bottom: 42 };
const RES = { nx: 160, ny: 110 }; // low-res field, smoothed when scaled up

/** Picks round tick values (1, 2 or 5 times a power of ten) from 0 to max. */
function niceTicks(max: number): number[] {
  const raw = max / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/**
 * Creates a heatmap on a canvas. Redraws itself on resize and theme change.
 */
export function createHeatmap(canvas: HTMLCanvasElement): Heatmap {
  const ctx = canvas.getContext('2d')!;
  const field = document.createElement('canvas');
  let spec: HeatmapSpec | null = null;
  let plot = { x: 0, y: 0, w: 1, h: 1 }; // plot area in CSS pixels
  let pickCb: (p: Point) => void = () => {};
  let hoverCb: (p: Point | null) => void = () => {};
  let dragging = false;

  /** Paints the colour field into the offscreen canvas, returns max |value|. */
  function paintField(s: HeatmapSpec, th: Theme): number {
    const { nx, ny } = RES;
    const values = new Float32Array(nx * ny);
    let scale = 1e-9;

    // sample the field at cell centres
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = s.value(((i + 0.5) / nx) * s.xMax, (1 - (j + 0.5) / ny) * s.yMax);
        values[j * nx + i] = v;
        scale = Math.max(scale, Math.abs(v));
      }
    }

    // blend neutral towards green or red by value / scale
    field.width = nx;
    field.height = ny;
    const fctx = field.getContext('2d')!;
    const img = fctx.createImageData(nx, ny);
    for (let n = 0; n < nx * ny; n++) {
      const t = values[n] / scale;
      const target = t >= 0 ? th.pos : th.neg;
      for (let c = 0; c < 3; c++) {
        img.data[n * 4 + c] = th.zero[c] + (target[c] - th.zero[c]) * Math.abs(t);
      }
      img.data[n * 4 + 3] = 255;
    }
    fctx.putImageData(img, 0, 0);
    return scale;
  }

  /** Draws the full chart for the current spec. */
  function draw(): number {
    if (!spec) return 0;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return 0;

    // match the backing store to the screen density
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const th = getTheme();
    plot = {
      x: MARGIN.left,
      y: MARGIN.top,
      w: W - MARGIN.left - MARGIN.right,
      h: H - MARGIN.top - MARGIN.bottom,
    };
    const X = (x: number) => plot.x + (x / spec!.xMax) * plot.w;
    const Y = (y: number) => plot.y + (1 - y / spec!.yMax) * plot.h;

    const scale = paintField(spec, th);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(field, plot.x, plot.y, plot.w, plot.h);

    // gridlines and tick labels
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = th.mute;
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
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

    // axis titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(spec.xLabel, plot.x + plot.w / 2, H - 2);
    ctx.save();
    ctx.translate(12, plot.y + plot.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText(spec.yLabel, 0, -4);
    ctx.restore();

    // break-even line and selection marker, clipped to the plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();

    const y0 = spec.breakeven(0);
    const y1 = spec.breakeven(spec.xMax);
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      ctx.strokeStyle = th.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(y0));
      ctx.lineTo(X(spec.xMax), Y(y1));
      ctx.stroke();
    }

    const mx = X(spec.marker.x);
    const my = Y(spec.marker.y);
    ctx.strokeStyle = th.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, plot.y);
    ctx.lineTo(mx, plot.y + plot.h);
    ctx.moveTo(plot.x, my);
    ctx.lineTo(plot.x + plot.w, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fillStyle = th.ink;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgb(${th.zero.join(',')})`;
    ctx.stroke();
    ctx.restore();

    return scale;
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
      return draw();
    },
    onPick: (cb) => (pickCb = cb),
    onHover: (cb) => (hoverCb = cb),
  };
}
