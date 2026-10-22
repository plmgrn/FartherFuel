"""Fuel station detour savings model.

Model (savings > 0 means the farther, cheaper station wins):

    savings = V*(Pn - Pf) + C/100*(Dn*Pn - Df*Pf) + k*(Dn - Df)

    V   fuel you end up buying (L)
    C   consumption (L/100 km)
    Pf  price at far station (EUR/L)      Pn  price at near station (EUR/L)
    Df  total extra driving to far (km)   Dn  total extra driving to near (km)
    k   other cost per extra km (EUR/km): wear, time value, etc. Default 0.

Fuel burned on a detour is assumed to be replaced at that station's price.
All functions are vectorized, so any argument can be a numpy array
(for example a time series of real prices).
"""
from dataclasses import dataclass

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import TwoSlopeNorm


@dataclass(frozen=True)
class Params:
    consumption: float = 9.0    # L/100 km
    price_far: float = 1.601    # EUR/L
    price_near: float = 1.719   # EUR/L
    dist_far: float = 24.0      # km, total extra driving
    dist_near: float = 0.1      # km, total extra driving
    volume: float = 40.0        # L purchased
    tank: float = 60.0          # L
    cost_per_km: float = 0.0    # EUR/km


# ---------------------------------------------------------------- model

def savings(V, C, Pf, Pn, Df, Dn, k=0.0):
    return V * (Pn - Pf) + C / 100 * (Dn * Pn - Df * Pf) + k * (Dn - Df)


def breakeven_distance(V, C, Pf, Pn, Dn, k=0.0):
    """Largest extra distance to the far station that still saves money."""
    return (V * (Pn - Pf) + C / 100 * Dn * Pn + k * Dn) / (C / 100 * Pf + k)


def breakeven_volume(C, Pf, Pn, Df, Dn, k=0.0):
    """Smallest purchase volume at which the far station pays off.
    NaN where the far station is not cheaper (it never pays off)."""
    Pf, Pn = np.broadcast_arrays(np.asarray(Pf, float), np.asarray(Pn, float))
    diff = Pn - Pf
    num = C / 100 * (Df * Pf - Dn * Pn) + k * (Df - Dn)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(diff > 0, num / diff, np.nan)


