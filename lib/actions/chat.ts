import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/errors";
import type { ChatMessage } from "@/lib/data/types";
import { afterIdSchema, conversationIdSchema, sendMessageSchema } from "@/lib/schemas/chat";
import type { ActionResult } from "./seat";

// The logic behind the chat actions, with the Supabase client passed in so it can be tested.
type Row = { id: number; sender_id: string; body: string; kind: "user" | "system"; created_at: string };
const COLUMNS = "id, sender_id, body, kind, created_at";
export const toMessage = (r: Row): ChatMessage => ({ id: r.id, senderId: r.sender_id, body: r.body, kind: r.kind, createdAt: r.created_at });

const CLOSED = "This chat is closed.";

export async function performSend(supabase: SupabaseClient, userId: string, input: unknown): Promise<ActionResult<ChatMessage>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, code: "invalid" };
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: parsed.data.conversationId, sender_id: userId, body: parsed.data.body })
    .select(COLUMNS)
    .single();
  if (error) {
    // Row-level security refuses a send into a chat that has closed, or with someone who is blocked.
    if (error.code === "42501") return { ok: false, message: CLOSED, code: "chat_closed" };
    return { ok: false, message: errorMessage(error), code: null };
  }
  return { ok: true, data: toMessage(data as Row) };
}

export async function performFetchNew(supabase: SupabaseClient, input: unknown): Promise<ActionResult<ChatMessage[]>> {
  const parsed = afterIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, code: "invalid" };
  const { data, error } = await supabase
    .from("messages").select(COLUMNS).eq("conversation_id", parsed.data.conversationId)
    .gt("id", parsed.data.afterId).order("id").limit(100);
  if (error) return { ok: false, message: errorMessage(error), code: null };
  return { ok: true, data: ((data ?? []) as Row[]).map(toMessage) };
}

export async function performMarkRead(supabase: SupabaseClient, input: unknown): Promise<ActionResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, code: "invalid" };
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation: parsed.data.conversationId });
  return error ? { ok: false, message: errorMessage(error), code: null } : { ok: true, data: undefined };
}
