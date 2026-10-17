import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { EditRequestForm } from "@/components/request/EditRequestForm";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getRequestDetail } from "@/lib/data/requests";
import { getNow, isDemo } from "@/lib/demo";
import { dayKey, requestCenter } from "@/lib/format/time";
import { hhmm } from "@/lib/format/tz";

export const metadata = { title: "Edit request — CampusRide" };

export default async function EditRequestPage({ params }: PageProps<"/request/[id]/edit">) {
  const { id } = await params;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/request/${id}/edit`);
  const signedIn = Boolean(await getUser());
  const res = await getRequestDetail(id, demo ? "own" : undefined);

  if (!res.ok) {
    return <AppShell signedIn={signedIn} demo={demo}><div className="mt-8"><ErrorState message="We couldn't load this request. Check your connection and try again." href={`/request/${id}/edit`} /></div></AppShell>;
  }
  if (!res.data) notFound();
  const { request: r, status, isOwn } = res.data;
  if (!isOwn || status !== "open") redirect(`/request/${id}`);

  const now = getNow();
  const center = requestCenter(r.windowStart, r.windowEnd, r.flexibility);
  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href={`/request/${id}`} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        {r.destinationName}
      </Link>
      <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">Edit request</h1>
      <div className="max-w-[640px]">
        <EditRequestForm
          requestId={r.id}
          destinationName={r.destinationName}
          minDate={dayKey(now)}
          maxDate={dayKey(new Date(now.getTime() + 7 * 24 * 3600_000))}
          nowIso={now.toISOString()}
          initial={{ date: dayKey(center), time: hhmm(center), flexibility: r.flexibility, seats: r.seats, chipIn: r.chipIn, note: r.note ?? "" }}
        />
      </div>
    </AppShell>
  );
}
