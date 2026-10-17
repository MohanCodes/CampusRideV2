import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState } from "@/components/states";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { OfferCard } from "@/components/request/OfferCard";
import { RequestRow } from "@/components/trip/RequestRow";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getChatThreads } from "@/lib/data/chat";
import { getInbox } from "@/lib/data/rides";
import { getOffersInbox } from "@/lib/data/requests";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";

export const metadata = { title: "Inbox — CampusRide" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/inbox");
  const signedIn = Boolean(await getUser());
  const now = getNow();
  const fail = demoForcesError(sp.fail);
  const [res, chats, offers] = await Promise.all([
    fail ? { ok: false as const } : getInbox(),
    fail ? { ok: false as const } : getChatThreads(),
    fail ? { ok: false as const } : getOffersInbox(),
  ]);

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <h1 className="t-h1 mb-6 mt-4 text-[2.4rem] md:text-[3rem]">Inbox</h1>
      <section aria-labelledby="offers-heading" className="mb-10">
        <h2 id="offers-heading" className="t-h2 mb-3 border-b border-line pb-2">
          Offers
        </h2>
        {!offers.ok ? (
          <ErrorState message="We couldn't load your offers. Check your connection and try again." href="/inbox" />
        ) : offers.data.length === 0 ? (
          <EmptyState title="No offers waiting" body="When a driver offers you a ride, it shows up here. We'll email you too." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {offers.data.map((o) => (
              <OfferCard key={o.id} offer={o} now={now} mode="rider" showRequest />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="seat-requests-heading">
        <h2 id="seat-requests-heading" className="t-h2 mb-3 border-b border-line pb-2">
          Seat requests
        </h2>
        {!res.ok ? (
          <ErrorState message="We couldn't load your inbox. Check your connection and try again." href="/inbox" />
        ) : res.data.length === 0 ? (
          <EmptyState title="Nothing waiting" body="When someone asks for a seat on your trip, it shows up here. We'll email you too." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {res.data.map((r) => (
              <RequestRow key={r.id} request={r} now={now} showTrip />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="chats-heading" className="mt-10">
        <h2 id="chats-heading" className="t-h2 mb-3 border-b border-line pb-2">
          Chats
        </h2>
        {!chats.ok ? (
          <ErrorState message="We couldn't load your chats. Check your connection and try again." href="/inbox" />
        ) : chats.data.length === 0 ? (
          <EmptyState title="No chats yet" body="You can chat with a driver or rider once a seat is accepted." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {chats.data.map((t) => (
              <ChatListItem key={t.id} thread={t} now={now} />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
