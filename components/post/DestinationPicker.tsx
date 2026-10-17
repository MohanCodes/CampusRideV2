"use client";

import { useEffect, useRef, useState } from "react";
import { searchOtherPlaces, type OtherSearchResult } from "@/app/(app)/post/actions";
import { Icon } from "@/components/icons";
import type { PlaceOption } from "@/lib/data/post";

export type Destination =
  | { kind: "place"; placeId: string; name: string }
  | { kind: "other"; mapboxId: string; name: string; sessionToken: string };

const INITIAL_COUNT = 6;

// Where to: a curated list first (stores, the Village, airports), then "somewhere else" from a
// Mapbox search limited to public places. Home addresses can't be chosen.
export function DestinationPicker({
  places, value, onChange, error,
}: {
  places: PlaceOption[]; value: Destination | null; onChange: (d: Destination | null) => void; error?: string;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [found, setFound] = useState<{ forQuery: string; result: OtherSearchResult } | null>(null);
  const session = useRef<string | null>(null);

  const q = query.trim();
  const needle = q.toLowerCase();
  const matches = places.filter((p) => !needle || `${p.name} ${p.chip} ${p.category}`.toLowerCase().includes(needle));
  const visible = needle || showAll ? matches : matches.slice(0, INITIAL_COUNT);

  // Type-ahead for "somewhere else", after a short pause. `searching` is derived, so it clears
  // itself the moment the answer for the current text arrives.
  useEffect(() => {
    if (q.length < 3) return;
    const id = setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      const result = await searchOtherPlaces(q, session.current);
      setFound({ forQuery: q, result });
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const searching = q.length >= 3 && found?.forQuery !== q;
  const result = found?.forQuery === q ? found.result : null;

  if (value) {
    return (
      <div>
        <p className="mb-2 text-sm font-bold">Where to</p>
        <div className="card flex items-center justify-between gap-3 p-4" data-testid="destination-selected">
          <p className="flex min-w-0 items-center gap-2">
            <Icon name="pin" size={18} />
            <span className="min-w-0">{value.name}</span>
          </p>
          <button type="button" className="btn-secondary shrink-0" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">Where to</legend>
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="field !pl-10"
          placeholder="Search stores, airports, places" aria-label="Search places" autoComplete="off"
          aria-invalid={error ? true : undefined} aria-describedby={error ? "destination-error" : "destination-help"}
        />
      </div>
      <p id="destination-help" className="mt-1 text-sm text-muted">
        Pick a store, airport, station, or other public place. Home addresses can&apos;t be chosen.
      </p>
      {error && <p id="destination-error" role="alert" className="field-error">{error}</p>}

      <ul className="mt-3 divide-y divide-line border-y border-line" aria-label="Popular places">
        {visible.map((p) => (
          <li key={p.id}>
            <button
              type="button" className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left hover:bg-pale"
              onClick={() => onChange({ kind: "place", placeId: p.id, name: p.name })}
            >
              <Icon name="pin" size={16} className="shrink-0 text-muted" />
              <span className="min-w-0">{p.name}</span>
            </button>
          </li>
        ))}
        {visible.length === 0 && !searching && <li className="py-3 text-sm text-muted">No places in the list match.</li>}
      </ul>
      {!needle && !showAll && matches.length > INITIAL_COUNT && (
        <button type="button" className="link mt-2 min-h-[44px] text-sm" onClick={() => setShowAll(true)}>
          Show all places
        </button>
      )}

      {q.length >= 3 && (
        <div className="mt-5" aria-live="polite">
          <p className="t-label mb-2 text-muted">Somewhere else</p>
          {searching && <p role="status" className="text-sm text-muted">Searching…</p>}
          {result?.ok && result.suggestions.length === 0 && <p className="text-sm text-muted">No matches. Try another name.</p>}
          {result && !result.ok && (
            <p className="text-sm text-muted">Searching other places isn&apos;t available right now. Pick one from the list.</p>
          )}
          {result?.ok && result.suggestions.length > 0 && (
            <ul className="divide-y divide-line border-y border-line">
              {result.suggestions.map((s) => (
                <li key={s.mapboxId}>
                  <button
                    type="button" className="flex min-h-[48px] w-full flex-col justify-center py-2 text-left hover:bg-pale"
                    onClick={() => onChange({ kind: "other", mapboxId: s.mapboxId, name: s.name, sessionToken: session.current ?? "" })}
                  >
                    <span>{s.name}</span>
                    {s.detail && <span className="text-sm text-muted">{s.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}
