import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ErrorState } from "@/components/states";
import { TripDetailView } from "@/components/trip/TripDetailView";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getTripDetail, parseDemoView } from "@/lib/data/board";
import { getNow, isDemo } from "@/lib/demo";

export const metadata = { title: "Trip — CampusRide" };

export default async function TripPage({ params, searchParams }: PageProps<"/trip/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/trip/${id}`);

  const asParam = Array.isArray(sp.as) ? sp.as[0] : sp.as;
  const res = await getTripDetail(id, parseDemoView(asParam));
  const signedIn = Boolean(await getUser());

  if (!res.ok) {
    return (
      <AppShell signedIn={signedIn} demo={demo}>
        <div className="mt-8">
          <ErrorState message="We couldn't load this trip. Check your connection and try again." href={`/trip/${id}`} />
        </div>
      </AppShell>
    );
  }
  if (!res.data) notFound();
  return <TripDetailView trip={res.data} now={getNow()} signedIn={signedIn} demo={demo} />;
}
