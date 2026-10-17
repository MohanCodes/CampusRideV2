import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// Finishes a sign-in that arrives as a link (a fallback; the normal path is the six-digit code).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/sign-in", origin));
}
