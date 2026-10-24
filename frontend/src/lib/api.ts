/**
 * Thin typed client for the Atlas backend API.
 *
 * In development, requests to `/api/*` are proxied to the FastAPI server
 * (see vite.config.ts). Override with VITE_API_BASE_URL for other setups.
 */

import type {
  ComparisonRequest,
  ComparisonResponse,
  ExplanationRequest,
  ExplanationResponse,
  SiteScore,
  SiteScoreRequest,
} from "@/types/models";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TRes;
}

export const api = {
  scoreSites: (req: SiteScoreRequest) =>
    post<SiteScoreRequest, SiteScore[]>("/sites/score", req),

  compareSites: (req: ComparisonRequest) =>
    post<ComparisonRequest, ComparisonResponse>("/sites/compare", req),

  explainScore: (req: ExplanationRequest) =>
    post<ExplanationRequest, ExplanationResponse>("/explanations", req),

  health: async (): Promise<{ status: string }> => {
    const res = await fetch(`${BASE_URL}/health`);
    return (await res.json()) as { status: string };
  },
};
