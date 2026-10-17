"use client";

import { MeetupMap } from "@/components/map/MeetupMap";
import { campusShortName } from "@/lib/campuses";
import type { MeetupOption } from "@/lib/data/post";

// Approved points only, from a map or a list. There is no way to type an address.
export function MeetupPointPicker({
  points, campusId, value, onChange, error,
}: {
  points: MeetupOption[]; campusId: string; value: string; onChange: (id: string) => void; error?: string;
}) {
  if (points.length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-bold">Meetup point</p>
        <p className="card p-4 text-muted" data-testid="no-meetup-points">
          No meetup points are available for {campusShortName(campusId)} yet. Trips need an approved point, so you can&apos;t post one
          until the team adds it.
        </p>
      </div>
    );
  }
  const own = points.filter((p) => p.campusId === campusId && !p.shared);
  const shared = points.filter((p) => p.shared);
  const groups = [
    { label: `${campusShortName(campusId)} points`, items: own },
    { label: "Shared points", items: shared },
  ].filter((g) => g.items.length > 0);

  return (
    <fieldset aria-describedby={error ? "meetup-error" : "meetup-help"}>
      <legend className="mb-2 text-sm font-bold">Meetup point</legend>
      <MeetupMap points={points} selectedId={value || null} onSelect={onChange} fallbackName="your campus" />
      <p id="meetup-help" className="mt-2 text-sm text-muted">
        Meet at an approved public spot. The exact place to stand is shared with riders after you accept them.
      </p>
      {error && <p id="meetup-error" role="alert" className="field-error">{error}</p>}
      {groups.map((g) => (
        <div key={g.label} className="mt-4">
          <p className="t-label mb-2 text-muted">{g.label}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {g.items.map((p) => (
              <li key={p.id}>
                <label className={`card flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 ${value === p.id ? "!border-green !bg-mint" : ""}`}>
                  <input type="radio" name="meetupPointRadio" value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} className="size-4 accent-[var(--green)]" />
                  <span className="min-w-0">{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
