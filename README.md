# [FartherFuel](https://plmgrn.github.io/FartherFuel)

Is the farther, cheaper fuel station worth the drive? Pick fuel volume and
extra distance on a map and see the savings. No runtime dependencies.

## Run

    npm install
    npm run dev      # dev server
    npm test         # model tests
    npm run build    # production build into dist/

Commit `package-lock.json` after the first install; the deploy workflow uses `npm ci`.

## Deploy

Repo settings, Pages, Source: GitHub Actions. Every push to `main` deploys.
The site is served at `https://<user>.github.io/FartherFuel/`.

## Model

    savings = V*(Pn - Pf) + C/100*(Dn*Pn - Df*Pf) + k*(Dn - Df)

    V  fuel bought (L)            C  consumption (L/100 km)
    Pf far price (EUR/L)          Pn near price (EUR/L)
    Df far extra km (total)       Dn near extra km (total)
    k  other cost per extra km (EUR/km)

Fuel burned on a detour is assumed to be replaced at that station's price.

## Layout

    src/model/    pure functions, no DOM (tested)
    src/data/     price sources (manual input for now)
    src/styles/   tokens.css (all colours, fonts, spacing), base.css, layout.css
    src/ui/       controls, readout, contour map, theme (reads the tokens)
    src/state.ts  tiny pub/sub store
    src/main.ts   wiring only

To change the look, edit `src/styles/tokens.css`. The canvas map reads the same tokens.

## Roadmap

1. Port of the first prototype (this scaffold)
2. Universal map: relative price gap vs detour fuel fraction
3. CSV import of real prices, savings over time
4. Compare several stations
