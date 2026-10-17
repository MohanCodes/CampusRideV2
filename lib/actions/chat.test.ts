import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { performFetchNew, performMarkRead, performSend } from "./chat";

const CONV = "00000000-0000-4000-8000-000000000001";
const ME = "00000000-0000-4000-8000-0000000000aa";
const row = { id: 7, sender_id: ME, body: "On my way", kind: "user", created_at: "2026-10-17T20:00:00Z" };

// A stand-in for the query builder: every method returns itself, and awaiting it gives the result.
function builder(result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const calls: [string, unknown[]][] = [];
  const b: Record<string, unknown> = {};
  for (const name of ["from", "insert", "select", "single", "eq", "gt", "order", "limit"]) {
    b[name] = (...args: unknown[]) => { calls.push([name, args]); return b; };
  }
  b.then = (res: (v: unknown) => unknown) => res({ data: result.data ?? null, error: result.error ?? null });
  return { client: b as unknown as SupabaseClient, calls };
}

describe("performSend", () => {
  it("inserts as the signed-in person and returns the saved message", async () => {
    const { client, calls } = builder({ data: row });
    const r = await performSend(client, ME, { conversationId: CONV, body: "  On my way  " });
    expect(r).toEqual({ ok: true, data: { id: 7, senderId: ME, body: "On my way", kind: "user", createdAt: "2026-10-17T20:00:00Z" } });
    expect(calls.find(([n]) => n === "insert")![1][0]).toEqual({ conversation_id: CONV, sender_id: ME, body: "On my way" });
  });
  it("refuses an empty or oversized message before it reaches the database", async () => {
    const { client, calls } = builder({ data: row });
    expect(await performSend(client, ME, { conversationId: CONV, body: "   " })).toMatchObject({ ok: false, message: "Write a message first." });
    expect(await performSend(client, ME, { conversationId: CONV, body: "x".repeat(1001) })).toMatchObject({ ok: false, message: "Keep messages under 1,000 characters." });
    expect(await performSend(client, ME, { conversationId: "nope", body: "hi" })).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
  });
  it("allows phone numbers and links in chat", async () => {
    const { client } = builder({ data: { ...row, body: "call 909-555-0123 or www.example.com" } });
    expect((await performSend(client, ME, { conversationId: CONV, body: "call 909-555-0123 or www.example.com" })).ok).toBe(true);
  });
  it("says the chat is closed when row-level security refuses", async () => {
    const { client } = builder({ error: { message: "new row violates row-level security policy", code: "42501" } });
    expect(await performSend(client, ME, { conversationId: CONV, body: "hi" })).toEqual({ ok: false, message: "This chat is closed.", code: "chat_closed" });
  });
  it("says to wait when the rate limit trips", async () => {
    const { client } = builder({ error: { message: "rate_limited", code: "P0001" } });
    expect(await performSend(client, ME, { conversationId: CONV, body: "hi" })).toMatchObject({ ok: false, message: "Too many tries. Wait a bit, then try again." });
  });
});

describe("performFetchNew", () => {
  it("asks for messages after a given id, oldest first", async () => {
    const { client, calls } = builder({ data: [row, { ...row, id: 8 }] });
    const r = await performFetchNew(client, { conversationId: CONV, afterId: "6" });
    expect(r.ok && r.data.map((m) => m.id)).toEqual([7, 8]);
    expect(calls).toContainEqual(["gt", ["id", 6]]);
    expect(calls).toContainEqual(["eq", ["conversation_id", CONV]]);
  });
  it("refuses a malformed request", async () => {
    const { client, calls } = builder({ data: [] });
    expect((await performFetchNew(client, { conversationId: "x", afterId: 0 })).ok).toBe(false);
    expect((await performFetchNew(client, { conversationId: CONV, afterId: -1 })).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("performMarkRead", () => {
  it("calls the database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    expect(await performMarkRead({ rpc } as unknown as SupabaseClient, { conversationId: CONV })).toEqual({ ok: true, data: undefined });
    expect(rpc).toHaveBeenCalledWith("mark_conversation_read", { p_conversation: CONV });
  });
  it("reports a refusal", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "forbidden" } });
    expect(await performMarkRead({ rpc } as unknown as SupabaseClient, { conversationId: CONV })).toMatchObject({ ok: false, message: "You can't do that." });
  });
});
