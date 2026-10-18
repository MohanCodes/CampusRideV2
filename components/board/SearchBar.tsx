import Link from "next/link";
import { Icon } from "@/components/icons";
import { filtersToQuery, type BoardFilters } from "@/lib/data/filters";

// One search box above the list. A plain GET form: the search lives in the address bar, so a search can be shared.
export function SearchBar({ filters }: { filters: BoardFilters }) {
  return (
    <form method="get" action="/" role="search" aria-label="Search the board" className="flex flex-wrap items-center gap-3">
      {filters.tab !== "rides" && <input type="hidden" name="tab" value={filters.tab} />}
      {filters.chip !== "All" && <input type="hidden" name="chip" value={filters.chip} />}
      <div className="relative min-w-0 flex-1 basis-[260px]">
        <label htmlFor="board-q" className="sr-only">Search</label>
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id="board-q" name="q" type="search" defaultValue={filters.q} placeholder="Search by place, meetup point, or name" className="field !pl-10" maxLength={80} />
      </div>
      <button type="submit" className="btn-secondary">Search</button>
      {filters.q && (
        <Link href={`/${filtersToQuery(filters, { q: "" })}`} className="link min-h-[44px] content-center text-sm">Clear search</Link>
      )}
    </form>
  );
}
