import Link from "next/link";
import { filtersToQuery, type BoardFilters } from "@/lib/data/filters";

export function BoardTabs({ filters }: { filters: BoardFilters }) {
  const tabs = [
    { id: "rides", label: "Rides" },
    { id: "requests", label: "In search of" },
  ] as const;
  return (
    <nav aria-label="Board sections" className="border-b border-line">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const current = filters.tab === t.id;
          return (
            <li key={t.id}>
              <Link
                href={`/${filtersToQuery(filters, { tab: t.id })}`}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-1 text-[1.0625rem] ${
                  current ? "border-green font-bold text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
