import type { SupabaseClient } from "@supabase/supabase-js";
import { errorCode, errorMessage } from "@/lib/errors";
import { notificationPrefsSchema } from "@/lib/schemas/account";
import type { ActionResult } from "./seat";

// The logic behind Settings, with the Supabase client passed in so it can be tested.
const rpcFail = (error: unknown): ActionResult<never> => ({ ok: false, message: errorMessage(error), code: errorCode(error) });
const done: ActionResult = { ok: true, data: undefined };

export async function performSavePrefs(supabase: SupabaseClient, userId: string, input: unknown): Promise<ActionResult> {
  const p = notificationPrefsSchema.safeParse(input);
  if (!p.success) return { ok: false, message: errorMessage("invalid_request"), code: "invalid" };
  const { error } = await supabase.from("profiles").update({ notification_prefs: p.data }).eq("id", userId);
  return error ? rpcFail(error) : done;
}

export const DELETE_FAILED_AFTER_CLOSE =
  "Your account is closed, but we couldn't finish removing your sign-in. Try again.";

/**
 * Two steps. First the database closes the account (clears the profile, cancels what is ahead). Then the
 * delete-account Edge Function removes the photo file and the sign-in. If the second step fails the account is
 * already closed, so the message says so, and trying again only repeats the second step.
 */
export async function performDeleteAccount(
  supabase: SupabaseClient,
  finish: () => Promise<{ error: unknown }>,
): Promise<ActionResult & { closed?: boolean }> {
  const first = await supabase.rpc("request_account_deletion");
  if (first.error) return rpcFail(first.error);
  const second = await finish();
  if (second.error) return { ok: false, message: DELETE_FAILED_AFTER_CLOSE, code: "delete_incomplete", closed: true };
  return done;
}
