"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { MeetupPointMap } from "@/components/trip/MeetupPointMap";

export type MapPoint = { id: string; name: string; lat: number; lng: number };

// The meetup map on a trip page. With a Mapbox token it is a real map with one pin per point; without one
// (or if the map can't load) it falls back to a flat illustration.
// It never asks the browser for the person's location: pins are fixed points, not "near you".
// NOTE: this can only be exercised with a real token, so it has not been run yet.
export function MeetupMap({ points, height = 220, fallbackName }: { points: MapPoint[]; height?: number; fallbackName: string }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const pointsKey = usable.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");

  useEffect(() => {
    if (!token || usable.length === 0 || !container.current) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;

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
          const pin = document.createElement("div");
          pin.setAttribute("role", "img");
          pin.setAttribute("aria-label", p.name);
          stylePin(pin);
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
    };
    // usable is derived from points; pointsKey changes exactly when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pointsKey]);

  if (!token || usable.length === 0 || failed) {
    return (
      <div data-testid="meetup-map" data-kind="illustration">
        <MeetupPointMap name={usable[0]?.name ?? fallbackName} />
      </div>
    );
  }
  return (
    <div
      ref={container}
      data-testid="meetup-map"
      data-kind="mapbox"
      role="region"
      aria-label="Map of the meetup point"
      style={{ height }}
      className="overflow-hidden rounded-xl border border-line"
    />
  );
}

// A pin is a dot in the design tokens' green with a surface ring.
function stylePin(el: HTMLElement) {
  el.style.cssText = [
    "width:28px", "height:28px", "border-radius:50%", "background-color:var(--green)",
    "box-shadow:0 0 0 3px var(--surface)",
  ].join(";");
}
