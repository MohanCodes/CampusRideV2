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

export type TripDetail = {
  id: string;
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
