/**
 * Energy, cost, carbon and water estimates (ATLAS.md 16.5).
 *
 * Every figure returned here is derived from a declared scenario. The functions
 * return the inputs alongside the outputs so the UI can never show a number
 * without its assumptions.
 */

export interface MeasuredInput {
  value: number;
  unit: string;
  label: string;
  status: "verified" | "assumption";
  source: string;
  source_url?: string;
  file_url?: string;
  period?: string;
  range?: [number, number];
  caveat?: string;
}

export interface Assumptions {
  generated_at: string;
  note: string;
  electricity_price: MeasuredInput;
  grid_carbon: MeasuredInput;
  scenario: {
    pue: MeasuredInput;
    wue: MeasuredInput;
    utilisation_hours: MeasuredInput;
    construction_usd_per_mw: MeasuredInput;
  };
}

export interface Scenario {
  itMw: number;
  pue: number;
  hours: number;
  priceUsdPerKwh: number;
  gridCarbonKgPerMwh: number;
  wueLitersPerKwh: number;
  constructionUsdPerMw: number;
}

export interface EnergyEstimate {
  annualFacilityMwh: number;
  annualElectricityUsd: number;
  annualTco2e: number;
  annualWaterLiters: number;
  annualWaterMillionGal: number;
  /** Illustrative one-off build cost, kept separate from recurring spend. */
  constructionUsd: number;
  scenario: Scenario;
}

export function estimate(s: Scenario): EnergyEstimate {
  const annualFacilityMwh = s.itMw * s.hours * s.pue;
  const annualElectricityUsd = annualFacilityMwh * 1000 * s.priceUsdPerKwh;
  const annualTco2e = (annualFacilityMwh * s.gridCarbonKgPerMwh) / 1000;
  const annualWaterLiters = annualFacilityMwh * 1000 * s.wueLitersPerKwh;
  return {
    annualFacilityMwh,
    annualElectricityUsd,
    annualTco2e,
    annualWaterLiters,
    annualWaterMillionGal: annualWaterLiters / 3_785_411.784,
    constructionUsd: s.itMw * s.constructionUsdPerMw,
    scenario: s,
  };
}

/** Low / central / high band, so a single figure is never shown alone. */
export interface Sensitivity {
  low: EnergyEstimate;
  central: EnergyEstimate;
  high: EnergyEstimate;
  pueRange: [number, number];
  priceRange: [number, number];
}

export function sensitivity(s: Scenario, a: Assumptions): Sensitivity {
  const pueRange = (a.scenario.pue.range ?? [s.pue, s.pue]) as [number, number];
  const priceSpread = 0.2;
  const priceRange: [number, number] = [
    s.priceUsdPerKwh * (1 - priceSpread),
    s.priceUsdPerKwh * (1 + priceSpread),
  ];
  return {
    low: estimate({ ...s, pue: pueRange[0], priceUsdPerKwh: priceRange[0] }),
    central: estimate(s),
    high: estimate({ ...s, pue: pueRange[1], priceUsdPerKwh: priceRange[1] }),
    pueRange,
    priceRange,
  };
}

export function defaultScenario(a: Assumptions, itMw: number, evaporative: boolean): Scenario {
  return {
    itMw,
    pue: a.scenario.pue.value,
    hours: a.scenario.utilisation_hours.value,
    priceUsdPerKwh: a.electricity_price.value,
    gridCarbonKgPerMwh: a.grid_carbon.value,
    // A closed-loop or air-cooled design has essentially no evaporative draw.
    wueLitersPerKwh: evaporative ? a.scenario.wue.value : 0.05,
    constructionUsdPerMw: a.scenario.construction_usd_per_mw.value,
  };
}

let cache: Promise<Assumptions> | null = null;

export function loadAssumptions(): Promise<Assumptions> {
  if (!cache) {
    cache = fetch("/data/assumptions.json").then((r) => {
      if (!r.ok) throw new Error(`assumptions.json: ${r.status}`);
      return r.json() as Promise<Assumptions>;
    });
  }
  return cache;
}
