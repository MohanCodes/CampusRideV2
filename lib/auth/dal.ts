import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInUrl } from "@/lib/routes";
import type { Profile } from "@/lib/types";

// The Data Access Layer: one place that asks "who is this?". getUser() asks the auth server, so
// a forged cookie can't pass. Pages call these; they don't trust the proxy alone.
export const getUser = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!supabase || !user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, campus_id, first_name, last_name, class_year, bio, avatar_path, role, onboarded_at, suspended_until")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser(returnTo: string) {
  const user = await getUser();
  if (!user) redirect(signInUrl(returnTo));
  return user;
}

// Signed in and finished onboarding. Anyone not finished goes to the profile step first.
export async function requireOnboarded(returnTo: string) {
  await requireUser(returnTo);
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");
  return profile;
}
