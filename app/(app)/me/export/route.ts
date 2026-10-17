import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

// "Download my data": a JSON file with the person's profile, trips, requests, offers, and messages.
// The database function reads only the caller's rows, and is rate limited.
export const dynamic = "force-dynamic";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Content-Disposition": 'attachment; filename="campusride-my-data.json"',
  "Cache-Control": "no-store",
};

export async function GET() {
  if (isDemo()) {
    const sample = { note: "Sample mode. A real download lists your profile, trips, seat requests, requests, offers, and messages." };
    return new NextResponse(JSON.stringify(sample, null, 2), { headers });
  }
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    const limited = /rate_limited/.test(error.message);
    return NextResponse.json(
      { error: limited ? "Too many tries. Wait a bit, then try again." : "We couldn't prepare your data. Try again." },
      { status: limited ? 429 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return new NextResponse(JSON.stringify(data, null, 2), { headers });
}
