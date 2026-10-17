import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState } from "@/components/states";
import { RequestRow } from "@/components/trip/RequestRow";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getInbox } from "@/lib/data/rides";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";

export const metadata = { title: "Inbox — CampusRide" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/inbox");
  const signedIn = Boolean(await getUser());
  const now = getNow();
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getInbox();

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <h1 className="t-h1 mb-6 mt-4 text-[2.4rem] md:text-[3rem]">Inbox</h1>
      <section aria-labelledby="seat-requests-heading">
        <h2 id="seat-requests-heading" className="t-h2 mb-3 border-b border-line pb-2">
          Seat requests
        </h2>
        {!res.ok ? (
          <ErrorState message="We couldn't load your inbox. Check your connection and try again." href="/inbox" />
        ) : res.data.length === 0 ? (
          <EmptyState title="Nothing waiting" body="When someone asks for a seat on your trip, it shows up here. We'll email you too." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {res.data.map((r) => (
              <RequestRow key={r.id} request={r} now={now} showTrip />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
