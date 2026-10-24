# Scoring model

`lib/weights.ts` holds the tables. `lib/score.ts` holds the formulas. Nothing
else in the app may contain a scoring constant.

## Formula

```
B = 10 * Σ(w_i · f_i) / Σ(w_i)      over Buildability factors that have data
C = 10 * Σ(w_j · f_j) / Σ(w_j)      over Community factors that have data
a = 0.35 Resident | 0.50 Balanced | 0.65 Developer

if excluded:  score = 0            // before any bonus
else:         score = min(10, B^a · C^(1-a) + bonus)
```

Every `f` is in [0, 1] where 1 is most favourable. Display one decimal.

A factor with `value === null` is excluded from the numerator **and** the
denominator. If a whole lens has no data, the other lens is used alone; if
neither does, the score is null, not zero.

## Weights

| Lens | Factor | Weight | f |
| --- | --- | --- | --- |
| Buildability | Grid access | 35 | `clamp(1 − (d_km − 1) / 14)` at the voltage the size requires |
| Buildability | Clean power proximity | 25 | `clamp(1 − d_clean_km / 30)`, +0.2 in a municipal light plant town, floored at 0.6 when MW ≤ 25 |
| Buildability | Fiber and latency | 20 | `clamp(1 − d_fiber_km / 20)`, **null unless a real fiber dataset is loaded** |
| Buildability | Land readiness | 20 | by class: industrial 1.0, commercial 0.8, other developed 0.5, open land 0.3, agriculture 0.3, forest 0.1, residential 0.0 |
| Community | Residents nearby | 30 | `clamp(1 − pop_1km / P)`, −0.3 if a school or hospital is within 500 m |
| Community | Environmental justice | 30 | in an EJ block group 0.0; within 1 mile 0.4; else `0.6 + 0.4 · clamp(d_ej_km / 8)` |
| Community | Water | 20 | `1 − water_stress`, −0.3 if a drinking water Zone II is within 1 km, −`0.3 · MW/300` if evaporative. **Null when no stress index is loaded.** |
| Community | Climate risk | 20 | min of: 0.5 in the 0.2% floodplain, 0.4 in sea level rise inundation, else 1.0 |

`P` = 8000 at 5 MW, 5000 at 25 MW, 3000 at 100 MW, 1500 at 300 MW.

### Size and voltage

| Preset | MW | Required voltage | EO 658 |
| --- | --- | --- | --- |
| Edge | 5 | ≥ 69 kV | no |
| Enterprise | 25 | ≥ 69 kV | no (threshold is *above* 25 MW) |
| Campus | 100 | ≥ 115 kV | yes |
| Hyperscale | 300 | ≥ 345 kV | yes |

The voltage thresholds are an Atlas modelling assumption, not an engineering
rule. The UI must say so.

## Hard exclusions (score exactly 0, labelled Fatal flaw with the reason)

1. Permanently protected open space (protection level P) or Article 97 land
2. MassDEP mapped wetland, or open water
3. FEMA 1% annual chance (100-year) floodplain
4. Drinking water Zone I or Zone A

## Bonuses (total capped at +1.0, never applied to an excluded site)

- +0.5 industrial land, or a previously developed site with a recorded Activity
  and Use Limitation
- +0.3 closed-loop or air cooling
- +0.2 waste heat reuse plausible (developed share within 1 km ≥ 0.35)

## Bands

| Score | Label |
| --- | --- |
| 8.0–10 | Strong site |
| 6.0–7.9 | Workable with conditions |
| 4.0–5.9 | Contested: expect a fight |
| 0.0–3.9 | Do not build here |
| 0 + excluded | Fatal flaw |

## Invariants — property-tested, do not break

- Score is in [0, 10] or null; every factor value is in [0, 1] or null.
- Any exclusion gives exactly 0, with no bonus.
- Moving a site into an EJ block group never raises the score.
- Raising MW never raises the grid factor or the residents factor.
- Switching evaporative → closed loop never lowers the score.
- Setting a hazard flag never raises the score; more residents never raises it.
- Missing data never scores worse than the worst real value for that factor.
- The unresolved list always names grid capacity, zoning and availability.

## Deliberate deviations from ATLAS.md

Both follow section 16.4's rule to model unknowns transparently instead of
awarding automatic favourable scores.

1. **Fiber.** ATLAS.md 5.3 derived `d_fiber_km` from interstate highway
   centrelines. Section 16.4 then forbids that. The pipeline publishes
   `d_highway_km` separately, labelled road access, and the fiber factor is
   `unavailable`.
2. **Water.** No WRC stressed-basin or WRI Aqueduct index is joined, so
   `water_stress` is null and the factor is dropped. An earlier build used
   "outside a surface water supply watershed → 1.0" as a proxy base; that turned
   an unmeasured variable into a favourable score and was removed. The verified
   water evidence (Zone II distance, supply-watershed membership, modelled draw)
   is shown as evidence instead, and Zone I / Zone A still drive hard
   exclusions.

Calibration tests assert verified layer classifications and invariant
behaviour. They must not be tuned until three chosen sites produce a
predetermined number (ATLAS.md 16.10.2).
