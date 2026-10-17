import type { CampusId } from "@/lib/campuses";

export type Person = {
  id: string;
  firstName: string;
  campusId: CampusId | string;
  classYear: number | null;
  avatarUrl: string | null;
};

export type MySeatStatus = "pending" | "accepted" | "declined" | null;

export type TripCardData = {
  id: string;
  destinationName: string;
  chip: string;
  departsAt: string;
  backBy: string | null;
  seatsLeft: number;
  seatsTotal: number;
  meetupPointName: string;
  costNote: string | null;
  driver: Person;
  isOwn: boolean;
  myStatus: MySeatStatus;
};

export type RequestCardData = {
  id: string;
  destinationName: string;
  chip: string;
  windowStart: string;
  windowEnd: string;
  flexibility: "exact" | "pm30" | "pm60" | "anytime";
  seats: number;
  meetupPointName: string;
  chipIn: boolean;
  note: string | null;
  rider: Person;
  isOwn: boolean;
};

// What the trip page shows, and which action area goes with it.
export type TripState = "none" | "pending" | "accepted" | "declined" | "unavailable" | "own";

// A rider's seat request, as the driver sees it in the Inbox and on their own trip.
export type IncomingRequest = {
  id: string;
  tripId: string;
  tripName: string;
  departsAt: string;
  meetupPointName: string;
  seatsLeft: number;
  rider: Person;
  seats: number;
  message: string | null;
  status: "pending" | "accepted";
  createdAt: string;
};

export type TripStatus = "open" | "cancelled" | "past";
export type SeatStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

// One line in My Rides: a trip the person is driving, or one they asked to ride on.
export type RideRow = {
  trip: TripCardData;
  role: "driver" | "rider";
  tripStatus: TripStatus;
  seatStatus: SeatStatus | null;
  pendingRequests: number;
};

export type TripDetail = {
  id: string;
  tripStatus: TripStatus;
  seatsTaken: number;
  // The rider's own request on this trip, so it can be cancelled.
  myRequestId: string | null;
  // The driver's view of who asked (only filled in for the driver's own trip).
  requests: IncomingRequest[] | null;
  destinationName: string;
  departsAt: string;
  backBy: string | null;
  seatsLeft: number;
  seatsTotal: number;
  driver: Person;
  carMake: string;
  carColor: string;
  costNote: string | null;
  notes: string | null;
  meetupPoint: { name: string; lat: number | null; lng: number | null } | null;
  // Shown only to the driver and accepted riders. The database enforces this; these are null otherwise.
  plate: string | null;
  standAt: string | null;
  state: TripState;
  chip: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false };
