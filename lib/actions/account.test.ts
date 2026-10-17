import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DELETE_FAILED_AFTER_CLOSE, performDeleteAccount, performSavePrefs } from "./account";

const U = "00000000-0000-4000-8000-000000000001";

function table(error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from } as unknown as SupabaseClient, from, update, eq };
}

describe("performSavePrefs", () => {
  it("saves the three switches for the signed-in person only", async () => {
    const { client, from, update, eq } = table();
    expect(await performSavePrefs(client, U, { requests: true, messages: false, reminders: true })).toEqual({ ok: true, data: undefined });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ notification_prefs: { requests: true, messages: false, reminders: true } });
    expect(eq).toHaveBeenCalledWith("id", U);
  });
  it("strips unknown keys so nothing else lands in the column", async () => {
    const { client, update } = table();
    await performSavePrefs(client, U, { requests: true, messages: true, reminders: true, role: "admin" });
    expect(update).toHaveBeenCalledWith({ notification_prefs: { requests: true, messages: true, reminders: true } });
  });
  it("refuses bad input before the database", async () => {
    const { client, from } = table();
    expect((await performSavePrefs(client, U, { requests: "no" })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
  it("turns a database error into a plain message", async () => {
    const { client } = table({ message: "rate_limited" });
    expect(await performSavePrefs(client, U, { requests: true, messages: true, reminders: true })).toMatchObject({ ok: false, message: "Too many tries. Wait a bit, then try again." });
  });
});

describe("performDeleteAccount", () => {
  const rpcClient = (error: { message: string } | null = null) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    return { client: { rpc } as unknown as SupabaseClient, rpc };
  };
  it("closes the account, then finishes it", async () => {
    const { client, rpc } = rpcClient();
    const finish = vi.fn().mockResolvedValue({ error: null });
    expect(await performDeleteAccount(client, finish)).toEqual({ ok: true, data: undefined });
    expect(rpc).toHaveBeenCalledWith("request_account_deletion");
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it("does not try the second step if the first fails", async () => {
    const { client } = rpcClient({ message: "not_signed_in" });
    const finish = vi.fn();
    expect((await performDeleteAccount(client, finish)).ok).toBe(false);
    expect(finish).not.toHaveBeenCalled();
  });
  it("says the account is closed when only the second step fails", async () => {
    const { client } = rpcClient();
    const r = await performDeleteAccount(client, vi.fn().mockResolvedValue({ error: new Error("down") }));
    expect(r).toEqual({ ok: false, message: DELETE_FAILED_AFTER_CLOSE, code: "delete_incomplete", closed: true });
  });
});
