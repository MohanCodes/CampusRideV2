import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { OfferForm } from "@/components/post/OfferForm";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getPostFormData } from "@/lib/data/post";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { nextHalfHour } from "@/lib/format/tz";

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
  const start = nextHalfHour(getNow());

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href="/post" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Post
      </Link>
      <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">Offer a ride</h1>
      <div className="max-w-[640px]">
        {res.ok ? (
          <OfferForm
            places={res.data.places}
            points={res.data.points}
            campusId={res.data.campusId}
            nowIso={getNow().toISOString()}
            defaults={{ date: start.date, time: start.time, meetupPointId: res.data.lastMeetupPointId ?? "" }}
          />
        ) : (
          <ErrorState message="We couldn't load the form. Check your connection and try again." href="/post/offer" />
        )}
      </div>
    </AppShell>
  );
}
