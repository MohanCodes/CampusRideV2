"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { MeetupPointMap } from "@/components/trip/MeetupPointMap";

export type MapPoint = { id: string; name: string; lat: number; lng: number };

// The meetup map. With a Mapbox token it is a real map with one pin per approved point; without one
// (or if the map can't load) it falls back to a flat illustration, and the list beside it still works.
// It never asks the browser for the person's location: pins are fixed points, not "near you".
// NOTE: this can only be exercised with a real token, so it has not been run yet.
export function MeetupMap({
  points,
  selectedId,
  onSelect,
  height = 220,
  fallbackName,
}: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  fallbackName: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const selected = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const pointsKey = usable.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selected.current = selectedId;
    markers.current.forEach((el, id) => stylePin(el, id === selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (!token || usable.length === 0 || !container.current) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    const pins = markers.current;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        map = new mapboxgl.Map({
          container: container.current,
          style: dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
          center: [usable[0].lng, usable[0].lat],
          zoom: 15,
          cooperativeGestures: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (e) => {
          const status = (e as unknown as { error?: { status?: number } }).error?.status;
          if (status === 401 || status === 403) setFailed(true); // bad or restricted token
        });

        for (const p of usable) {
          const pin = document.createElement("button");
          pin.type = "button";
          pin.setAttribute("aria-label", p.name);
          pin.addEventListener("click", () => onSelectRef.current?.(p.id));
          stylePin(pin, p.id === selected.current);
          pins.set(p.id, pin);
          new mapboxgl.Marker({ element: pin }).setLngLat([p.lng, p.lat]).addTo(map);
        }
        if (usable.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          for (const p of usable) bounds.extend([p.lng, p.lat]);
          map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
        }
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      pins.clear();
    };
    // usable is derived from points; pointsKey changes exactly when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pointsKey]);

  if (!token || usable.length === 0 || failed) {
    return (
      <div data-testid="meetup-map" data-kind="illustration">
        <MeetupPointMap name={fallbackName} />
      </div>
    );
  }
  return (
    <div
      ref={container}
      data-testid="meetup-map"
      data-kind="mapbox"
      role="region"
      aria-label="Map of approved meetup points"
      style={{ height }}
      className="overflow-hidden rounded-xl border border-line"
    />
  );
}

// A pin is a 44 px tap target with a smaller dot inside. Colors come from the design tokens.
function stylePin(el: HTMLButtonElement, selected: boolean) {
  const size = selected ? 44 : 40;
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, "padding:11px", "border:0", "border-radius:50%",
    "background-clip:content-box", "cursor:pointer",
    `background-color:var(${selected ? "--green" : "--ink"})`,
    "box-shadow:inset 0 0 0 3px var(--surface)",
  ].join(";");
  el.setAttribute("aria-pressed", String(selected));
}
