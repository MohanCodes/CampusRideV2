import "server-only";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { readPrefs } from "@/lib/schemas/account";
import { avatarUrls } from "./avatars";
import { demoSettings } from "./mock";
import type { MySettings, Result } from "./types";

// What the Settings page shows about the signed-in person: their own profile (their last name is theirs to see),
// their email switches, the people they blocked, and their college's safety number.
export async function getMySettings(): Promise<Result<MySettings | null>> {
  if (isDemo()) return { ok: true, data: demoSettings() };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };
    const [profile, blocked] = await Promise.all([
      supabase.from("profiles").select("id, campus_id, first_name, last_name, class_year, bio, avatar_path, notification_prefs").eq("id", user.id).maybeSingle(),
      supabase.rpc("my_blocked_users"),
    ]);
    if (profile.error || blocked.error) return { ok: false };
    const p = profile.data;
    if (!p) return { ok: true, data: null };
    const [campus, urls] = await Promise.all([
      supabase.from("campuses").select("name, safety_phone").eq("id", p.campus_id).maybeSingle(),
      avatarUrls(supabase, [p.avatar_path]),
    ]);
    return {
      ok: true,
      data: {
        person: {
          id: p.id, firstName: p.first_name ?? "", campusId: p.campus_id, classYear: p.class_year,
          avatarUrl: p.avatar_path ? (urls.get(p.avatar_path) ?? null) : null,
        },
        lastName: p.last_name ?? "",
        bio: p.bio,
        prefs: readPrefs(p.notification_prefs),
        blocked: ((blocked.data ?? []) as { user_id: string; first_name: string; campus_id: string }[]).map((b) => ({ id: b.user_id, firstName: b.first_name, campusId: b.campus_id })),
        safetyPhone: campus.data?.safety_phone ?? null,
        campusName: campus.data?.name ?? "",
      },
    };
  } catch {
    return { ok: false };
  }
}

// The signed-in person's campus safety number for the Safety page: null if signed out or not yet confirmed.
export async function getMySafetyNumber(): Promise<{ campusName: string; phone: string | null } | null> {
  const r = await getMySettings();
  if (!r.ok || !r.data) return null;
  return { campusName: r.data.campusName, phone: r.data.safetyPhone };
}
