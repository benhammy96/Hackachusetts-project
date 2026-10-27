/** English labels and questions for the deterministic brief composer. */

import type { FactorKey, Lens } from "./types";

export const LANGUAGES = [
  { code: "en", label: "English", endonym: "English" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export type BandKey = "strong" | "workable" | "contested" | "avoid" | "fatal";

export interface Strings {
  briefTitle: string;
  reportTitle: string;
  s1: string;
  s2: string;
  s3: string;
  nextSteps: string;
  alternatives: string;

  score: string;
  buildability: string;
  community: string;
  strongest: string;
  weakest: string;
  bonuses: string;

  excludedLead: string;
  hardScreenNote: string;

  unmeasured: string;
  unmeasuredBody: string;
  measurementNote: string;

  alwaysUnverified: string;
  gridCapacity: string;
  zoning: string;
  availability: string;

  modelledSpend: string;
  templateNote: string;

  bands: Record<BandKey, string>;
  factors: Record<FactorKey, string>;
  lenses: Record<Lens, string>;

  q: {
    capacity: string;
    cleanEnergy: string;
    underThreshold: string;
    ej: string;
    residents: string;
    waterEvap: string;
    waterClosed: string;
    reporting: string;
  };

  steps: string[];
}

const EN: Strings = {
  briefTitle: "Town-meeting brief",
  reportTitle: "Developer screening report",
  s1: "What the score means",
  s2: "What Executive Order 658 requires at this size",
  s3: "Questions to ask the developer",
  nextSteps: "Next due-diligence steps",
  alternatives: "Higher-scoring cells within 25 km",

  score: "Screening score",
  buildability: "Buildability",
  community: "Community",
  strongest: "Strongest factor",
  weakest: "Weakest factor",
  bonuses: "Bonuses applied",

  excludedLead: "Atlas screens this location as a fatal flaw, scoring 0 out of 10.",
  hardScreenNote:
    "A hard screen returns zero before any bonus is applied. This is a preliminary screen from published map layers, not a legal determination for a specific parcel.",

  unmeasured: "Not everything is measured",
  unmeasuredBody:
    "{factors} {verb} no data in this build, so {pronoun} dropped from the score rather than guessed. {b}% of the buildability weight and {c}% of the community weight is actually measured.",
  measurementNote:
    "Measured values are quoted in the words and units of the dataset that published them.",

  alwaysUnverified: "Three things this screen can never tell you",
  gridCapacity:
    "Grid capacity is unverified. Atlas knows the distance to the nearest mapped line, which is not available capacity and not an interconnection study.",
  zoning: "Zoning is unknown. No municipal district or special-permit status is loaded.",
  availability:
    "Availability is unknown. This is a geographic screening cell, not a parcel, and nothing here says any land is for sale.",

  modelledSpend: "Modelled annual electricity spend at this size is {usd}.",
  templateNote:
    "Written offline from measured values using a fixed template, with no language model involved.",

  bands: {
    strong: "Strong site",
    workable: "Workable with conditions",
    contested: "Contested site",
    avoid: "Do not build here",
    fatal: "Fatal flaw",
  },
  factors: {
    grid_access: "Grid access",
    clean_power: "Clean power proximity",
    fiber: "Fiber and latency",
    land_readiness: "Land readiness",
    residents: "Residents nearby",
    environmental_justice: "Environmental justice",
    water: "Water",
    climate_risk: "Climate risk",
  },
  lenses: { resident: "Resident", balanced: "Balanced", developer: "Developer" },

  q: {
    capacity:
      "Has the utility confirmed that {mw} MW can actually be delivered here? Atlas only knows that the nearest mapped {kv} kV or higher line is {dist} away, which says nothing about available capacity.",
    cleanEnergy:
      "Which specific new clean generation will cover this project's annual electricity use under Executive Order 658 section 5, and if you pay into the Ratepayer Protection Fund instead, what does that mean for our bills?",
    underThreshold:
      "At {mw} MW this project stays under the Executive Order 658 threshold of 25 MW. What stops it from being expanded past 25 MW later, and would that expansion trigger the order?",
    ej: "This block group is designated an environmental justice population. Who have you negotiated a community benefits agreement with, and has the state Office of Environmental Justice and Equity accepted it?",
    residents:
      "There are {pop} residents within 1 km. What noise, traffic and air modelling have you done for them, and who have you signed a community benefits agreement with?",
    waterEvap:
      "How many litres of water per day will evaporative cooling consume in a dry summer, which supply will provide it, and what happens to the discharge?",
    waterClosed:
      "You have shown a {design} design. Will that be a binding permit condition, and what energy penalty are you accepting in exchange?",
    reporting:
      "What will you publish every year once you are operating — actual energy use, water use and emissions — and will the town have the right to audit it?",
  },

  steps: [
    "Request a feasibility or system impact study from the distribution and transmission owner. Atlas cannot see hosting capacity or the interconnection queue.",
    "Confirm the zoning district, use classification and any special-permit path with the municipality.",
    "Establish ownership and whether any land is actually available. Atlas holds no parcel, owner or listing record.",
    "Order a parcel-level wetlands delineation and a FEMA flood determination. The screens here are generalised polygon intersections.",
    "Model water supply and discharge for the chosen cooling design, including a dry-year case.",
  ],
};

export const STRINGS: Record<LangCode, Strings> = { en: EN };

/** Replaces {token} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** Joins an English list with its conjunction. */
export function listJoin(items: string[], _lang: LangCode): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