def breakeven_price_diff(V, C, Pf, Df, Dn, Pn, k=0.0):
    """Minimum price gap (Pn - Pf, EUR/L) needed for the trip to pay off."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return (C / 100 * (Df * Pf - Dn * Pn) + k * (Df - Dn)) / V


# ---------------------------------------------------------------- data export

def export_grid(path, p=Params(), n=25):
    """Full-factorial grid of all four variables to CSV, for other tools."""
    V = np.linspace(5, p.tank, n)
    C = np.linspace(5, 14, n)
    Df = np.linspace(0, 60, n)
    dP = np.linspace(0.0, 0.25, n)      # Pn - Pf
    g = np.meshgrid(V, C, Df, dP, indexing="ij")
    V_, C_, Df_, dP_ = (a.ravel() for a in g)
    Pf_ = p.price_far * np.ones_like(V_)
    Pn_ = Pf_ + dP_
    S = savings(V_, C_, Pf_, Pn_, Df_, p.dist_near, p.cost_per_km)
    data = np.column_stack([V_, C_, Df_, Pf_, Pn_, S])
    np.savetxt(path, data, delimiter=",", comments="", fmt="%.5f",
               header="volume_L,consumption_L_100km,dist_far_km,"
                      "price_far,price_near,savings_EUR")


# ---------------------------------------------------------------- relative form
#
# Prices only enter as Pf = Pn*(1 - r), so with k = 0 the model is
# homogeneous in price. Dividing by Pn*V gives:
#
#     savings / (Pn*V) = r + fn - ff*(1 - r)
#
#     r  = (Pn - Pf) / Pn       relative price gap
#     ff = C*Df / (100*V)       detour fuel as a fraction of the purchase (far)
#     fn = C*Dn / (100*V)       same for the near station
#
# Break-even: r = (ff - fn) / (1 + ff)
# V, C, D and the price level collapse into two numbers (r, ff).

def savings_pct(V, C, Pf, Pn, Df, Dn, k=0.0):
    """Savings as % of the total cost of the near-station option."""
    cost_near = Pn * (V + C / 100 * Dn) + k * Dn
    return 100 * savings(V, C, Pf, Pn, Df, Dn, k) / cost_near


def rel_price_gap(Pf, Pn):
    return (Pn - Pf) / Pn


def detour_fuel_fraction(V, C, D):
    return C * D / (100 * V)


def breakeven_rel_gap(ff, fn=0.0):
    """Minimum relative price gap for the far station to pay off."""
    return (ff - fn) / (1 + ff)


def plot_universal(p=Params()):
    """One chart that covers every combination of V, C, D and price level."""
    r = np.linspace(0, 0.15, 300)       # relative price gap
    ff = np.linspace(0, 0.5, 300)       # detour fuel fraction
    fn = detour_fuel_fraction(p.volume, p.consumption, p.dist_near)
    R, F = np.meshgrid(r, ff)
    S = 100 * (R + fn - F * (1 - R)) / (1 + fn)

    fig, a = plt.subplots(figsize=(8, 6), constrained_layout=True)
    lim = max(abs(S.min()), abs(S.max()))
    mesh = a.pcolormesh(100 * r, 100 * ff, S, cmap="RdYlGn",
                        norm=TwoSlopeNorm(0, -lim, lim), shading="auto")
    a.contour(100 * r, 100 * ff, S, levels=[0], colors="k", linewidths=2)
    fig.colorbar(mesh, ax=a, label="Savings (% of near-station cost)")

    r0 = rel_price_gap(p.price_far, p.price_near)
    f0 = detour_fuel_fraction(p.volume, p.consumption, p.dist_far)
    a.plot(100 * r0, 100 * f0, "k*", ms=14, label="baseline")
    a.set(xlabel="Relative price gap (Pn - Pf) / Pn  (%)",
          ylabel="Detour fuel / purchased fuel  (%)",
          title="Universal break-even map (black line = break-even)")
    a.legend()
    return fig


# ---------------------------------------------------------------- plots

def plot_all(p=Params()):
    k = p.cost_per_km
    V = np.linspace(0.1, p.tank, 300)
    consumptions = [6, 7.5, 9, 10.5, 12]
    fig, ax = plt.subplots(2, 2, figsize=(13, 9), constrained_layout=True)

    # 1. Heatmap: savings over volume and distance
    D = np.linspace(0, 60, 300)
    S = savings(V[None, :], p.consumption, p.price_far, p.price_near,
                D[:, None], p.dist_near, k)
    lim = max(abs(S.min()), abs(S.max()))
    a = ax[0, 0]
    mesh = a.pcolormesh(V, D, S, cmap="RdYlGn",
                        norm=TwoSlopeNorm(0, -lim, lim), shading="auto")
    a.contour(V, D, S, levels=[0], colors="k", linewidths=2)
    a.plot(p.volume, p.dist_far, "k*", ms=14, label="baseline")
    fig.colorbar(mesh, ax=a, label="Savings (EUR)")
    a.set(xlabel="Fill volume (L)", ylabel="Extra distance to far station (km)",
          title=f"Savings map at {p.consumption} L/100 km (black line = break-even)")
    a.legend(loc="upper right")

    # 2. Savings vs volume, by consumption
    a = ax[0, 1]
    for C in consumptions:
        a.plot(V, savings(V, C, p.price_far, p.price_near,
                          p.dist_far, p.dist_near, k), lw=2, label=f"{C} L/100 km")
    a.axhline(0, color="k", ls="--")
    a.set(xlabel="Fill volume (L)", ylabel="Savings (EUR)",
          title="Savings vs fill volume")
    a.legend(); a.grid(True)

    # 3. Break-even distance vs volume, by price gap
    a = ax[1, 0]
    for dP in [0.03, 0.06, 0.09, 0.12, 0.18]:
        a.plot(V, breakeven_distance(V, p.consumption, p.price_near - dP,
                                     p.price_near, p.dist_near, k),
               lw=2, label=f"gap {dP:.2f} EUR/L")
    a.axhline(p.dist_far, color="k", ls="--", label="actual distance")
    a.set(xlabel="Fill volume (L)", ylabel="Max worthwhile distance (km)",
          title="Break-even distance vs volume, by price gap")
    a.legend(); a.grid(True)

    # 4. Break-even volume vs distance, by consumption
    a = ax[1, 1]
    Dx = np.linspace(0, 60, 300)
    for C in consumptions:
        a.plot(Dx, breakeven_volume(C, p.price_far, p.price_near,
                                    Dx, p.dist_near, k), lw=2, label=f"{C} L/100 km")
    a.axhline(p.tank, color="gray", ls=":", label="tank size")
    a.set(xlabel="Extra distance to far station (km)",
          ylabel="Minimum fill volume (L)", ylim=(0, p.tank * 1.2),
          title="Break-even volume vs distance")
    a.legend(); a.grid(True)

    fig.suptitle(f"Price far/near: {p.price_far:.3f} / {p.price_near:.3f} EUR/L")
    return fig


def print_summary(p=Params()):
    s = savings(p.volume, p.consumption, p.price_far, p.price_near,
                p.dist_far, p.dist_near, p.cost_per_km)
    d = breakeven_distance(p.volume, p.consumption, p.price_far,
                           p.price_near, p.dist_near, p.cost_per_km)
    v = breakeven_volume(p.consumption, p.price_far, p.price_near,
                         p.dist_far, p.dist_near, p.cost_per_km)
    g = breakeven_price_diff(p.volume, p.consumption, p.price_far,
                             p.dist_far, p.dist_near, p.price_near, p.cost_per_km)
    print(f"Savings at {p.volume} L:        {s:+.2f} EUR")
    print(f"Break-even distance:         {d:.1f} km (actual {p.dist_far} km)")
    print(f"Break-even volume:           {float(v):.1f} L")
    print(f"Break-even price gap:        {g:.3f} EUR/L (actual {p.price_near - p.price_far:.3f})")


if __name__ == "__main__":
    base = Params()
    print_summary(base)
    export_grid("fuel_savings_grid.csv", base)
    pct = savings_pct(base.volume, base.consumption, base.price_far,
                      base.price_near, base.dist_far, base.dist_near,
                      base.cost_per_km)
    print(f"Savings:                     {pct:+.2f} % of near-station cost")
    plot_all(base)
    plot_universal(base)
    plt.show()