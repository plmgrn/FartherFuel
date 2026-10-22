import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import { savings, savingsPct } from './model/savings';
import { createStore, initialState, type AppState } from './state';
import { mountControls } from './ui/controls';
import { createContourMap } from './ui/contourmap';
import { eur } from './ui/format';
import { mountReadout } from './ui/readout';

const store = createStore<AppState>(initialState);
const map = createContourMap(document.getElementById('map') as HTMLCanvasElement);

/** Value shown by the map at a point, in the current view mode. */
const valueAt = (s: AppState, volume: number, distFar: number): number => {
  const q = { ...s.params, volume, distFar };
  return s.mode === 'eur' ? savings(q) : savingsPct(q);
};

/** Redraws the map and its caption from the state. */
function renderMap(s: AppState): void {
  map.render({
    xMax: s.params.tank,
    yMax: s.mapMaxDist,
    xLabel: 'Fuel bought (L)',
    yLabel: 'Extra distance (km)',
    value: (x, y) => valueAt(s, x, y),
    marker: { x: s.params.volume, y: s.params.distFar },
  });

  const unit = s.mode === 'eur' ? 'EUR' : '% of the nearer station’s cost';
  document.getElementById('caption')!.textContent =
    `Savings from the farther station, in ${unit}. Positive means the farther station is cheaper. ` +
    'The heavy line is break-even. Click or drag to choose a point.';
}

mountControls(store);
mountReadout(store);
store.subscribe(renderMap);
renderMap(store.get());

// clicking or dragging on the map selects volume and extra distance
map.onPick(({ x, y }) =>
  store.set({ params: { ...store.get().params, volume: x, distFar: y } }),
);

// hover shows the value under the cursor without changing the selection
map.onHover((pt) => {
  const s = store.get();
  const text = pt
    ? `${pt.x.toFixed(1)} L, ${pt.y.toFixed(1)} km: ` +
      (s.mode === 'eur' ? eur(valueAt(s, pt.x, pt.y)) : `${valueAt(s, pt.x, pt.y).toFixed(2)} %`)
    : '';
  document.getElementById('hover')!.textContent = text;
});
