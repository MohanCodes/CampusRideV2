"use client";

import { personalizeSystemMessage } from "@/lib/chat/system-message";
import { useEffect, useRef, useState } from "react";
import { fetchNewMessages, getChatToken, markChatRead, sendChatMessage } from "@/app/(app)/chat/[id]/actions";
import { toMessage } from "@/lib/actions/chat";
import { MAX_MESSAGE_LENGTH, QUICK_REPLIES, lastId, mergeMessages } from "@/lib/chat/merge";
import type { ChatMessage } from "@/lib/data/types";
import { dayKey, formatDay, formatTime } from "@/lib/format/time";
import { createRealtimeClient } from "@/lib/supabase/browser";

type Props = {
  conversationId: string;
  initial: ChatMessage[];
  meId: string;
  nowIso: string;
  // Whether a live feed can be used here (a Supabase project is configured and this is not sample mode).
  live: boolean;
  demo: boolean;
  open: boolean;
  closedText: string | null;
};

const FAST_POLL_MS = 8_000; // while the live feed is not connected
const SLOW_POLL_MS = 60_000; // a safety net while it is
const TOKEN_REFRESH_MS = 45 * 60_000;

type RealtimeRow = { id: number; sender_id: string; body: string; kind: "user" | "system"; created_at: string };

// The conversation: history, a live feed, and the composer. If the live feed drops, it falls back to
// checking for new messages every few seconds, so chat keeps working either way.
// NOTE: the live feed needs a real Supabase project, so it has not been run yet; the rest has.
export function ChatThread({ conversationId, initial, meId, nowIso, live, demo, open, closedText }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const newest = useRef(lastId(initial));
  const now = new Date(nowIso);

  useEffect(() => {
    newest.current = lastId(messages);
    // Show the newest message: scroll the message list (not the page) to its bottom.
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Tell the server what has been read, when the other person's newest message changes.
  const newestFromThem = messages.filter((m) => m.kind === "user" && m.senderId !== meId).reduce((max, m) => Math.max(max, m.id), 0);
  useEffect(() => {
    if (newestFromThem > 0) void markChatRead(conversationId);
  }, [newestFromThem, conversationId]);

  // The live feed.
  useEffect(() => {
    if (!live) return;
    const client = createRealtimeClient();
    if (!client) return;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    (async () => {
      const token = await getChatToken();
      if (cancelled || !token) return;
      client.realtime.setAuth(token);
      channel = client
        .channel(`chat:${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
          setMessages((current) => mergeMessages(current, [toMessage(payload.new as RealtimeRow)]));
        })
        .subscribe((status) => {
          if (!cancelled) setConnected(status === "SUBSCRIBED");
        });
    })();
    // The token lasts an hour, so hand over a fresh one before it runs out.
    const refresh = setInterval(async () => {
      const token = await getChatToken();
      if (token) client.realtime.setAuth(token);
    }, TOKEN_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      if (channel) void client.removeChannel(channel);
    };
  }, [live, conversationId]);

  // The fallback: ask for anything newer, only while the tab is showing.
  useEffect(() => {
    if (demo) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetchNewMessages(conversationId, newest.current);
      if (res.ok && res.data.length > 0) setMessages((current) => mergeMessages(current, res.data));
    }, connected ? SLOW_POLL_MS : FAST_POLL_MS);
    return () => clearInterval(id);
  }, [connected, demo, conversationId]);

  async function send(text: string, clearDraft: boolean) {
    const body = text.trim();
    if (!body || sending) return;
    setError(null);
    setSending(true);
    const res = await sendChatMessage(conversationId, body);
    setSending(false);
    if (res.ok) {
      setMessages((current) => mergeMessages(current, [res.data]));
      if (clearDraft) setDraft("");
    } else {
      setError(res.message);
    }
  }

  return (
    // A fixed-height chat: only the message list scrolls, and the composer stays below it.
    <div className="flex h-[calc(100dvh-340px)] min-h-[420px] flex-col">
      <div ref={scroller} tabIndex={0} role="region" aria-label="Conversation" className="min-h-0 flex-1 overflow-y-auto pb-2 pr-1" data-testid="scroller">
      {/* The log role sits on a wrapper, because on the list itself it would hide the list items from assistive tech. */}
      <div role="log" aria-live="polite" aria-label="Messages">
      <ol className="space-y-3 pb-2" data-testid="messages">
        {messages.map((m, i) => {
          const showDay = i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1].createdAt);
          return (
            <li key={m.id} className="list-none">
              {showDay && <p className="t-label my-3 text-center text-muted">{formatDay(m.createdAt, now)}</p>}
              {m.kind === "system" ? (
                <p data-kind="system" className="mx-auto max-w-[44ch] border-y border-line py-2 text-center text-sm text-muted">
                  {personalizeSystemMessage(m.body, m.senderId === meId)}
                </p>
              ) : (
                <div className={`flex flex-col ${m.senderId === meId ? "items-end" : "items-start"}`} data-kind="user" data-mine={m.senderId === meId}>
                  <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${m.senderId === meId ? "bg-mint" : "border border-line bg-surface"}`}>
                    {m.body}
                  </p>
                  <span className="tabular mt-1 text-xs text-muted">{formatTime(m.createdAt)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      </div>
      </div>

      {open ? (
        <form
          onSubmit={(e) => { e.preventDefault(); void send(draft, true); }}
          className="shrink-0 border-t border-line pt-3"
          data-testid="composer"
        >
          <ul className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Quick replies">
            {QUICK_REPLIES.map((q) => (
              <li key={q}>
                <button type="button" className="chip" disabled={sending} onClick={() => void send(q, false)}>
                  {q}
                </button>
              </li>
            ))}
          </ul>
          <label htmlFor="chat-draft" className="sr-only">Message</label>
          <textarea
            id="chat-draft" rows={2} value={draft} maxLength={MAX_MESSAGE_LENGTH} className="field" placeholder="Write a message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft, true); } }}
            aria-describedby={error ? "chat-error" : undefined} aria-invalid={error ? true : undefined}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="tabular text-sm text-muted" aria-live="polite">
              {draft.length >= MAX_MESSAGE_LENGTH - 100 ? `${draft.length}/${MAX_MESSAGE_LENGTH}` : "Enter sends. Shift and Enter adds a line."}
            </p>
            <button type="submit" className="btn-primary" disabled={sending || draft.trim().length === 0}>
              {sending ? "Sending…" : "Send"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          {error && <p id="chat-error" role="alert" className="field-error">{error}</p>}
        </form>
      ) : (
        <p data-testid="chat-closed" className="card shrink-0 p-4 text-muted">
          {closedText}
        </p>
      )}
    </div>
  );
}
