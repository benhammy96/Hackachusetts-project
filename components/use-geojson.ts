"use client";

import * as React from "react";
import type { FeatureCollection } from "geojson";

type State = {
  data: FeatureCollection | null;
  loading: boolean;
  error: string | null;
};

const cache = new Map<string, FeatureCollection>();

/**
 * Fetch a map overlay once, only when it is first switched on. Overlays are
 * large enough that loading all of them up front would slow the first paint.
 */
export function useGeoJson(url: string, enabled: boolean): State {
  const [state, setState] = React.useState<State>(() => ({
    data: cache.get(url) ?? null,
    loading: false,
    error: null,
  }));

  React.useEffect(() => {
    if (!enabled) return;
    const hit = cache.get(url);
    if (hit) {
      setState({ data: hit, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<FeatureCollection>;
      })
      .then((data) => {
        cache.set(url, data);
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (alive)
          setState({
            data: null,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
      });
    return () => {
      alive = false;
    };
  }, [url, enabled]);

  return state;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
