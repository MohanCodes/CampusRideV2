"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Pick a meetup point's spot by clicking a map (OpenStreetMap through Leaflet, no account or token). Admin only: the map riders
// see stays on Mapbox. The latitude and longitude boxes next to it stay the source of truth, so keyboard users can type
// the numbers or press "Use the center of the map".
const CLAREMONT = { lat: 34.106, lng: -117.709 };
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const fmt = (n: number) => n.toFixed(6);

export function LocationPicker({ lat, lng, onPick }: { lat: string; lng: string; onPick: (lat: string, lng: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Start the map once.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !container.current) return;
        leaflet.current = L;
        const la = num(lat), ln = num(lng);
        const start = valid(la, ln) ? { lat: la, lng: ln } : CLAREMONT;
        const m = L.map(container.current, { center: [start.lat, start.lng], zoom: 17, scrollWheelZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        const icon = L.divIcon({ className: "leaflet-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 14] });
        if (valid(la, ln)) marker.current = L.marker([la, ln], { icon, keyboard: false }).addTo(m);
        m.on("click", (e) => {
          if (!marker.current) marker.current = L.marker(e.latlng, { icon, keyboard: false }).addTo(m);
          else marker.current.setLatLng(e.latlng);
          onPickRef.current(fmt(e.latlng.lat), fmt(e.latlng.lng));
        });
        map.current = m;
        // The map may start inside a closed <details>; it has no size until it opens.
        observer = new ResizeObserver(() => m.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map starts once; later changes are handled below
  }, []);

  // Typing the numbers moves the pin.
  useEffect(() => {
    const m = map.current, L = leaflet.current;
    if (!ready || !m || !L) return;
    const la = num(lat), ln = num(lng);
    if (!valid(la, ln)) return;
    const icon = L.divIcon({ className: "leaflet-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 14] });
    if (!marker.current) marker.current = L.marker([la, ln], { icon, keyboard: false }).addTo(m);
    else marker.current.setLatLng([la, ln]);
    if (!m.getBounds().contains([la, ln])) m.panTo([la, ln]);
  }, [lat, lng, ready]);

  const useCenter = () => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    onPick(fmt(c.lat), fmt(c.lng));
  };

  if (failed) return <p className="text-sm text-muted sm:col-span-2">The map couldn&apos;t load. Type the latitude and longitude instead.</p>;

  return (
    <div className="sm:col-span-2">
      <div
        ref={container}
        role="group"
        aria-label="Map. Click to set the location, or use the boxes below."
        data-testid="location-picker"
        className="h-[280px] w-full overflow-hidden rounded-xl border border-line"
        style={{ isolation: "isolate" }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Click the exact spot where the driver should stop. Zoom in with the + button.</p>
        <button type="button" className="btn-secondary" onClick={useCenter} disabled={!ready}>Use the center of the map</button>
      </div>
    </div>
  );
}
