import Link from "next/link";
import { Icon } from "@/components/icons";
import { CHIPS, filtersToQuery, type BoardFilters } from "@/lib/data/filters";

// Plain links, so filtering works without JavaScript and every view has a shareable address.
export function DestinationChips({ filters }: { filters: BoardFilters }) {
  return (
    <nav aria-label="Destinations" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex gap-2">
        {CHIPS.map((chip) => {
          const selected = filters.chip === chip;
          return (
            <li key={chip}>
              <Link href={`/${filtersToQuery(filters, { chip })}`} className="chip" aria-current={selected ? "true" : undefined}>
                {selected && <Icon name="check" size={14} />}
                {chip}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
