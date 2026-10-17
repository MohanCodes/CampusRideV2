import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { EditTripForm } from "@/components/post/EditTripForm";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getTripDetail } from "@/lib/data/board";
import { getNow, isDemo } from "@/lib/demo";
import { dayKey } from "@/lib/format/time";
import { hhmm } from "@/lib/format/tz";

export const metadata = { title: "Edit trip — CampusRide" };

export default async function EditTripPage({ params }: PageProps<"/trip/[id]/edit">) {
  const { id } = await params;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/trip/${id}/edit`);
  const signedIn = Boolean(await getUser());
  // Demo mode edits the sample trip the demo viewer "owns".
  const res = await getTripDetail(id, demo ? "own" : undefined);

  if (!res.ok) {
    return (
      <AppShell signedIn={signedIn} demo={demo}>
        <div className="mt-8"><ErrorState message="We couldn't load this trip. Check your connection and try again." href={`/trip/${id}/edit`} /></div>
      </AppShell>
    );
  }
  if (!res.data) notFound();
  const t = res.data;
  if (t.state !== "own" || t.tripStatus !== "open") redirect(`/trip/${id}`);

  const now = getNow();
  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href={`/trip/${id}`} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        {t.destinationName}
      </Link>
      <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">Edit trip</h1>
      <div className="max-w-[640px]">
        <EditTripForm
          tripId={t.id}
          seatsTaken={t.seatsTaken}
          nowIso={now.toISOString()}
          minDate={dayKey(now)}
          initial={{
            date: dayKey(t.departsAt),
            time: hhmm(new Date(t.departsAt)),
            backBy: t.backBy ? hhmm(new Date(t.backBy)) : "",
            seats: t.seatsTotal,
            costNote: t.costNote ?? "",
            notes: t.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
