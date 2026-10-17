"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="tabular ml-1 inline-grid min-w-[18px] place-items-center rounded-full bg-ink px-[5px] text-[0.6875rem] font-bold leading-[18px] text-on-ink" data-testid="nav-badge">
      <span aria-hidden="true">{n}</span>
      <span className="sr-only">{n} waiting</span>
    </span>
  );
}

const isCurrent = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

// Links in the header on larger screens.
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={isCurrent(pathname, n.href) ? "page" : undefined}
          className={`hidden min-h-[44px] content-center text-sm md:inline-grid ${isCurrent(pathname, n.href) ? "font-bold underline decoration-green decoration-2 underline-offset-8" : ""}`}
        >
          {n.label}
          <Badge n={n.badge} />
        </Link>
      ))}
    </>
  );
}

// A bar along the bottom on phones. Every item has a word as well as an icon.
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
      <ul className="mx-auto flex max-w-[480px]">
        {items.map((n) => {
          const current = isCurrent(pathname, n.href);
          return (
            <li key={n.href} className="flex-1">
              <Link
                href={n.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs ${current ? "font-bold text-green" : "text-muted"}`}
              >
                <span className="inline-flex items-center">
                  <Icon name={n.icon} size={22} />
                  <Badge n={n.badge} />
                </span>
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
