import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { AskForm } from "@/components/request/AskForm";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getPostFormData } from "@/lib/data/post";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { dayKey } from "@/lib/format/time";
import { nextHalfHour } from "@/lib/format/tz";

export const metadata = { title: "Ask for a ride — CampusRide" };

export default async function AskPage({ searchParams }: PageProps<"/post/ask">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/post/ask");
  const signedIn = Boolean(await getUser());
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getPostFormData();
  if (res.ok && demo && sp.points === "none") {
    res.data.points = [];
    res.data.lastMeetupPointId = null;
  }
  const now = getNow();
  const start = nextHalfHour(now);

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href="/post" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Post
      </Link>
      <h1 className="t-h1 mb-2 text-[2.4rem] md:text-[3rem]">Ask for a ride</h1>
      <p className="mb-6 max-w-[56ch] text-muted">Tell drivers where you need to go. Anyone heading your way can offer you a seat.</p>
      <div>
        {res.ok ? (
          <AskForm
            places={res.data.places}
            points={res.data.points}
            campusId={res.data.campusId}
            nowIso={now.toISOString()}
            maxDate={dayKey(new Date(now.getTime() + 7 * 24 * 3600_000))}
            defaults={{ date: start.date, time: start.time, meetupPointId: res.data.lastMeetupPointId ?? "" }}
          />
        ) : (
          <ErrorState message="We couldn't load the form. Check your connection and try again." href="/post/ask" />
        )}
      </div>
    </AppShell>
  );
}
