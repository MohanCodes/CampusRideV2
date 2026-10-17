// Whether a driver's trip can answer a rider's request. The same rule send_offer enforces in the
// database (supabase/migrations/20261017000020_in_search_of.sql); this copy lets the "Offer a ride"
// dialog list only trips that will be accepted, so nobody picks one that is bound to be refused.
type Fit = {
  trip: { placeId: string | null; destinationName: string; departsAt: string; seatsLeft: number; status?: string };
  request: { placeId: string | null; destinationName: string; windowStart: string; windowEnd: string; seats: number };
  now: Date;
};

export function tripFitsRequest({ trip, request, now }: Fit): boolean {
  const departs = new Date(trip.departsAt).getTime();
  if (trip.status && trip.status !== "open") return false;
  if (departs <= now.getTime()) return false;
  const samePlace = request.placeId
    ? trip.placeId === request.placeId
    : trip.placeId === null && trip.destinationName.toLowerCase() === request.destinationName.toLowerCase();
  return (
    samePlace &&
    departs >= new Date(request.windowStart).getTime() &&
    departs <= new Date(request.windowEnd).getTime() &&
    trip.seatsLeft >= request.seats
  );
}
