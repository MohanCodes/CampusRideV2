import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_URL_SECONDS = 3600;

// Photos live in a private bucket, so each one is shown through a link that expires in an hour.
export async function avatarUrls(supabase: SupabaseClient, paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, AVATAR_URL_SECONDS);
  for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}
