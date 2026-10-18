import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getMyProfile, requireUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your profile — CampusRide" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const params = await searchParams;
  const raw = params.next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);

  if (!isDemo()) await requireUser("/onboarding" + (next === "/" ? "" : `?next=${encodeURIComponent(next)}`));
  const profile = await getMyProfile();
  if (profile?.onboarded_at) redirect(next);

  const supabase = await createClient();
  const { data: campus } = profile && supabase
    ? await supabase.from("campuses").select("id, name").eq("id", profile.campus_id).maybeSingle()
    : { data: null };

  const thisYear = new Date().getFullYear();
  const classYears = Array.from({ length: 7 }, (_, i) => thisYear + i);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[560px] flex-col px-4 py-6 sm:px-[25px]">
      <header className="flex h-[78px] items-center">
        <Logo />
      </header>
      <div className="card mt-6 p-6 md:p-8">
        <OnboardingForm
          campusName={campus?.name ?? "Your college"}
          classYears={classYears}
          next={next}
          defaults={{
            firstName: profile?.first_name ?? "",
            lastName: profile?.last_name ?? "",
            classYear: profile?.class_year ? String(profile.class_year) : "",
            bio: profile?.bio ?? "",
            hasPhoto: Boolean(profile?.avatar_path),
          }}
        />
      </div>
    </main>
  );
}
