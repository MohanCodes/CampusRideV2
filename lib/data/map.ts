import type { MySeatStatus, TripCardData } from "./types";

// The columns a trip card needs, as the board_trips and trip_cards views return them.
export type TripRowLike = {
  id: string; driver_id: string; destination_name: string; departs_at: string; back_by: string | null;
  seats_total: number; seats_left: number; meetup_point_name: string | null; cost_note: string | null; chip: string;
  driver_first_name: string; driver_campus_id: string; driver_class_year: number | null; driver_avatar_path: string | null;
};

export function rowToCard(r: TripRowLike, viewerId: string | undefined, myStatus: MySeatStatus, avatars: Map<string, string>): TripCardData {
  return {
    id: r.id,
    destinationName: r.destination_name,
    chip: r.chip,
    departsAt: r.departs_at,
    backBy: r.back_by,
    seatsLeft: r.seats_left,
    seatsTotal: r.seats_total,
    meetupPointName: r.meetup_point_name ?? "Meetup point",
    costNote: r.cost_note,
    driver: {
      id: r.driver_id,
      firstName: r.driver_first_name,
      campusId: r.driver_campus_id,
      classYear: r.driver_class_year,
      avatarUrl: r.driver_avatar_path ? (avatars.get(r.driver_avatar_path) ?? null) : null,
    },
    isOwn: r.driver_id === viewerId,
    myStatus,
  };
}
