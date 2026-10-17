import "server-only";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { avatarUrls } from "./avatars";
import { demoConversation, demoThreads } from "./mock";
import type { ChatThread, Conversation, Person, Result } from "./types";
import { toMessage } from "@/lib/actions/chat";

type ThreadRow = {
  id: string; trip_id: string; driver_id: string; rider_id: string; closes_at: string;
  destination_name: string; departs_at: string; trip_status: "open" | "cancelled" | "past";
  other_id: string; other_first_name: string; other_campus_id: string; other_class_year: number | null; other_avatar_path: string | null;
  last_body: string | null; last_at: string | null; last_sender_id: string | null; last_kind: "user" | "system" | null; unread: number;
};

const personOf = (r: ThreadRow, urls: Map<string, string>): Person => ({
  id: r.other_id,
  firstName: r.other_first_name,
  campusId: r.other_campus_id,
  classYear: r.other_class_year,
  avatarUrl: r.other_avatar_path ? (urls.get(r.other_avatar_path) ?? null) : null,
});

// Every chat the person is in, most recent first. A chat with someone blocked (either way) is not here.
export async function getChatThreads(): Promise<Result<ChatThread[]>> {
  if (isDemo()) return { ok: true, data: demoThreads(getNow()) };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };
    const { data, error } = await supabase.from("chat_threads").select("*").order("last_at", { ascending: false, nullsFirst: false });
    if (error) return { ok: false };
    const rows = (data ?? []) as ThreadRow[];
    const urls = await avatarUrls(supabase, rows.map((r) => r.other_avatar_path));
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id, tripId: r.trip_id, tripName: r.destination_name, departsAt: r.departs_at, closesAt: r.closes_at,
        other: personOf(r, urls), lastBody: r.last_body, lastAt: r.last_at, lastKind: r.last_kind,
        lastFromMe: r.last_sender_id === user.id, unread: r.unread,
      })),
    };
  } catch {
    return { ok: false };
  }
}

// One chat with its history. `data: null` means there is no such chat, or it isn't theirs to see.
export async function getConversation(id: string): Promise<Result<Conversation | null>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: demoConversation(id, now) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const { data: thread, error } = await supabase.from("chat_threads").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false };
    if (!thread) return { ok: true, data: null };
    const t = thread as ThreadRow;

    const [msgRes, seatRes] = await Promise.all([
      supabase.from("messages").select("id, sender_id, body, kind, created_at").eq("conversation_id", id).order("id").limit(300),
      supabase.from("seat_requests").select("status").eq("trip_id", t.trip_id).eq("rider_id", t.rider_id).maybeSingle(),
    ]);
    if (msgRes.error) return { ok: false };
    const urls = await avatarUrls(supabase, [t.other_avatar_path]);

    const timeClosed = new Date(t.closes_at) <= now;
    const closedReason = timeClosed ? "time" : t.trip_status === "cancelled" ? "trip_cancelled" : seatRes.data?.status !== "accepted" ? "seat_cancelled" : null;
    return {
      ok: true,
      data: {
        id, tripId: t.trip_id, tripName: t.destination_name, departsAt: t.departs_at, other: personOf(t, urls),
        messages: (msgRes.data ?? []).map((m) => toMessage(m as never)),
        open: closedReason === null, closedReason,
      },
    };
  } catch {
    return { ok: false };
  }
}
