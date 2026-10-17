import type { SupabaseClient } from "@supabase/supabase-js";
import { errorCode, errorMessage } from "@/lib/errors";
import { offerIdSchema, requestIdSchema, respondOfferSchema, sendOfferSchema } from "@/lib/schemas/request";
import type { ActionResult } from "./seat";

// The logic behind the offer and request buttons, with the Supabase client passed in so it can be tested.
const bad = (issues: { message: string }[]): ActionResult<never> => ({ ok: false, message: issues[0]?.message ?? errorMessage("invalid_request"), code: "invalid" });
const rpcFail = (error: unknown): ActionResult<never> => ({ ok: false, message: errorMessage(error), code: errorCode(error) });

export async function performSendOffer(supabase: SupabaseClient, input: unknown): Promise<ActionResult<{ offerId: string }>> {
  const p = sendOfferSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { data, error } = await supabase.rpc("send_offer", { p_request: p.data.requestId, p_trip: p.data.tripId, p_message: p.data.message || null });
  return error ? rpcFail(error) : { ok: true, data: { offerId: String(data) } };
}

export async function performWithdrawOffer(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = offerIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("withdraw_offer", { p_offer: p.data.offerId });
  return error ? rpcFail(error) : { ok: true, data: undefined };
}

export async function performRespondOffer(supabase: SupabaseClient, input: unknown): Promise<ActionResult<{ accepted: boolean }>> {
  const p = respondOfferSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("respond_offer", { p_offer: p.data.offerId, p_accept: p.data.accept });
  return error ? rpcFail(error) : { ok: true, data: { accepted: p.data.accept } };
}

export async function performCancelRequest(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = requestIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("cancel_ride_request", { p_request: p.data.requestId });
  return error ? rpcFail(error) : { ok: true, data: undefined };
}

export async function performExtendRequest(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const p = requestIdSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues);
  const { error } = await supabase.rpc("extend_ride_request", { p_request: p.data.requestId });
  return error ? rpcFail(error) : { ok: true, data: undefined };
}
