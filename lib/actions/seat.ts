import type { SupabaseClient } from "@supabase/supabase-js";
import { errorCode, errorMessage } from "@/lib/errors";
import { cancelSeatSchema, cancelTripSchema, requestSeatSchema, respondSchema } from "@/lib/schemas/seat";

// The logic behind the seat-request buttons. Each function validates its input with Zod, calls one
// database function, and turns a database error code into a plain sentence. They take the Supabase
// client as an argument so they can be tested with a stub; the server actions pass in the real one.
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: string | null; fields?: Record<string, string> };

const fail = (message: string, code: string | null = null, fields?: Record<string, string>): ActionResult<never> =>
  ({ ok: false, message, code, fields });

function fromParse(error: { issues: { path: PropertyKey[]; message: string }[] }): ActionResult<never> {
  const fields: Record<string, string> = {};
  for (const i of error.issues) fields[String(i.path[0])] ??= i.message;
  return fail(error.issues[0]?.message ?? errorMessage("invalid_request"), "invalid", fields);
}

const fromRpc = (error: unknown): ActionResult<never> => fail(errorMessage(error), errorCode(error));

export async function performRequestSeat(supabase: SupabaseClient, input: unknown): Promise<ActionResult<{ requestId: string }>> {
  const parsed = requestSeatSchema.safeParse(input);
  if (!parsed.success) return fromParse(parsed.error);
  const { data, error } = await supabase.rpc("request_seat", {
    p_trip: parsed.data.tripId,
    p_seats: parsed.data.seats,
    p_message: parsed.data.message || null,
  });
  if (error) return fromRpc(error);
  return { ok: true, data: { requestId: String(data) } };
}

export async function performCancelSeat(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const parsed = cancelSeatSchema.safeParse(input);
  if (!parsed.success) return fromParse(parsed.error);
  const { error } = await supabase.rpc("cancel_seat_request", { p_request: parsed.data.requestId });
  return error ? fromRpc(error) : { ok: true, data: undefined };
}

export async function performRespond(supabase: SupabaseClient, input: unknown): Promise<ActionResult<{ accepted: boolean }>> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return fromParse(parsed.error);
  const { error } = await supabase.rpc("respond_seat_request", { p_request: parsed.data.requestId, p_accept: parsed.data.accept });
  return error ? fromRpc(error) : { ok: true, data: { accepted: parsed.data.accept } };
}

export async function performCancelTrip(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const parsed = cancelTripSchema.safeParse(input);
  if (!parsed.success) return fromParse(parsed.error);
  const { error } = await supabase.rpc("cancel_trip", { p_trip: parsed.data.tripId });
  return error ? fromRpc(error) : { ok: true, data: undefined };
}
