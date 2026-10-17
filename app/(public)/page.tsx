import { redirect } from "next/navigation";
import { BoardPage } from "@/components/board/BoardPage";
import { LandingPage } from "@/components/landing/LandingPage";
import { getMyProfile, getUser } from "@/lib/auth/dal";
import { parseFilters } from "@/lib/data/filters";
import { demoForcesError, isDemo } from "@/lib/demo";

// "/" is the ride board for signed-in students, and the landing page with a sample board for everyone else.
export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getUser();
  if (user) {
    const profile = await getMyProfile();
    if (!profile?.onboarded_at) redirect("/onboarding");
  }
  if (user || isDemo()) {
    const params = await searchParams;
    return <BoardPage filters={parseFilters(params)} signedIn={Boolean(user)} forceError={demoForcesError(params.fail)} />;
  }
  return <LandingPage />;
}
