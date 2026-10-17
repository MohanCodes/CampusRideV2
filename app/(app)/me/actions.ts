"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/(app)/trip/[id]/actions";
import { performDeleteAccount, performSavePrefs } from "@/lib/actions/account";
import { performUnblock } from "@/lib/actions/moderation";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const SAMPLE = "This isn't available in sample mode.";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function session() {
  const supabase = await createClient();
  const user = supabase ? await getUser() : null;
  return supabase && user ? { supabase, user } : null;
}

// Each switch saves as soon as it changes. The three values arrive as "on" or missing.
export async function savePrefs(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if (!s) return { status: "error", message: errorMessage("not_signed_in") };
  const r = await performSavePrefs(s.supabase, s.user.id, {
    requests: formData.get("requests") === "on", messages: formData.get("messages") === "on", reminders: formData.get("reminders") === "on",
  });
  if (!r.ok) return { status: "error", message: r.message, code: r.code ?? undefined };
  revalidatePath("/me");
  return { status: "idle" };
}

export async function unblock(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if (!s) return { status: "error", message: errorMessage("not_signed_in") };
  const r = await performUnblock(s.supabase, { userId: str(formData.get("userId")) });
  if (!r.ok) return { status: "error", message: r.message, code: r.code ?? undefined };
  revalidatePath("/me");
  return { status: "idle" };
}

// Closes the account, then asks the delete-account function to remove the photo and the sign-in.
export async function deleteAccount(): Promise<FormState> {
  if (isDemo()) return { status: "error", message: SAMPLE };
  const s = await session();
  if (!s) return { status: "error", message: errorMessage("not_signed_in") };
  const r = await performDeleteAccount(s.supabase, async () => {
    const { error } = await s.supabase.functions.invoke("delete-account", { method: "POST" });
    return { error };
  });
  if (!r.ok) return { status: "error", message: r.message, code: r.code ?? undefined };
  await s.supabase.auth.signOut();
  redirect("/?deleted=1");
}
