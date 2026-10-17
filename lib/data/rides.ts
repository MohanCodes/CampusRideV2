import "server-only";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { avatarUrls } from "./avatars";
import { loadIncoming, type TripBrief } from "./incoming";
import { rowToCard, type TripRowLike } from "./map";
import { demoInbox, demoOffersInbox, demoRides, demoThreads } from "./mock";
import type { IncomingRequest, MySeatStatus, RideRow, Result, SeatStatus, TripStatus } from "./types";

type TripCardRow = TripRowLike & { status: TripStatus };

// Everything the person is driving, plus every trip they asked to ride on.
export async function getMyRides(): Promise<Result<RideRow[]>> {
  if (isDemo()) return { ok: true, data: demoRides(getNow()) };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const [drivingRes, askedRes] = await Promise.all([
      supabase.from("trip_cards").select("*").eq("driver_id", user.id).order("departs_at"),
      supabase.from("seat_requests").select("trip_id, status").eq("rider_id", user.id),
    ]);
    if (drivingRes.error || askedRes.error) return { ok: false };
    const driving = (drivingRes.data ?? []) as TripCardRow[];
    const asked = askedRes.data ?? [];

    // Trips they asked about. Row-level security decides which of these they may still see.
    const askedIds = asked.map((a) => a.trip_id as string);
    const { data: ridden } = askedIds.length
      ? await supabase.from("trip_cards").select("*").in("id", askedIds)
      : { data: [] as TripCardRow[] };

    // How many requests are waiting on each of their own trips.
    const { data: waiting } = driving.length
      ? await supabase.from("seat_requests").select("trip_id").in("trip_id", driving.map((d) => d.id)).eq("status", "pending")
      : { data: [] as { trip_id: string }[] };
    const pending = new Map<string, number>();
    for (const w of waiting ?? []) pending.set(w.trip_id, (pending.get(w.trip_id) ?? 0) + 1);

    const rows = [...driving, ...((ridden ?? []) as TripCardRow[])];
    const urls = await avatarUrls(supabase, rows.map((r) => r.driver_avatar_path));
    const statusOf = new Map(asked.map((a) => [a.trip_id as string, a.status as SeatStatus]));

    const out: RideRow[] = [
      ...driving.map((r): RideRow => ({
        trip: rowToCard(r, user.id, null, urls), role: "driver", tripStatus: r.status, seatStatus: null, pendingRequests: pending.get(r.id) ?? 0,
      })),
      ...((ridden ?? []) as TripCardRow[])
        .filter((r) => r.driver_id !== user.id)
        .map((r): RideRow => {
          const seat = statusOf.get(r.id) ?? null;
          const mine: MySeatStatus = seat === "pending" || seat === "accepted" || seat === "declined" ? seat : null;
          return { trip: rowToCard(r, user.id, mine, urls), role: "rider", tripStatus: r.status, seatStatus: seat, pendingRequests: 0 };
        }),
    ];
    return { ok: true, data: out };
  } catch {
    return { ok: false };
  }
}

// Seat requests waiting for the person to answer, across all their upcoming trips.
export async function getInbox(): Promise<Result<IncomingRequest[]>> {
  if (isDemo()) return { ok: true, data: demoInbox(getNow()) };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const { data: trips, error } = await supabase
      .from("trip_cards").select("id, destination_name, departs_at, meetup_point_name, seats_left")
      .eq("driver_id", user.id).eq("status", "open").gt("departs_at", getNow().toISOString());
    if (error) return { ok: false };
    if (!trips?.length) return { ok: true, data: [] };

    const { data: rows, error: reqError } = await supabase
      .from("seat_requests").select("id, trip_id, rider_id, seats, message, status, created_at")
      .in("trip_id", trips.map((t) => t.id)).eq("status", "pending").order("created_at");
    if (reqError) return { ok: false };

    const briefs = new Map<string, TripBrief>(trips.map((t) => [t.id as string, t as TripBrief]));
    return { ok: true, data: await loadIncoming(supabase, rows ?? [], briefs) };
  } catch {
    return { ok: false };
  }
}

// The number on the Inbox badge.
export async function getInboxCount(): Promise<number> {
  if (isDemo()) return demoInbox(getNow()).length + demoOffersInbox(getNow()).length + demoThreads(getNow()).reduce((n, t) => n + t.unread, 0);
  try {
    const supabase = await createClient();
    if (!supabase || !(await getUser())) return 0;
    const { data } = await supabase.rpc("inbox_count");
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}
