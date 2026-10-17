import "server-only";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { avatarUrls } from "./avatars";
import { DEMO_ME, demoProfile } from "./mock";
import type { PublicProfile, Result } from "./types";

// Another student's profile: first name, college, class year, bio, photo. Never a last name or an email.
// `data: null` means there is no such person, they deleted their account, or one of you blocked the other.
export async function getPublicProfile(id: string): Promise<Result<PublicProfile | null>> {
  if (isDemo()) return { ok: true, data: demoProfile(id) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };
    const { data, error } = await supabase.from("public_profiles").select("id, first_name, campus_id, class_year, bio, avatar_path").eq("id", id).maybeSingle();
    if (error) return { ok: false };
    if (!data) return { ok: true, data: null };
    const urls = await avatarUrls(supabase, [data.avatar_path]);
    return {
      ok: true,
      data: {
        isMe: data.id === user.id,
        bio: data.bio,
        person: {
          id: data.id, firstName: data.first_name, campusId: data.campus_id, classYear: data.class_year,
          avatarUrl: data.avatar_path ? (urls.get(data.avatar_path) ?? null) : null,
        },
      },
    };
  } catch {
    return { ok: false };
  }
}

export { DEMO_ME };
