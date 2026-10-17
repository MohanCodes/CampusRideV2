import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { checkHealth } from "@/lib/health";

// For the uptime monitor (BUILD.md Section 13): 200 only if the database answers. It uses the public key and
// reads nothing, so it is safe to leave open.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = getSupabaseEnv();
  const client = env ? createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const { status, body } = await checkHealth(client);
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
