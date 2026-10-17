"use server";

import { getUser } from "@/lib/auth/dal";
import { performFetchNew, performMarkRead, performSend } from "@/lib/actions/chat";
import type { ActionResult } from "@/lib/actions/seat";
import type { ChatMessage } from "@/lib/data/types";
import { isDemo } from "@/lib/demo";
import { errorMessage } from "@/lib/errors";
import { sendMessageSchema } from "@/lib/schemas/chat";
import { createClient } from "@/lib/supabase/server";

const notSignedIn = (): ActionResult<never> => ({ ok: false, message: errorMessage("not_signed_in"), code: "not_signed_in" });

export async function sendChatMessage(conversationId: string, body: string): Promise<ActionResult<ChatMessage>> {
  if (isDemo()) {
    // Sample mode keeps the message in the page only, so the conversation screen can be judged.
    const parsed = sendMessageSchema.safeParse({ conversationId: "00000000-0000-4000-8000-000000000000", body });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, code: "invalid" };
    return { ok: true, data: { id: Date.now(), senderId: "demo-me", body: parsed.data.body, kind: "user", createdAt: new Date().toISOString() } };
  }
  const user = await getUser();
  const supabase = await createClient();
  if (!user || !supabase) return notSignedIn();
  return performSend(supabase, user.id, { conversationId, body });
}

export async function fetchNewMessages(conversationId: string, afterId: number): Promise<ActionResult<ChatMessage[]>> {
  if (isDemo()) return { ok: true, data: [] };
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return notSignedIn();
  return performFetchNew(supabase, { conversationId, afterId });
}

export async function markChatRead(conversationId: string): Promise<ActionResult> {
  if (isDemo()) return { ok: true, data: undefined };
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return notSignedIn();
  return performMarkRead(supabase, { conversationId });
}

// A short-lived token for the live feed. The session cookie stays HttpOnly; only this token reaches the browser.
export async function getChatToken(): Promise<string | null> {
  if (isDemo()) return null;
  const supabase = await createClient();
  if (!supabase || !(await getUser())) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
