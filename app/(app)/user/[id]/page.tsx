import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { SafetyMenu } from "@/components/safety/SafetyMenu";
import { ErrorState } from "@/components/states";
import { campusShortName } from "@/lib/campuses";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getPublicProfile } from "@/lib/data/profiles";
import { isDemo } from "@/lib/demo";
import Link from "next/link";

export const metadata = { title: "Profile — CampusRide" };

// Another student's profile: first name, photo, college, class year, bio, and the verified badge.
// Never a last name or an email. Report and Block are here, as on every profile.
export default async function UserPage({ params }: PageProps<"/user/[id]">) {
  const { id } = await params;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/user/${id}`);
  const signedIn = Boolean(await getUser());
  const res = await getPublicProfile(id);

  if (!res.ok) {
    return <AppShell signedIn={signedIn} demo={demo}><div className="mt-8"><ErrorState message="We couldn't load this profile. Check your connection and try again." href={`/user/${id}`} /></div></AppShell>;
  }
  if (!res.data) notFound();
  const { person: p, bio, isMe } = res.data;

  return (
    <AppShell signedIn={signedIn} demo={demo}>
      <Link href="/" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Board
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={p.firstName} url={p.avatarUrl} size={88} />
          <div>
            <h1 className="t-h1 text-[2.4rem] md:text-[3rem]">{p.firstName}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-muted">
              <span>{campusShortName(p.campusId)}{p.classYear ? ` · class of ${p.classYear}` : ""}</span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-green"><Icon name="check" size={14} />Verified</span>
            </p>
          </div>
        </div>
        {!isMe && <SafetyMenu target={{ type: "user", id: p.id }} noun="person" person={{ id: p.id, firstName: p.firstName }} />}
      </div>
      {bio ? <p className="mt-6 max-w-[60ch] text-[1.0625rem]" data-testid="bio">{bio}</p> : <p className="mt-6 text-muted">{p.firstName} hasn&apos;t added a bio.</p>}
      {isMe && <p className="mt-6 text-muted">This is how other students see you.</p>}
    </AppShell>
  );
}
