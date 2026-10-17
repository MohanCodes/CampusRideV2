import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getEmailBacklog } from "@/lib/data/admin";
import { isDemo } from "@/lib/demo";

const TABS = [
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/meetup-points", label: "Meetup points" },
  { href: "/admin/audit", label: "Audit log" },
];

// The frame around admin pages. Reaching it already required the admin role; this just adds the section title and tabs.
export async function AdminShell({ current, children }: { current: string; children: ReactNode }) {
  const backlog = await getEmailBacklog();
  return (
    <AppShell signedIn demo={isDemo()}>
      {backlog > 0 && (
        <p role="alert" className="card mt-4 p-4 text-sm" data-testid="email-backlog">
          {backlog} {backlog === 1 ? "email has" : "emails have"} been waiting more than 15 minutes. Check that the email function and its
          secrets are set up (see supabase/PENDING.md).
        </p>
      )}
      <p className="t-label mt-2 text-muted">Admin</p>
      <nav aria-label="Admin sections" className="mb-8 mt-2 border-b border-line">
        <ul className="flex flex-wrap gap-6">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={current === t.href ? "page" : undefined}
                className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-1 text-[1.0625rem] ${current === t.href ? "border-green font-bold text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </AppShell>
  );
}
