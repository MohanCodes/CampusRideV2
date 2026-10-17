import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  performAdminAddPoint, performAdminRemove, performAdminSetPointStatus, performAdminSetStatus, performAdminSuspend, performAdminUnsuspend,
  performAdminUpdatePoint, performAdminWarn, performBlock, performFileReport, performNoShow, performUnblock,
} from "./moderation";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
function stub(error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("performFileReport", () => {
  it("files a report with the cleaned-up input", async () => {
    const { client, rpc } = stub();
    expect(await performFileReport(client, { targetType: "trip", targetId: A, reason: "Unsafe driving", details: " fast " })).toEqual({ ok: true, data: undefined });
    expect(rpc).toHaveBeenCalledWith("file_report", { p_type: "trip", p_target: A, p_reason: "Unsafe driving", p_details: "fast", p_trip: null });
  });
  it("passes the trip as context and sends null for empty details", async () => {
    const { client, rpc } = stub();
    await performFileReport(client, { targetType: "user", targetId: A, tripId: B, reason: "Other" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_trip: B, p_details: null });
  });
  it("refuses a missing reason before it reaches the database, naming the field", async () => {
    const { client, rpc } = stub();
    const r = await performFileReport(client, { targetType: "trip", targetId: A, reason: "" });
    expect(r).toMatchObject({ ok: false, message: "Pick a reason." });
    expect(r.ok === false && r.fields?.reason).toBe("Pick a reason.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("says plainly when the target can't be reported", async () => {
    const { client } = stub({ message: "invalid_target" });
    expect(await performFileReport(client, { targetType: "user", targetId: A, reason: "Other" })).toMatchObject({ ok: false, message: "We couldn't find that to report." });
  });
  it("says to wait when the report limit trips", async () => {
    const { client } = stub({ message: "rate_limited" });
    expect(await performFileReport(client, { targetType: "user", targetId: A, reason: "Other" })).toMatchObject({ ok: false, message: "Too many tries. Wait a bit, then try again." });
  });
});

describe("block, unblock, no-show", () => {
  it("call their functions", async () => {
    const b = stub(); await performBlock(b.client, { userId: A });
    expect(b.rpc).toHaveBeenCalledWith("block_user", { p_user: A });
    const u = stub(); await performUnblock(u.client, { userId: A });
    expect(u.rpc).toHaveBeenCalledWith("unblock_user", { p_user: A });
    const n = stub(); await performNoShow(n.client, { tripId: A, riderId: B });
    expect(n.rpc).toHaveBeenCalledWith("mark_no_show", { p_trip: A, p_rider: B });
  });
  it("refuse a malformed id", async () => {
    const { client, rpc } = stub();
    expect((await performBlock(client, { userId: "x" })).ok).toBe(false);
    expect((await performNoShow(client, { tripId: A })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("explain a no-show filed too early", async () => {
    const { client } = stub({ message: "too_early" });
    expect(await performNoShow(client, { tripId: A, riderId: B })).toMatchObject({ ok: false, message: "You can report a no-show after the departure time." });
  });
});

describe("admin actions", () => {
  it("set a report's status", async () => {
    const { client, rpc } = stub();
    await performAdminSetStatus(client, { reportId: A, status: "dismissed" });
    expect(rpc).toHaveBeenCalledWith("admin_set_report_status", { p_report: A, p_status: "dismissed" });
    expect((await performAdminSetStatus(client, { reportId: A, status: "banned" })).ok).toBe(false);
  });
  it("warn, suspend, and remove, passing the report that prompted them", async () => {
    const w = stub(); await performAdminWarn(w.client, { userId: A, reportId: B });
    expect(w.rpc).toHaveBeenCalledWith("admin_warn_user", { p_user: A, p_report: B });
    const s = stub(); await performAdminSuspend(s.client, { userId: A, reportId: B, days: "7" });
    expect(s.rpc).toHaveBeenCalledWith("admin_suspend_user", { p_user: A, p_days: 7, p_report: B });
    const r = stub(); await performAdminRemove(r.client, { userId: A });
    expect(r.rpc).toHaveBeenCalledWith("admin_remove_account", { p_user: A, p_report: null });
    const u = stub(); await performAdminUnsuspend(u.client, { userId: A });
    expect(u.rpc).toHaveBeenCalledWith("admin_unsuspend_user", { p_user: A });
  });
  it("accept only a 7 or 30 day suspension", async () => {
    const { client, rpc } = stub();
    expect(await performAdminSuspend(client, { userId: A, days: "14" })).toMatchObject({ ok: false, message: "A suspension is 7 or 30 days." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuse when the database says the person is not an admin", async () => {
    const { client } = stub({ message: "forbidden" });
    expect(await performAdminWarn(client, { userId: A })).toMatchObject({ ok: false, message: "You can't do that." });
  });
  it("add and update a meetup point, and change its status", async () => {
    const add = stub();
    await performAdminAddPoint(add.client, { campusId: "hmc", name: "Platt Campus Center", type: "hub", lat: "34.106", lng: "-117.709", shared: "on", standAt: "Front steps" });
    expect(add.rpc).toHaveBeenCalledWith("admin_add_meetup_point", { p_campus: "hmc", p_name: "Platt Campus Center", p_type: "hub", p_lat: 34.106, p_lng: -117.709, p_shared: true, p_stand_at: "Front steps" });
    const up = stub();
    await performAdminUpdatePoint(up.client, { pointId: A, name: "Platt", type: "hub", lat: "34.1", lng: "-117.7", standAt: "Doors" });
    expect(up.rpc.mock.calls[0][1]).toMatchObject({ p_id: A, p_shared: false });
    const st = stub(); await performAdminSetPointStatus(st.client, { pointId: A, status: "retired" });
    expect(st.rpc).toHaveBeenCalledWith("admin_set_meetup_status", { p_id: A, p_status: "retired" });
  });
  it("refuse a meetup point with coordinates outside Southern California", async () => {
    const { client, rpc } = stub();
    const r = await performAdminAddPoint(client, { campusId: "hmc", name: "A point", type: "hub", lat: "34.1", lng: "117.7", standAt: "here" });
    expect(r).toMatchObject({ ok: false, message: "That longitude is outside Southern California." });
    expect(rpc).not.toHaveBeenCalled();
  });
});
