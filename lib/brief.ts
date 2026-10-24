/**
 * The town-meeting brief (ATLAS.md 6.3) and the developer screening report
 * (ATLAS.md 16.7).
 *
 * Two paths produce a brief:
 *   1. A language model on Amazon Bedrock, which may only use numbers handed to
 *      it by the tools in app/api/brief/route.ts.
 *   2. The deterministic composer below, which fills a translated template from
 *      the same tool results. It is the offline path, and because it is pure
 *      string assembly over measured values it cannot invent a figure.
 *
 * Both paths end with the same standing caveat.
 */

import { eo658Checklist } from "./eo658";
import { fmtInt, fmtKm, fmtUsd } from "./format";
import { COOLING_LABEL, presetFor } from "./weights";
import {
  LANGUAGES,
  STRINGS,
  fill,
  listJoin,
  type LangCode,
} from "./brief-i18n";
import type { HexRecord, ScoreResult } from "./types";

export { LANGUAGES, type LangCode };
export type Audience = "community" | "developer";

export function isLang(v: string): v is LangCode {
  return LANGUAGES.some((l) => l.code === v);
}

export interface BriefContext {
  hex: HexRecord;
  result: ScoreResult;
  alternatives: { town: string | null; score: number; distanceKm: number; reason: string }[];
  annualElectricityUsd: number | null;
}

/** Exactly five questions, each anchored to a measurement or a known gap. */
export function fiveQuestions(ctx: BriefContext, lang: LangCode = "en"): string[] {
  const t = STRINGS[lang] ?? STRINGS.en;
  const { hex, result } = ctx;
  const preset = presetFor(result.mw);
  const gridKm =
    preset.requiredKv === 345
      ? hex.d_tx345_km
      : preset.requiredKv === 115
        ? hex.d_tx115_km
        : hex.d_tx69_km;

  const q: string[] = [];

  q.push(fill(t.q.capacity, { mw: result.mw, kv: preset.requiredKv, dist: fmtKm(gridKm) }));

  q.push(
    result.mw > 25 ? t.q.cleanEnergy : fill(t.q.underThreshold, { mw: result.mw }),
  );

  q.push(
    hex.in_ej
      ? t.q.ej
      : fill(t.q.residents, { pop: fmtInt(hex.pop_1km) }),
  );

  q.push(
    result.cooling === "evaporative"
      ? t.q.waterEvap
      : fill(t.q.waterClosed, { design: COOLING_LABEL[result.cooling].toLowerCase() }),
  );

  q.push(t.q.reporting);

  return q.slice(0, 5);
}

