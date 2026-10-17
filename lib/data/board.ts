import "server-only";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { applyRequestFilters, applyTripFilters } from "./apply";
import { dateRange, type BoardFilters } from "./filters";
import { avatarUrls } from "./avatars";
import { loadIncoming } from "./incoming";
import { rowToCard } from "./map";
import { demoRequests, demoTripDetail, demoTrips, type DemoView, DEMO_VIEWS } from "./mock";
import type { MySeatStatus, Person, RequestCardData, Result, TripCardData, TripDetail, TripState } from "./types";

// Reads for the board and the trip page. In demo mode they return sample data; otherwise they
// query Supabase as the signed-in person, so row-level security decides what comes back.
// Nothing here writes. Any failure comes back as { ok: false } so the screen can show "Try again".

// Characters that mean something inside a PostgREST filter string. Search text never needs them.
const safeSearch = (q: string) => q.replace(/[%,()*\\":]/g, " ").trim();

type BoardTripRow = {
  id: string; driver_id: string; destination_name: string; departs_at: string; back_by: string | null;
  seats_total: number; seats_left: number; meetup_point_name: string | null; cost_note: string | null; chip: string;
  driver_first_name: string; driver_campus_id: string; driver_class_year: number | null; driver_avatar_path: string | null;
};

type BoardRequestRow = {
  id: string; rider_id: string; destination_name: string; window_start: string; window_end: string;
  flexibility: RequestCardData["flexibility"]; seats: number; meetup_point_name: string | null; chip_in: boolean;
  note: string | null; chip: string; rider_first_name: string; rider_campus_id: string;
  rider_class_year: number | null; rider_avatar_path: string | null;
};

export async function listTrips(f: BoardFilters): Promise<Result<TripCardData[]>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: applyTripFilters(demoTrips(now), f, now) };

  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase) return { ok: false };

    const { from, to } = dateRange(f.date, now);
    let query = supabase.from("board_trips").select("*").gte("departs_at", from.toISOString()).order("departs_at");
    if (to) query = query.lt("departs_at", to.toISOString());
    if (f.chip !== "All") query = query.eq("chip", f.chip);
    if (f.campus !== "all") query = query.eq("driver_campus_id", f.campus);
    if (f.minSeats > 1) query = query.gte("seats_left", f.minSeats);
    const text = safeSearch(f.q);
    if (text) {
      query = query.or(
        `destination_name.ilike.%${text}%,meetup_point_name.ilike.%${text}%,driver_first_name.ilike.%${text}%`,
      );
    }
    const { data, error } = await query.limit(200);
    if (error) return { ok: false };
    const rows = (data ?? []) as BoardTripRow[];

    const mine = new Map<string, MySeatStatus>();
    if (user && rows.length) {
      const { data: seats } = await supabase
        .from("seat_requests").select("trip_id, status").eq("rider_id", user.id).in("trip_id", rows.map((r) => r.id));
      for (const s of seats ?? []) {
        if (s.status === "pending" || s.status === "accepted" || s.status === "declined") mine.set(s.trip_id, s.status);
      }
    }
    const urls = await avatarUrls(supabase, rows.map((r) => r.driver_avatar_path));

    return { ok: true, data: rows.map((r) => rowToCard(r, user?.id, mine.get(r.id) ?? null, urls)) };
  } catch {
    return { ok: false };
  }
}

export async function listRequests(f: BoardFilters): Promise<Result<RequestCardData[]>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: applyRequestFilters(demoRequests(now), f, now) };

  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase) return { ok: false };

    const { from, to } = dateRange(f.date, now);
    let query = supabase.from("board_requests").select("*").gte("window_end", from.toISOString()).order("window_start");
    if (to) query = query.lt("window_start", to.toISOString());
    if (f.chip !== "All") query = query.eq("chip", f.chip);
    if (f.campus !== "all") query = query.eq("rider_campus_id", f.campus);
    const text = safeSearch(f.q);
    if (text) {
      query = query.or(
        `destination_name.ilike.%${text}%,meetup_point_name.ilike.%${text}%,rider_first_name.ilike.%${text}%`,
      );
    }
    const { data, error } = await query.limit(200);
    if (error) return { ok: false };
    const rows = (data ?? []) as BoardRequestRow[];
    const urls = await avatarUrls(supabase, rows.map((r) => r.rider_avatar_path));

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        destinationName: r.destination_name,
        chip: r.chip,
        windowStart: r.window_start,
        windowEnd: r.window_end,
        flexibility: r.flexibility,
        seats: r.seats,
        meetupPointName: r.meetup_point_name ?? "Meetup point",
        chipIn: r.chip_in,
        note: r.note,
        rider: {
          id: r.rider_id, firstName: r.rider_first_name, campusId: r.rider_campus_id,
          classYear: r.rider_class_year, avatarUrl: r.rider_avatar_path ? (urls.get(r.rider_avatar_path) ?? null) : null,
        },
        isOwn: r.rider_id === user?.id,
      })),
    };
  } catch {
    return { ok: false };
  }
}

