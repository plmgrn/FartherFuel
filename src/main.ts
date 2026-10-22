import './style.css';
import { breakevenDistance, savings, savingsPct } from './model/savings';
import { createStore, initialState, type AppState } from './state';
import { mountControls } from './ui/controls';
import { eur } from './ui/format';
import { createHeatmap } from './ui/heatmap';
import { mountReadout } from './ui/readout';

const store = createStore<AppState>(initialState);
const heatmap = createHeatmap(document.getElementById('map') as HTMLCanvasElement);

/** Value shown by the map at a point, in the current view mode. */
const valueAt = (s: AppState, volume: number, distFar: number): number => {
  const q = { ...s.params, volume, distFar };
  return s.mode === 'eur' ? savings(q) : savingsPct(q);
};

/** Redraws the map and its legend from the state. */
function renderMap(s: AppState): void {
  const scale = heatmap.render({
    xMax: s.params.tank,
    yMax: s.mapMaxDist,
    xLabel: 'Fuel bought (L)',
    yLabel: 'Extra distance (km)',
    value: (x, y) => valueAt(s, x, y),
    breakeven: (x) => breakevenDistance({ ...s.params, volume: x }),
    marker: { x: s.params.volume, y: s.params.distFar },
  });
  const unit = s.mode === 'eur' ? 'EUR' : '%';
  document.getElementById('scale')!.textContent = `color scale up to ${scale.toFixed(2)} ${unit}`;
}

mountControls(store);
mountReadout(store);
store.subscribe(renderMap);
renderMap(store.get());

// clicking or dragging on the map selects volume and extra distance
heatmap.onPick(({ x, y }) =>
  store.set({ params: { ...store.get().params, volume: x, distFar: y } }),
);

// hover shows the value under the cursor without changing the selection
heatmap.onHover((pt) => {
  const s = store.get();
  const text = pt
    ? `${pt.x.toFixed(1)} L, ${pt.y.toFixed(1)} km: ` +
      (s.mode === 'eur' ? eur(valueAt(s, pt.x, pt.y)) : `${valueAt(s, pt.x, pt.y).toFixed(2)} %`)
    : 'Hover over the map to read values.';
  document.getElementById('hover')!.textContent = text;
});
