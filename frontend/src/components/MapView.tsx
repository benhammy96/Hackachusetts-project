/**
 * Interactive map placeholder built on MapLibre GL JS.
 *
 * Owned by the frontend teammate. Clicking the map will eventually drop a
 * candidate marker and surface it to the scoring panel. For now it renders a
 * basemap and reports clicks via the onPickLocation callback.
 */

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { Coordinates } from "@/types/models";

const DEFAULT_STYLE =
  import.meta.env.VITE_MAP_STYLE_URL ??
  "https://demotiles.maplibre.org/style.json";

// Center on Massachusetts for the Hackachusetts theme.
const DEFAULT_CENTER: [number, number] = [-71.8, 42.3];
const DEFAULT_ZOOM = 6;

interface MapViewProps {
  onPickLocation?: (coords: Coordinates) => void;
}

export function MapView({ onPickLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("click", (e) => {
      onPickLocation?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onPickLocation]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Site selection map" />;
}