export function parseDemoView(v: string | undefined): DemoView | undefined {
  return isDemo() && DEMO_VIEWS.includes(v as DemoView) ? (v as DemoView) : undefined;
}

// One trip, with the private parts (plate, exact spot) only when the database hands them over.
// `data: null` means no such trip, or one this person isn't allowed to see.
export async function getTripDetail(id: string, demoView?: DemoView): Promise<Result<TripDetail | null>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: demoTripDetail(id, now, demoView) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };

  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, driver_id, place_id, destination_name, departs_at, back_by, seats_total, seats_taken, meetup_point_id, car_make, car_color, cost_note, notes, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false };
    if (!trip) return { ok: true, data: null };

    const [driverRes, pointRes, plateRes, standRes, mineRes, placeRes] = await Promise.all([
      supabase.from("public_profiles").select("id, first_name, campus_id, class_year, avatar_path").eq("id", trip.driver_id).maybeSingle(),
      supabase.from("meetup_points").select("name, lat, lng").eq("id", trip.meetup_point_id).maybeSingle(),
      supabase.from("trip_private").select("car_plate").eq("trip_id", id).maybeSingle(),
      supabase.rpc("get_trip_meetup_detail", { p_trip: id }),
      supabase.from("seat_requests").select("id, status").eq("trip_id", id).eq("rider_id", user.id).maybeSingle(),
      trip.place_id ? supabase.from("places").select("chip").eq("id", trip.place_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const d = driverRes.data;
    const urls = await avatarUrls(supabase, [d?.avatar_path ?? null]);
    const driver: Person = {
      id: trip.driver_id,
      firstName: d?.first_name ?? "Deleted user",
      campusId: d?.campus_id ?? "",
      classYear: d?.class_year ?? null,
      avatarUrl: d?.avatar_path ? (urls.get(d.avatar_path) ?? null) : null,
    };

    const available = trip.status === "open" && new Date(trip.departs_at) > now && trip.seats_taken < trip.seats_total;
    const mine = mineRes.data?.status;
    let state: TripState;
    if (trip.driver_id === user.id) state = "own";
    else if (mine === "accepted") state = "accepted";
    else if (mine === "pending") state = "pending";
    else if (mine === "declined") state = "declined";
    else state = available ? "none" : "unavailable";

    // The driver also sees who asked, with their answers.
    let requests: TripDetail["requests"] = null;
    if (trip.driver_id === user.id) {
      const { data: rows } = await supabase
        .from("seat_requests").select("id, trip_id, rider_id, seats, message, status, created_at")
        .eq("trip_id", id).in("status", ["pending", "accepted"]).order("created_at");
      requests = await loadIncoming(supabase, rows ?? [], new Map([[id, {
        destination_name: trip.destination_name, departs_at: trip.departs_at,
        meetup_point_name: pointRes.data?.name ?? null, seats_left: trip.seats_total - trip.seats_taken,
      }]]));
    }

    return {
      ok: true,
      data: {
        id: trip.id,
        tripStatus: trip.status,
        seatsTaken: trip.seats_taken,
        myRequestId: mineRes.data?.id ?? null,
        requests,
        destinationName: trip.destination_name,
        departsAt: trip.departs_at,
        backBy: trip.back_by,
        seatsLeft: trip.seats_total - trip.seats_taken,
        seatsTotal: trip.seats_total,
        driver,
        carMake: trip.car_make,
        carColor: trip.car_color,
        costNote: trip.cost_note,
        notes: trip.notes,
        meetupPoint: pointRes.data ? { name: pointRes.data.name, lat: pointRes.data.lat, lng: pointRes.data.lng } : null,
        plate: plateRes.data?.car_plate ?? null,
        standAt: typeof standRes.data === "string" ? standRes.data : null,
        state,
        chip: placeRes.data?.chip ?? "Other",
      },
    };
  } catch {
    return { ok: false };
  }
}

// One trip as a board card, for the "your trip is posted" page.
export async function getTripCard(id: string): Promise<Result<TripCardData | null>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: demoTrips(now).find((t) => t.id === id) ?? null };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase) return { ok: false };
    const { data, error } = await supabase.from("board_trips").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false };
    if (!data) return { ok: true, data: null };
    const r = data as BoardTripRow;
    const urls = await avatarUrls(supabase, [r.driver_avatar_path]);
    return { ok: true, data: rowToCard(r, user?.id, null, urls) };
  } catch {
    return { ok: false };
  }
}
