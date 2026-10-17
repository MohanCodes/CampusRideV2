import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

// A browser client used only for the live chat feed. The session cookie is HttpOnly, so the browser
// can't read it; the chat page gets a short-lived token from the server and hands it over with
// realtime.setAuth(). It never makes ordinary data requests: reads and writes go through the server.
export function createRealtimeClient() {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
