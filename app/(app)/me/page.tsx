import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BlockedList } from "@/components/me/BlockedList";
import { DeleteAccount } from "@/components/me/DeleteAccount";
import { NotificationToggles } from "@/components/me/NotificationToggles";
import { ErrorState } from "@/components/states";
import { signOut } from "@/lib/auth/actions";
import { requireOnboarded } from "@/lib/auth/dal";
import { campusShortName } from "@/lib/campuses";
import { getMySettings } from "@/lib/data/me";
import { demoForcesError, isDemo } from "@/lib/demo";

export const metadata = { title: "Profile and settings — CampusRide" };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded("/me");
  const res = demoForcesError(sp.fail) ? ({ ok: false } as const) : await getMySettings();

  if (!res.ok || !res.data) {
    return (
      <AppShell signedIn={!demo} demo={demo}>
        <div className="mt-8"><ErrorState message="We couldn't load your settings. Check your connection and try again." href="/me" /></div>
      </AppShell>
    );
  }
  const s = res.data;

  return (
    <AppShell signedIn={!demo} demo={demo}>
      <h1 className="t-h1 mb-8 mt-6 text-[2.4rem] md:text-[3rem]">Profile</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="you-heading" className="card p-5" data-testid="my-profile">
            <h2 id="you-heading" className="sr-only">You</h2>
            <div className="flex items-center gap-4">
              <Avatar name={s.person.firstName} url={s.person.avatarUrl} size={72} />
              <div className="min-w-0">
                <p className="t-h2">{s.person.firstName} {s.lastName}</p>
                <p className="text-muted">{campusShortName(String(s.person.campusId))}{s.person.classYear ? ` · class of ${s.person.classYear}` : ""}</p>
              </div>
            </div>
            {s.bio && <p className="mt-4 max-w-[60ch]">{s.bio}</p>}
            <p className="mt-4 text-sm text-muted">Other students see your first name, college, class year, bio, and photo. They never see your last name or email.</p>
            <p className="mt-3"><Link href={`/user/${s.person.id}`} className="link">See how others see you</Link></p>
          </section>

          <section aria-labelledby="notify-heading">
            <h2 id="notify-heading" className="t-h2 mb-3">Email</h2>
            <NotificationToggles prefs={s.prefs} />
          </section>

          <section aria-labelledby="blocked-heading">
            <h2 id="blocked-heading" className="t-h2 mb-3">Blocked people</h2>
            <BlockedList people={s.blocked} />
          </section>
        </div>

        <div className="min-w-0 space-y-10">
          <section aria-labelledby="help-heading">
            <h2 id="help-heading" className="t-h2 mb-3">Safety and help</h2>
            <ul className="divide-y divide-line border-y border-line">
              <li><Link href="/safety" className="flex min-h-[48px] items-center">Safety tips</Link></li>
              <li><Link href="/privacy" className="flex min-h-[48px] items-center">Privacy</Link></li>
              <li><Link href="/terms" className="flex min-h-[48px] items-center">Terms</Link></li>
            </ul>
          </section>

          <section aria-labelledby="data-heading">
            <h2 id="data-heading" className="t-h2 mb-3">Your data</h2>
            <p className="mb-3 max-w-[56ch] text-muted">A file with your profile, trips, seat requests, requests, offers, and messages.</p>
            {/* A plain link to a route that answers with a file: no script needed. */}
            <a href="/me/export" download className="btn-secondary" data-testid="export-link">Download my data</a>
          </section>

          <section aria-labelledby="account-heading">
            <h2 id="account-heading" className="t-h2 mb-3">Account</h2>
            <div className="flex flex-wrap items-start gap-3">
              <form action={signOut}><button type="submit" className="btn-secondary">Sign out</button></form>
              <DeleteAccount />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
