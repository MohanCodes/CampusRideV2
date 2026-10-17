import Link from "next/link";
import { Icon } from "@/components/icons";
import { CAMPUS_IDS, CAMPUS_SHORT } from "@/lib/campuses";
import { filtersToQuery, hasActiveFilters, type BoardFilters } from "@/lib/data/filters";

// A plain GET form: the filters live in the address bar, so a filtered board can be shared.
export function FilterForm({ filters, idPrefix }: { filters: BoardFilters; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const dateValue = filters.date.kind === "today" || filters.date.kind === "tomorrow" ? filters.date.kind : "any";
  return (
    <form method="get" action="/" className="space-y-4" role="search" aria-label="Filter the board">
      {filters.tab !== "rides" && <input type="hidden" name="tab" value={filters.tab} />}
      {filters.chip !== "All" && <input type="hidden" name="chip" value={filters.chip} />}

      <div>
        <label htmlFor={id("q")} className="mb-1 block text-sm font-bold">
          Search
        </label>
        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id={id("q")} name="q" type="search" defaultValue={filters.q} placeholder="Place, meetup point, name" className="field !pl-10" />
        </div>
      </div>

      <div>
        <label htmlFor={id("date")} className="mb-1 block text-sm font-bold">
          Date
        </label>
        <select id={id("date")} name="date" defaultValue={dateValue} className="field">
          <option value="any">Any day</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
        </select>
        <label htmlFor={id("day")} className="mb-1 mt-3 block text-sm text-muted">
          Or pick a date
        </label>
        <input id={id("day")} name="day" type="date" defaultValue={filters.date.kind === "day" ? filters.date.key : ""} className="field" />
      </div>

      <div>
        <label htmlFor={id("college")} className="mb-1 block text-sm font-bold">
          College
        </label>
        <select id={id("college")} name="college" defaultValue={filters.campus} className="field">
          <option value="all">All colleges</option>
          {CAMPUS_IDS.map((c) => (
            <option key={c} value={c}>
              {CAMPUS_SHORT[c]}
            </option>
          ))}
        </select>
      </div>

      {filters.tab === "rides" && (
        <div>
          <label htmlFor={id("seats")} className="mb-1 block text-sm font-bold">
            Seats
          </label>
          <select id={id("seats")} name="seats" defaultValue={String(filters.minSeats)} className="field">
            <option value="1">1+ seats</option>
            <option value="2">2+ seats</option>
            <option value="3">3+ seats</option>
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        {hasActiveFilters(filters) && (
          <Link href={`/${filtersToQuery({ ...filters, chip: "All", date: { kind: "any" }, campus: "all", minSeats: 1, q: "" })}`} className="link min-h-[44px] content-center text-sm">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
