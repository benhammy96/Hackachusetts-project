/**
 * POST /api/brief — streams a screening brief as text/event-stream.
 *
 * Body: { h3, mw, cooling, lens, lang, audience }
 *
 * The agent may only use figures returned by three tools, all of which run
 * server-side against the same lib/score.ts and hexes.json the score card uses:
 *
 *   get_site_score         full score card for a cell
 *   get_eo658_checklist    the requirements engaged at a given size
 *   find_alternatives      higher-scoring, non-excluded cells nearby
 *
 * If Bedrock is not configured or fails, the route streams the deterministic
 * brief composed from the same tool results and tags the response offline. The
 * golden path therefore works with no network and no credentials.
 */

import { NextRequest } from "next/server";
import {
  type Audience,
  composeBrief,
  isLang,
  systemPrompt,
  type BriefContext,
  type LangCode,
} from "@/lib/brief";
import { findAlternatives } from "@/lib/alternatives";
import { defaultScenario, estimate } from "@/lib/economics";
import { eo658Checklist } from "@/lib/eo658";
import { score } from "@/lib/score";
import { getServerData } from "@/lib/server-data";
import type { Cooling, Lens } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLINGS: Cooling[] = ["evaporative", "closed_loop", "air"];
const LENSES: Lens[] = ["resident", "developer"];
const MWS = [5, 25, 100, 300];

interface Body {
  h3?: unknown;
  mw?: unknown;
  cooling?: unknown;
  lens?: unknown;
  lang?: unknown;
  audience?: unknown;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Body must be JSON");
  }

  const h3 = typeof body.h3 === "string" ? body.h3 : null;
  const mw = typeof body.mw === "number" && MWS.includes(body.mw) ? body.mw : 100;
  const cooling =
    typeof body.cooling === "string" && COOLINGS.includes(body.cooling as Cooling)
      ? (body.cooling as Cooling)
      : "evaporative";
  const lens =
    typeof body.lens === "string" && LENSES.includes(body.lens as Lens)
      ? (body.lens as Lens)
      : "resident";
  const lang: LangCode =
    typeof body.lang === "string" && isLang(body.lang) ? body.lang : "en";
  const audience: Audience = body.audience === "developer" ? "developer" : "community";

  if (!h3) return bad("h3 is required");
  if (!/^[0-9a-f]{15,16}$/i.test(h3)) return bad("h3 is not a cell id");

  const { index, assumptions } = await getServerData();
  const hex = index.get(h3);
  if (!hex) return bad("That cell is not in the Massachusetts screening grid", 404);

  /* --------------------------------------------------------------- tools */
  const result = score({ hex, mw, cooling, lens });
  const checklist = eo658Checklist(mw);
  const alternatives = findAlternatives(index, hex, { mw, cooling, lens, radiusKm: 25, k: 3 });
  const cost = estimate(defaultScenario(assumptions, mw, cooling === "evaporative"));

  const ctx: BriefContext = {
    hex,
    result,
    alternatives: alternatives.map((a) => ({
      town: a.hex.town,
      score: a.result.score ?? 0,
      distanceKm: a.distanceKm,
      reason: a.reason,
    })),
    annualElectricityUsd: cost.annualElectricityUsd,
  };

  const toolPayload = {
    get_site_score: {
      town: hex.town,
      coordinates: { lat: hex.lat, lng: hex.lng },
      mw,
      cooling,
      lens,
      excluded: result.excluded,
      exclusion_reasons: result.exclusionReasons,
      score: result.score,
      band: result.band.label,
      buildability: result.buildability,
      community: result.community,
      measured_share: {
        buildability: result.coverage.buildabilityWeight,
        community: result.coverage.communityWeight,
      },
      bonuses: result.bonuses,
      factors: result.factors.map((f) => ({
        factor: f.label,
        value: f.value,
        weight: f.weight,
        lens: f.group,
        measurement: f.raw,
        data_status: f.status,
        caveat: f.note ?? null,
      })),
      unresolved: result.unresolved.map((u) => ({
        item: u.label,
        detail: u.detail,
        severity: u.severity,
      })),
      modelled_annual_electricity_usd: Math.round(cost.annualElectricityUsd),
      modelled_annual_tco2e: Math.round(cost.annualTco2e),
      electricity_price_source: assumptions.electricity_price.source,
    },
    get_eo658_checklist: checklist,
    find_alternatives: ctx.alternatives,
  };

  const fallback = composeBrief(ctx, lang, audience);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const used = await streamFromBedrock(
          toolPayload,
          lang,
          audience,
          (chunk) => send("delta", chunk),
        );
        if (used === "bedrock") {
          send("meta", { source: "bedrock", grounded: true });
          send("done", {});
          controller.close();
          return;
        }
      } catch (e) {
        send("notice", {
          message: e instanceof Error ? e.message : "Model unavailable",
        });
      }

      // Offline path: stream the deterministic brief in small slices so the
      // panel renders progressively like the model path does.
      send("meta", { source: "offline", grounded: true });
      const words = fallback.split(/(\s+)/);
      for (let i = 0; i < words.length; i += 6) {
        send("delta", words.slice(i, i + 6).join(""));
        await new Promise((r) => setTimeout(r, 8));
      }
      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

/**
 * Calls Claude on Bedrock with the tool results already resolved and supplied
 * as context. Returns "bedrock" if it produced text, "skip" if Bedrock is not
 * configured. Throws on a configured-but-failing call so the caller can tell
 * the user why it fell back.
 */
async function streamFromBedrock(
  toolPayload: unknown,
  lang: LangCode,
  audience: Audience,
  onDelta: (text: string) => void,
): Promise<"bedrock" | "skip"> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (!modelId || !region) return "skip";

  const { BedrockRuntimeClient, ConverseStreamCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );
  const client = new BedrockRuntimeClient({ region });

  const command = new ConverseStreamCommand({
    modelId,
    system: [{ text: systemPrompt(lang, audience) }],
    messages: [
      {
        role: "user",
        content: [
          {
            text:
              "Write the brief using only the figures in the tool results below.\n\n" +
              "<tool_results>\n" +
              JSON.stringify(toolPayload, null, 1) +
              "\n</tool_results>",
          },
        ],
      },
    ],
    inferenceConfig: { maxTokens: 2200, temperature: 0.2 },
  });

  const response = await client.send(command);
  if (!response.stream) throw new Error("Bedrock returned no stream");

  let produced = false;
  for await (const event of response.stream) {
    const text = event.contentBlockDelta?.delta?.text;
    if (text) {
      produced = true;
      onDelta(text);
    }
  }
  if (!produced) throw new Error("Bedrock returned no text");
  return "bedrock";
}
