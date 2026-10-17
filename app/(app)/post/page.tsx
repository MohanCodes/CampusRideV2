import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { FEATURES } from "@/lib/features";

export const metadata = { title: "Post — CampusRide" };

// The chooser: offer a ride, or ask for one.
export default async function PostChooser() {
  const demo = isDemo();
  if (!demo) await requireOnboarded("/post");
  const signedIn = Boolean(await getUser());

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <h1 className="t-h1 mb-6 mt-4 text-[2.4rem] md:text-[3rem]">Post</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/post/offer" className="card stretched-parent relative block p-6 transition-colors hover:border-green" data-testid="choose-offer">
          <Icon name="car" size={28} />
          <h2 className="t-h2 mt-4">
            <span className="stretched">Offer a ride</span>
          </h2>
          <p className="mt-2 text-muted">You&apos;re already driving somewhere. Share the empty seats.</p>
        </Link>
        {FEATURES.inSearchOf ? (
          <Link href="/post/ask" className="card relative block p-6 transition-colors hover:border-green" data-testid="choose-ask">
            <Icon name="users" size={28} />
            <h2 className="t-h2 mt-4">
              <span className="stretched">Ask for a ride</span>
            </h2>
            <p className="mt-2 text-muted">Tell drivers where you need to go and when.</p>
          </Link>
        ) : (
          <div className="card p-6 opacity-70" data-testid="choose-ask-disabled">
            <Icon name="users" size={28} />
            <h2 className="t-h2 mt-4">Ask for a ride</h2>
            <p className="mt-2 text-muted">Asking for a ride isn&apos;t open yet.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
