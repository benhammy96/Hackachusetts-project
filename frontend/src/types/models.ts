/**
 * Shared data models mirroring the backend Pydantic schemas in
 * `backend/app/models/`. Keep these in sync when the API contract changes.
 */

export type ScoreCategory =
  | "community"
  | "energy"
  | "environmental"
  | "infrastructure"
  | "land";

/** Default category weights. Must sum to 1.0. Mirrors DEFAULT_WEIGHTS. */
export const DEFAULT_WEIGHTS: Record<ScoreCategory, number> = {
  community: 0.25,
  energy: 0.25,
  environmental: 0.2,
  infrastructure: 0.15,
  land: 0.15,
};

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface SiteCandidate {
  id: string;
  name: string;
  coordinates: Coordinates;
  notes?: string | null;
}

export interface ScoreBreakdown {
  category: ScoreCategory;
  raw_score: number;
  weight: number;
  weighted_score: number;
}

export interface SiteScore {
  site_id: string;
  overall_score: number;
  breakdown: ScoreBreakdown[];
}

export interface SiteScoreRequest {
  candidates: SiteCandidate[];
  weights?: Partial<Record<ScoreCategory, number>> | null;
}

export interface ExplanationRequest {
  site_name: string;
  score: SiteScore;
  audience?: string;
}

export interface ExplanationResponse {
  site_id: string;
  summary: string;
  details: string;
  model: string;
}

export interface ComparisonRequest {
  scores: SiteScore[];
}

export interface ComparisonResponse {
  ranked_site_ids: string[];
  best_site_id: string;
  notes?: string | null;
}
