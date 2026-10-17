import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarUrls } from "./avatars";
import type { IncomingRequest } from "./types";

export type SeatRequestRow = {
  id: string; trip_id: string; rider_id: string; seats: number; message: string | null;
  status: string; created_at: string;
};
export type TripBrief = { destination_name: string; departs_at: string; meetup_point_name: string | null; seats_left: number };

// Adds each rider's public profile (first name, college, photo only) to a driver's seat requests.
export async function loadIncoming(
  supabase: SupabaseClient, rows: SeatRequestRow[], trips: Map<string, TripBrief>,
): Promise<IncomingRequest[]> {
  if (rows.length === 0) return [];
  const riderIds = [...new Set(rows.map((r) => r.rider_id))];
  const { data: people } = await supabase
    .from("public_profiles").select("id, first_name, campus_id, class_year, avatar_path").in("id", riderIds);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const urls = await avatarUrls(supabase, (people ?? []).map((p) => p.avatar_path as string | null));

  return rows.flatMap((r) => {
    const trip = trips.get(r.trip_id);
    if (!trip || (r.status !== "pending" && r.status !== "accepted")) return [];
    const p = byId.get(r.rider_id);
    return [{
      id: r.id,
      tripId: r.trip_id,
      tripName: trip.destination_name,
      departsAt: trip.departs_at,
      meetupPointName: trip.meetup_point_name ?? "Meetup point",
      seatsLeft: trip.seats_left,
      rider: {
        id: r.rider_id,
        firstName: (p?.first_name as string | undefined) ?? "Deleted user",
        campusId: (p?.campus_id as string | undefined) ?? "",
        classYear: (p?.class_year as number | null | undefined) ?? null,
        avatarUrl: p?.avatar_path ? (urls.get(p.avatar_path as string) ?? null) : null,
      },
      seats: r.seats,
      message: r.message,
      status: r.status as "pending" | "accepted",
      createdAt: r.created_at,
    }];
  });
}
