import "server-only";
import { getUser } from "@/lib/auth/dal";
import { getNow, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { avatarUrls } from "./avatars";
import { tripFitsRequest } from "./fit";
import { demoMyRequests, demoOffersInbox, demoRequestDetail, type DemoRequestView, DEMO_REQUEST_VIEWS, type OwnRequestRow } from "./mock";
import type { OfferCardData, OfferStatus, RequestCardData, RequestDetail, RequestStatus, Result, TripOption } from "./types";

type RequestRow = {
  id: string; rider_id: string; place_id: string | null; destination_name: string; window_start: string; window_end: string;
  flexibility: RequestCardData["flexibility"]; seats: number; meetup_point_name: string | null; chip_in: boolean; note: string | null;
  status: RequestStatus; matched_trip_id: string | null; chip: string; rider_first_name: string; rider_campus_id: string;
  rider_class_year: number | null; rider_avatar_path: string | null; pending_offers: number;
};
type OfferRow = {
  id: string; request_id: string; trip_id: string; driver_id: string; status: OfferStatus; message: string | null; created_at: string;
  request_destination: string; destination_name: string; departs_at: string; back_by: string | null; seats_left: number;
  car_make: string; car_color: string; cost_note: string | null; meetup_point_name: string | null;
  driver_first_name: string; driver_campus_id: string; driver_class_year: number | null; driver_avatar_path: string | null;
};

const toRequest = (r: RequestRow, viewerId: string | undefined, urls: Map<string, string>): RequestCardData => ({
  id: r.id, destinationName: r.destination_name, chip: r.chip, windowStart: r.window_start, windowEnd: r.window_end,
  flexibility: r.flexibility, seats: r.seats, meetupPointName: r.meetup_point_name ?? "Meetup point", chipIn: r.chip_in, note: r.note,
  rider: {
    id: r.rider_id, firstName: r.rider_first_name, campusId: r.rider_campus_id, classYear: r.rider_class_year,
    avatarUrl: r.rider_avatar_path ? (urls.get(r.rider_avatar_path) ?? null) : null,
  },
  isOwn: r.rider_id === viewerId,
});

const toOffer = (o: OfferRow, urls: Map<string, string>): OfferCardData => ({
  id: o.id, requestId: o.request_id, tripId: o.trip_id, status: o.status, message: o.message, createdAt: o.created_at,
  driver: {
    id: o.driver_id, firstName: o.driver_first_name, campusId: o.driver_campus_id, classYear: o.driver_class_year,
    avatarUrl: o.driver_avatar_path ? (urls.get(o.driver_avatar_path) ?? null) : null,
  },
  tripName: o.destination_name, departsAt: o.departs_at, backBy: o.back_by, seatsLeft: o.seats_left,
  meetupPointName: o.meetup_point_name ?? "Meetup point", carMake: o.car_make, carColor: o.car_color, costNote: o.cost_note,
  requestName: o.request_destination,
});

export function parseDemoRequestView(v: string | undefined): DemoRequestView | undefined {
  return isDemo() && DEMO_REQUEST_VIEWS.includes(v as DemoRequestView) ? (v as DemoRequestView) : undefined;
}

// One request. A rider sees it with its offers; a driver sees it with their own trips that fit.
export async function getRequestDetail(id: string, demoView?: DemoRequestView): Promise<Result<RequestDetail | null>> {
  const now = getNow();
  if (isDemo()) return { ok: true, data: demoRequestDetail(id, now, demoView) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };

    const { data, error } = await supabase.from("request_cards").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false };
    if (!data) return { ok: true, data: null };
    const r = data as RequestRow;
    const isOwn = r.rider_id === user.id;

    let offers: OfferCardData[] = [];
    let myOffer: OfferCardData | null = null;
    let tripOptions: TripOption[] = [];

    const { data: offerRows, error: offerError } = await supabase
      .from("offer_cards").select("*").eq("request_id", id).order("created_at");
    if (offerError) return { ok: false };
    const rows = (offerRows ?? []) as OfferRow[];
    const urls = await avatarUrls(supabase, [r.rider_avatar_path, ...rows.map((o) => o.driver_avatar_path)]);
    if (isOwn) offers = rows.map((o) => toOffer(o, urls));
    else myOffer = rows.filter((o) => o.driver_id === user.id).map((o) => toOffer(o, urls))[0] ?? null;

    if (!isOwn && r.status === "open") {
      const { data: trips } = await supabase
        .from("trip_cards").select("id, place_id, destination_name, departs_at, seats_left, meetup_point_name, status")
        .eq("driver_id", user.id).eq("status", "open").gt("departs_at", now.toISOString());
      const offered = new Set(rows.filter((o) => o.driver_id === user.id && o.status === "pending").map((o) => o.trip_id));
      tripOptions = (trips ?? [])
        .filter((t) => !offered.has(t.id as string))
        .filter((t) => tripFitsRequest({
          trip: { placeId: t.place_id as string | null, destinationName: t.destination_name as string, departsAt: t.departs_at as string, seatsLeft: t.seats_left as number, status: t.status as string },
          request: { placeId: r.place_id, destinationName: r.destination_name, windowStart: r.window_start, windowEnd: r.window_end, seats: r.seats },
          now,
        }))
        .map((t) => ({ id: t.id as string, destinationName: t.destination_name as string, departsAt: t.departs_at as string, seatsLeft: t.seats_left as number, meetupPointName: (t.meetup_point_name as string | null) ?? "Meetup point" }));
    }

    return {
      ok: true,
      data: { request: toRequest(r, user.id, urls), status: r.status, isOwn, pendingOffers: r.pending_offers, matchedTripId: r.matched_trip_id, offers, tripOptions, myOffer },
    };
  } catch {
    return { ok: false };
  }
}

// The person's own requests, newest first, for My Rides.
export async function getMyRequests(): Promise<Result<OwnRequestRow[]>> {
  if (isDemo()) return { ok: true, data: demoMyRequests(getNow()) };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };
    const { data, error } = await supabase.from("request_cards").select("*").eq("rider_id", user.id).order("created_at", { ascending: false });
    if (error) return { ok: false };
    const rows = (data ?? []) as RequestRow[];
    const urls = await avatarUrls(supabase, rows.map((r) => r.rider_avatar_path));
    return { ok: true, data: rows.map((r) => ({ request: toRequest(r, user.id, urls), status: r.status, pendingOffers: r.pending_offers, matchedTripId: r.matched_trip_id })) };
  } catch {
    return { ok: false };
  }
}

// Offers waiting for the person's answer, across all their open requests.
export async function getOffersInbox(): Promise<Result<OfferCardData[]>> {
  if (isDemo()) return { ok: true, data: demoOffersInbox(getNow()) };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!supabase || !user) return { ok: false };
    const { data, error } = await supabase.from("offer_cards").select("*").eq("rider_id", user.id).eq("status", "pending").order("created_at");
    if (error) return { ok: false };
    const rows = (data ?? []) as OfferRow[];
    const urls = await avatarUrls(supabase, rows.map((o) => o.driver_avatar_path));
    return { ok: true, data: rows.map((o) => toOffer(o, urls)) };
  } catch {
    return { ok: false };
  }
}
