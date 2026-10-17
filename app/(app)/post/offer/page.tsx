import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { OfferForm } from "@/components/post/OfferForm";
import type { Destination } from "@/components/post/DestinationPicker";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getPostFormData } from "@/lib/data/post";
import { getRequestDetail } from "@/lib/data/requests";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { dayKey, requestCenter } from "@/lib/format/time";
import { hhmm, nextHalfHour } from "@/lib/format/tz";

export const metadata = { title: "Offer a ride — CampusRide" };

export default async function OfferPage({ searchParams }: PageProps<"/post/offer">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/post/offer");
  const signedIn = Boolean(await getUser());
  // In demo mode, ?fail=1 and ?points=none show the error and no-meetup-points states for review.
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getPostFormData();
  if (res.ok && isDemo() && sp.points === "none") {
    res.data.points = [];
    res.data.lastMeetupPointId = null;
  }
  let start = nextHalfHour(getNow());

  // "Post a new trip for this": start from the request's destination and time.
  const forId = typeof sp.for === "string" ? sp.for : undefined;
  const forRes = forId ? await getRequestDetail(forId) : null;
  const answering = forRes?.ok && forRes.data && forRes.data.status === "open" && !forRes.data.isOwn ? forRes.data.request : null;
  let preset: { id: string; destination: Destination | null } | undefined;
  if (answering) {
    const place = res.ok ? res.data.places.find((p) => p.name === answering.destinationName) : undefined;
    preset = { id: answering.id, destination: place ? { kind: "place", placeId: place.id, name: place.name } : null };
    const center = requestCenter(answering.windowStart, answering.windowEnd, answering.flexibility);
    if (center.getTime() > getNow().getTime()) start = { date: dayKey(center), time: hhmm(center) };
  }

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href="/post" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Post
      </Link>
      <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">Offer a ride</h1>
      {answering && (
        <p role="note" data-testid="answering" className="card mb-6 max-w-[640px] p-4">
          You&apos;re answering <strong>{answering.rider.firstName}</strong>&apos;s request to {answering.destinationName}. When you post this trip, we&apos;ll send your offer.
        </p>
      )}
      <div className="max-w-[640px]">
        {res.ok ? (
          <OfferForm
            places={res.data.places}
            points={res.data.points}
            campusId={res.data.campusId}
            nowIso={getNow().toISOString()}
            forRequest={preset}
            defaults={{ date: start.date, time: start.time, meetupPointId: res.data.lastMeetupPointId ?? "" }}
          />
        ) : (
          <ErrorState message="We couldn't load the form. Check your connection and try again." href="/post/offer" />
        )}
      </div>
    </AppShell>
  );
}
