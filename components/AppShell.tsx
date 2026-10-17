import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { SafetyNotice } from "@/components/SafetyNotice";
import { signOut } from "@/lib/auth/actions";
import { FEATURES } from "@/lib/features";

// The frame around every signed-in screen: header, navigation, and the safety notice in the footer.
// Navigation lists only what exists, so there are no dead links.
const NAV = [
  { href: "/", label: "Board", ready: true },
  { href: "/post", label: "Post", ready: FEATURES.post },
  { href: "/rides", label: "My Rides", ready: FEATURES.myRides },
  { href: "/inbox", label: "Inbox", ready: FEATURES.inbox },
  { href: "/me", label: "Profile", ready: FEATURES.profile },
].filter((n) => n.ready);

export function AppShell({ signedIn, demo = false, children }: { signedIn: boolean; demo?: boolean; children: ReactNode }) {
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
            {NAV.length > 1 &&
              NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hidden min-h-[44px] content-center text-sm md:inline-grid">
                  {n.label}
                </Link>
              ))}
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
      <footer className="mx-auto max-w-[1180px] border-t border-line px-4 py-8 sm:px-[25px]">
        <div className="max-w-[60ch]">
          <SafetyNotice />
        </div>
      </footer>
    </>
  );
}
