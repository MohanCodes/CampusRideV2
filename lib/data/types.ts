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
  // The chat with this rider, once accepted.
  conversationId?: string | null;
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
  // The chat with the driver, once the rider is accepted.
  conversationId: string | null;
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

// Chat -----------------------------------------------------------------------------------------------
export type ChatMessage = {
  id: number;
  senderId: string;
  body: string;
  kind: "user" | "system";
  createdAt: string;
};

// One line in the Inbox "Chats" list.
export type ChatThread = {
  id: string;
  tripId: string;
  tripName: string;
  departsAt: string;
  closesAt: string;
  other: Person;
  lastBody: string | null;
  lastAt: string | null;
  lastKind: "user" | "system" | null;
  lastFromMe: boolean;
  unread: number;
};

export type Conversation = {
  id: string;
  tripId: string;
  tripName: string;
  departsAt: string;
  other: Person;
  messages: ChatMessage[];
  // Whether the person can still send: the chat hasn't closed, the trip is on, and the seat is accepted.
  open: boolean;
  closedReason: "time" | "trip_cancelled" | "seat_cancelled" | null;
};

// In search of -------------------------------------------------------------------------------------------
export type RequestStatus = "open" | "matched" | "expired" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn" | "expired" | "closed";

export type OfferCardData = {
  id: string;
  requestId: string;
  tripId: string;
  status: OfferStatus;
  message: string | null;
  createdAt: string;
  driver: Person;
  tripName: string;
  departsAt: string;
  backBy: string | null;
  seatsLeft: number;
  meetupPointName: string;
  carMake: string;
  carColor: string;
  costNote: string | null;
  // For the Inbox, where offers from several requests mix.
  requestName?: string;
};

// A trip of the driver's that could answer a request.
export type TripOption = {
  id: string;
  destinationName: string;
  departsAt: string;
  seatsLeft: number;
  meetupPointName: string;
};

export type RequestDetail = {
  request: RequestCardData;
  status: RequestStatus;
  isOwn: boolean;
  pendingOffers: number;
  matchedTripId: string | null;
  // The rider's view: offers waiting, and the ones already answered.
  offers: OfferCardData[];
  // The driver's view: their own trips that fit, and any offer they already made.
  tripOptions: TripOption[];
  myOffer: OfferCardData | null;
};
