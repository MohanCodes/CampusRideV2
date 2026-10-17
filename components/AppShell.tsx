import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, DesktopNav, type NavItem } from "@/components/NavLinks";
import { Logo } from "@/components/Logo";
import { LegalLinks } from "@/components/LegalLinks";
import { SafetyNotice } from "@/components/SafetyNotice";
import { signOut } from "@/lib/auth/actions";
import { isAdmin } from "@/lib/auth/dal";
import { getInboxCount } from "@/lib/data/rides";
import { FEATURES } from "@/lib/features";

// The frame around every signed-in screen: header, navigation, and the safety notice in the footer.
// Navigation lists only what exists, so there are no dead links.
const NAV: NavItem[] = [
  { href: "/", label: "Board", icon: "home" as const, ready: true },
  { href: "/post", label: "Post", icon: "plus" as const, ready: FEATURES.post },
  { href: "/rides", label: "My Rides", icon: "list" as const, ready: FEATURES.myRides },
  { href: "/inbox", label: "Inbox", icon: "inbox" as const, ready: FEATURES.inbox },
  { href: "/me", label: "Profile", icon: "user" as const, ready: FEATURES.profile },
]
  .filter((n) => n.ready)
  .map(({ href, label, icon }) => ({ href, label, icon }));

export async function AppShell({
  signedIn, demo = false, hideBottomNav = false, children,
}: { signedIn: boolean; demo?: boolean; hideBottomNav?: boolean; children: ReactNode }) {
  const bottomNav = NAV.length > 1 && !hideBottomNav;
  // The Inbox badge counts seat requests waiting for an answer.
  const waiting = FEATURES.inbox && (signedIn || demo) ? await getInboxCount() : 0;
  const items = NAV.map((n) => (n.href === "/inbox" ? { ...n, badge: waiting } : n));
  // Admins also get an Admin link in the header. (The pages check the role themselves.)
  const showAdmin = FEATURES.admin && (demo || (signedIn && (await isAdmin())));
  const headerItems = showAdmin ? [...items, { href: "/admin", label: "Admin", icon: "shield" as const }] : items;
  return (
    <>
      {demo && (
        <p role="note" className="border-b border-line bg-pale px-4 py-2 text-center text-sm">
          Sample data. Nothing here is real.
        </p>
      )}
      <header>
        <div className="mx-auto flex h-[78px] max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-[25px] md:h-[92px]">
          <Logo />
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-6">
            {(NAV.length > 1 || showAdmin) && <DesktopNav items={headerItems} />}
            {signedIn ? (
              <form action={signOut}>
                <button type="submit" className="btn-secondary">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/sign-in" className="btn-secondary">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-[25px]">
        {children}
      </main>
      <footer className={`mx-auto max-w-[1180px] border-t border-line px-4 py-8 sm:px-[25px] ${bottomNav ? "pb-24 md:pb-8" : ""}`}>
        <div className="max-w-[60ch]">
          <SafetyNotice />
        </div>
        <LegalLinks className="mt-2" />
      </footer>
      {bottomNav && <BottomNav items={items} />}
    </>
  );
}