/** Deterministic, offline, grounded brief. */
export function composeBrief(ctx: BriefContext, lang: LangCode, audience: Audience): string {
  const t = STRINGS[lang] ?? STRINGS.en;
  const { hex, result } = ctx;
  const eo = eo658Checklist(result.mw);
  const place = hex.town ? titleish(hex.town) : "";
  const out: string[] = [];

  out.push(`# ${audience === "developer" ? t.reportTitle : t.briefTitle}`);
  out.push(
    `**${place}** · ${result.mw} MW · ${COOLING_LABEL[result.cooling]} · ${
      t.lenses[result.lens]
    }`,
  );

  /* 1 — what the score means ---------------------------------------- */
  out.push(`## ${t.s1}`);

  if (result.excluded) {
    out.push(t.excludedLead);
    out.push(result.exclusionReasons.map((r) => `- ${r}`).join("\n"));
    out.push(t.hardScreenNote);
  } else {
    const rows = [
      `- **${t.score}:** ${(result.score ?? 0).toFixed(1)} / 10 — ${t.bands[result.band.key]}`,
      `- **${t.buildability}:** ${result.buildability?.toFixed(1) ?? "—"} / 10`,
      `- **${t.community}:** ${result.community?.toFixed(1) ?? "—"} / 10`,
    ];
    const scored = result.factors.filter((f) => f.value !== null);
    if (scored.length) {
      const best = scored.reduce((a, b) => ((a.value ?? 0) >= (b.value ?? 0) ? a : b));
      const worst = scored.reduce((a, b) => ((a.value ?? 0) <= (b.value ?? 0) ? a : b));
      rows.push(`- **${t.strongest}:** ${t.factors[best.key]} — ${best.raw}`);
      rows.push(`- **${t.weakest}:** ${t.factors[worst.key]} — ${worst.raw}`);
    }
    if (result.bonuses.length) {
      rows.push(
        `- **${t.bonuses}:** ${result.bonuses
          .map((b) => `${b.label} (+${b.amount.toFixed(1)})`)
          .join("; ")}`,
      );
    }
    out.push(rows.join("\n"));
  }

  const missing = result.factors.filter((f) => f.status === "unavailable");
  if (missing.length) {
    out.push(
      `**${t.unmeasured}.** ` +
        fill(t.unmeasuredBody, {
          factors: listJoin(
            missing.map((f) => t.factors[f.key]),
            lang,
          ),
          verb: missing.length === 1 ? "has" : "have",
          pronoun: missing.length === 1 ? "it is" : "they are",
          b: Math.round(result.coverage.buildabilityWeight * 100),
          c: Math.round(result.coverage.communityWeight * 100),
        }),
    );
  }

  out.push(
    `**${t.alwaysUnverified}.**\n` +
      [`- ${t.gridCapacity}`, `- ${t.zoning}`, `- ${t.availability}`].join("\n"),
  );

  /* 2 — EO 658 ------------------------------------------------------- */
  out.push(`## ${t.s2}`);
  out.push(eo.summary);
  if (eo.items.length) {
    out.push(eo.items.map((i) => `- **${i.section} — ${i.title}.** ${i.detail}`).join("\n"));
  }
  out.push(`_${eo.disclaimer}_`);

  /* 3 — questions ---------------------------------------------------- */
  out.push(`## ${t.s3}`);
  out.push(
    fiveQuestions(ctx, lang)
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n"),
  );

  /* developer extras ------------------------------------------------- */
  if (audience === "developer") {
    out.push(`## ${t.nextSteps}`);
    out.push(t.steps.map((s) => `- ${s}`).join("\n"));
    if (ctx.annualElectricityUsd !== null) {
      out.push(fill(t.modelledSpend, { usd: fmtUsd(ctx.annualElectricityUsd) }));
    }
  }

  /* alternatives ----------------------------------------------------- */
  if (ctx.alternatives.length) {
    out.push(`## ${t.alternatives}`);
    out.push(
      ctx.alternatives
        .map(
          (a) =>
            `- **${titleish(a.town ?? "")}** — ${a.score.toFixed(1)} / 10, ${a.distanceKm.toFixed(
              1,
            )} km. ${a.reason}.`,
        )
        .join("\n"),
    );
  }

  out.push(`---\n_${t.measurementNote}_\n\n_${t.templateNote}_`);
  return out.join("\n\n");
}

function titleish(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** System prompt for the Bedrock path. */
export function systemPrompt(lang: LangCode, audience: Audience): string {
  const language = LANGUAGES.find((l) => l.code === lang)?.label ?? "English";
  return [
    "You write screening briefs for Atlas, a Massachusetts data centre siting tool.",
    `Write entirely in ${language}.`,
    audience === "developer"
      ? "Your reader is a developer or utility planner doing early screening."
      : "Your reader is a resident or a select board member preparing for a town meeting. Write at a 6th to 8th grade reading level.",
    "",
    "Hard rules:",
    "1. Every number, place name, distance, score and legal requirement must come from a tool result. If a tool did not give you a figure, say that it is not available. Never estimate, round up, or fill a gap from your own knowledge.",
    "2. Use exactly three sections, in this order: what the score means; what Executive Order 658 requires at this size; questions to ask the developer.",
    "3. The questions section contains exactly five numbered questions.",
    "4. Name the Atlas factors you rely on, for example grid access or environmental justice.",
    "5. Say plainly what is not measured. Grid capacity, zoning and land availability are always unverified. Report any factor the tool marks unavailable, and give the measured share of each lens.",
    "6. Never describe a low score as proof that a community will oppose a project, and never describe a high score as approval. The bands are model labels.",
    "7. Never call a location available or for sale. A cell is a geographic screening unit, not a parcel.",
    "8. Treat Executive Order 658 as informational, not legal advice.",
    "9. Plain markdown only: headings, short paragraphs, lists. No tables, no emoji, no preamble about being an AI.",
  ].join("\n");
}
