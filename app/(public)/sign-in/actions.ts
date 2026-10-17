"use server";

import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/auth/dal";
import { GENERIC_ERROR, errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/routes";
import { BAD_CODE, NOT_SCHOOL_EMAIL, requestCodeSchema, verifyCodeSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type RequestCodeState =
  | { status: "idle" }
  | { status: "error"; message: string; email?: string }
  | { status: "sent"; email: string; sentAt: number };

export type VerifyCodeState = { status: "idle" } | { status: "error"; message: string };

const NOT_CONFIGURED = "Sign-in isn't set up in this environment yet.";

// Step 1: school email in, six-digit code out. The domain is checked here first for an instant
// answer, but the auth hook in the database is the real check.
export async function requestCode(_prev: RequestCodeState, formData: FormData): Promise<RequestCodeState> {
  const parsed = requestCodeSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: NOT_SCHOOL_EMAIL };
  const { email } = parsed.data;

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: NOT_CONFIGURED, email };

  const { data: allowed, error: lookupError } = await supabase.rpc("school_email_allowed", { p_email: email });
  if (lookupError) return { status: "error", message: GENERIC_ERROR, email };
  if (!allowed) return { status: "error", message: NOT_SCHOOL_EMAIL, email };

  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    if (error.message.toLowerCase().includes("school email")) {
      return { status: "error", message: NOT_SCHOOL_EMAIL, email };
    }
    if (error.status === 429) return { status: "error", message: errorMessage("rate_limited"), email };
    return { status: "error", message: "We couldn't send the code. Try again.", email };
  }
  return { status: "sent", email, sentAt: Date.now() };
}

// Step 2: the code. A new person goes on to the profile step; everyone else goes where they were headed.
export async function verifyCode(_prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const parsed = verifyCodeSchema.safeParse({ email: formData.get("email"), code: formData.get("code") });
  if (!parsed.success) return { status: "error", message: BAD_CODE };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: NOT_CONFIGURED };

  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { status: "error", message: BAD_CODE };

  const next = safeNext(formData.get("next") as string | null);
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) {
    redirect(next === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}
