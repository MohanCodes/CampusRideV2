import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TripCard } from "@/components/board/TripCard";
import { CopyLink } from "@/components/post/CopyLink";
import { ErrorState } from "@/components/states";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getTripCard } from "@/lib/data/board";
import { getNow, isDemo } from "@/lib/demo";

export const metadata = { title: "Trip posted — CampusRide" };

export default async function ConfirmedPage({ params }: PageProps<"/post/confirmed/[id]">) {
  const { id } = await params;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/post/confirmed/${id}`);
  const signedIn = Boolean(await getUser());
  const res = await getTripCard(id);
  if (!res.ok) {
    return (
      <AppShell signedIn={signedIn} demo={demo}>
        <div className="mt-8">
          <ErrorState message="Your trip was posted, but we couldn't show it. Check the board." href={`/post/confirmed/${id}`} />
        </div>
      </AppShell>
    );
  }
  if (!res.data) notFound();

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <h1 className="t-h1 mb-2 mt-4 text-[2.4rem] md:text-[3rem]">Your trip is posted</h1>
      <p className="mb-6 text-muted">Riders can find it on the board now. We&apos;ll email you when someone asks for a seat.</p>
      <div className="max-w-[420px]">
        <TripCard trip={res.data} now={getNow()} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-primary">
          Done <span aria-hidden="true">↗</span>
        </Link>
        <CopyLink path={`/trip/${res.data.id}`} />
      </div>
    </AppShell>
  );
}
