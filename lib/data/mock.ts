import type { ChatMessage, ChatThread, Conversation, IncomingRequest, OfferCardData, Person, RequestDetail, RequestCardData, RideRow, TripCardData, TripDetail, TripState } from "./types";

// Sample data for demo mode. It mirrors supabase/seed_dev.sql (the same people, places and
// timing), but none of it is real. Times are relative to `now` so the board always looks current.

const H = 3600_000;
const iso = (now: Date, hours: number) => new Date(now.getTime() + hours * H).toISOString();

export const DEMO_ME = "demo-me";

const maya: Person = { id: "d1", firstName: "Maya", campusId: "hmc", classYear: 2027, avatarUrl: null };
const alex: Person = { id: "d2", firstName: "Alex", campusId: "pomona", classYear: 2028, avatarUrl: null };
const sam: Person = { id: "d3", firstName: "Sam", campusId: "scripps", classYear: 2026, avatarUrl: null };
const jordan: Person = { id: "d4", firstName: "Jordan", campusId: "cmc", classYear: 2029, avatarUrl: null };
const riley: Person = { id: "d5", firstName: "Riley", campusId: "pitzer", classYear: 2027, avatarUrl: null };

type TripSeed = {
  id: string; dest: string; chip: string; inHours: number; backHours: number | null; total: number; taken: number;
  point: string; make: string; color: string; cost: string | null; notes: string | null; driver: Person;
  status: "open" | "cancelled" | "past"; plate: string; stand: string;
  mine?: "pending" | "accepted" | "declined"; own?: boolean; lat: number; lng: number;
};

const SEEDS: TripSeed[] = [
  { id: "t1", dest: "Trader Joe's", chip: "Trader Joe's", inHours: 3, backHours: 5, total: 3, taken: 1, point: "Platt Campus Center", make: "Honda Civic", color: "Blue", cost: "Split gas and parking", notes: "Room for grocery bags.", driver: maya, status: "open", plate: "DEV1001", stand: "Stand at the front steps.", lat: 34.106, lng: -117.709 },
  { id: "t2", dest: "Target (Montclair)", chip: "Target", inHours: 24, backHours: 27, total: 4, taken: 0, point: "Smith Campus Center", make: "Toyota RAV4", color: "White", cost: null, notes: null, driver: alex, status: "open", plate: "DEV1002", stand: "Stand by the fountain.", mine: "pending", lat: 34.0975, lng: -117.711 },
  { id: "t3", dest: "Ontario International Airport (ONT)", chip: "Airport (ONT)", inHours: 48, backHours: null, total: 3, taken: 2, point: "Balch Hall", make: "Subaru Outback", color: "Green", cost: "Split gas, about $5 each", notes: "One carry-on each please.", driver: sam, status: "open", plate: "DEV1003", stand: "Stand at the entrance gate.", mine: "accepted", lat: 34.1, lng: -117.71 },
  { id: "t4", dest: "Claremont Farmers Market (Sundays 8am-1pm)", chip: "The Village", inHours: 96, backHours: 99, total: 2, taken: 0, point: "Honnold/Mudd Library", make: "Mazda 3", color: "Red", cost: null, notes: null, driver: jordan, status: "open", plate: "DEV1004", stand: "Stand by the bike racks.", lat: 34.102, lng: -117.7115 },
  { id: "t5", dest: "Los Angeles International Airport (LAX)", chip: "LA / LAX", inHours: 120, backHours: null, total: 3, taken: 0, point: "Smith Campus Center", make: "Ford Escape", color: "Gray", cost: "Split gas and parking", notes: null, driver: riley, status: "open", plate: "DEV1005", stand: "Stand by the fountain.", lat: 34.0975, lng: -117.711 },
  { id: "t6", dest: "Trader Joe's", chip: "Trader Joe's", inHours: 28, backHours: null, total: 2, taken: 2, point: "Hoch-Shanahan Dining Commons", make: "Honda Civic", color: "Blue", cost: null, notes: "Already full.", driver: maya, status: "open", plate: "DEV1006", stand: "Stand at the main doors.", lat: 34.1062, lng: -117.7092 },
  { id: "t7", dest: "Ontario Mills", chip: "Other", inHours: 72, backHours: null, total: 3, taken: 0, point: "Smith Campus Center", make: "Ford Escape", color: "Gray", cost: null, notes: "An \"Other\" destination.", driver: riley, status: "open", plate: "DEV1009", stand: "Stand by the fountain.", lat: 34.0975, lng: -117.711 },
  { id: "t8", dest: "Claremont Village", chip: "The Village", inHours: 53, backHours: null, total: 3, taken: 0, point: "Smith Campus Center", make: "Toyota RAV4", color: "White", cost: null, notes: null, driver: alex, status: "cancelled", plate: "DEV1007", stand: "Stand by the fountain.", lat: 34.0975, lng: -117.711 },
  { id: "t9", dest: "Target (Upland)", chip: "Target", inHours: -24, backHours: null, total: 3, taken: 1, point: "Smith Campus Center", make: "Mazda 3", color: "Red", cost: null, notes: null, driver: jordan, status: "past", plate: "DEV1008", stand: "Stand by the fountain.", lat: 34.0975, lng: -117.711 },
  { id: "t10", dest: "Target (Montclair)", chip: "Target", inHours: 6, backHours: null, total: 3, taken: 1, point: "Platt Campus Center", make: "Kia Soul", color: "Yellow", cost: "Split gas and parking", notes: null, driver: { id: DEMO_ME, firstName: "Riley", campusId: "hmc", classYear: 2027, avatarUrl: null }, status: "open", plate: "DEV1010", stand: "Stand at the front steps.", own: true, lat: 34.106, lng: -117.709 },
  { id: "t11", dest: "Claremont Village", chip: "The Village", inHours: 30, backHours: null, total: 3, taken: 0, point: "Platt Campus Center", make: "Kia Soul", color: "Yellow", cost: null, notes: null, driver: { id: DEMO_ME, firstName: "Riley", campusId: "hmc", classYear: 2027, avatarUrl: null }, status: "cancelled", plate: "DEV1011", stand: "Stand at the front steps.", own: true, lat: 34.106, lng: -117.709 },
  { id: "t12", dest: "Target (Upland)", chip: "Target", inHours: -30, backHours: null, total: 3, taken: 2, point: "Platt Campus Center", make: "Kia Soul", color: "Yellow", cost: null, notes: null, driver: { id: DEMO_ME, firstName: "Riley", campusId: "hmc", classYear: 2027, avatarUrl: null }, status: "past", plate: "DEV1012", stand: "Stand at the front steps.", own: true, lat: 34.106, lng: -117.709 },
  { id: "t13", dest: "Trader Joe's", chip: "Trader Joe's", inHours: 60, backHours: null, total: 2, taken: 2, point: "Hoch-Shanahan Dining Commons", make: "Mazda 3", color: "Red", cost: null, notes: null, driver: jordan, status: "open", plate: "DEV1013", stand: "Stand at the main doors.", mine: "declined", lat: 34.1062, lng: -117.7092 },
];

const cardOf = (s: TripSeed, now: Date): TripCardData => ({
  id: s.id,
  destinationName: s.dest,
  chip: s.chip,
  departsAt: iso(now, s.inHours),
  backBy: s.backHours == null ? null : iso(now, s.backHours),
  seatsLeft: s.total - s.taken,
  seatsTotal: s.total,
  meetupPointName: s.point,
  costNote: s.cost,
  driver: s.driver,
  isOwn: Boolean(s.own),
  myStatus: s.mine ?? null,
});

export function demoTrips(now: Date): TripCardData[] {
  return SEEDS.filter((s) => s.status === "open" && s.inHours > 0 && s.taken < s.total).map((s) => cardOf(s, now));
}

// Requests on the demo viewer's own trip (t10): two waiting and one already accepted.
export function demoOwnRequests(now: Date): IncomingRequest[] {
  const t = SEEDS.find((x) => x.id === "t10")!;
  const base = { tripId: t.id, tripName: t.dest, departsAt: iso(now, t.inHours), meetupPointName: t.point, seatsLeft: t.total - t.taken };
  return [
    { ...base, id: "q1", rider: alex, seats: 1, message: "Hi, I just need Target and back, no big bags.", status: "pending", createdAt: iso(now, -2) },
    { ...base, id: "q2", rider: sam, seats: 2, message: null, status: "pending", createdAt: iso(now, -1) },
    { ...base, id: "q3", rider: jordan, seats: 1, message: null, status: "accepted", createdAt: iso(now, -5), conversationId: "c2" },
  ];
}

export const demoInbox = (now: Date): IncomingRequest[] => demoOwnRequests(now).filter((r) => r.status === "pending");

// My Rides for the demo viewer: three trips they drive and four they asked to ride on.
export function demoRides(now: Date): RideRow[] {
  const driving: RideRow[] = ["t10", "t11", "t12"].map((id) => {
    const s = SEEDS.find((x) => x.id === id)!;
    return { trip: cardOf(s, now), role: "driver", tripStatus: s.status, seatStatus: null, pendingRequests: id === "t10" ? 2 : 0 };
  });
  const riding: RideRow[] = [
    { id: "t2", seat: "pending" }, { id: "t3", seat: "accepted" }, { id: "t13", seat: "declined" }, { id: "t9", seat: "accepted" },
  ].map(({ id, seat }) => {
    const s = SEEDS.find((x) => x.id === id)!;
    return { trip: { ...cardOf(s, now), myStatus: seat as "pending" | "accepted" | "declined" }, role: "rider", tripStatus: s.status, seatStatus: seat as "pending" | "accepted" | "declined", pendingRequests: 0 };
  });
  return [...driving, ...riding];
}

// The demo viewer's own open request, which has offers waiting.
const OWN_REQUEST = (now: Date): RequestCardData => ({
  id: "r4", destinationName: "Trader Joe's", chip: "Trader Joe's", windowStart: iso(now, 30), windowEnd: iso(now, 32), flexibility: "pm60",
  seats: 1, meetupPointName: "Platt Campus Center", chipIn: true, note: "Two grocery bags.", rider: DEMO_ME_PERSON, isOwn: true,
});

export function demoRequests(now: Date): RequestCardData[] {
  return [
    OWN_REQUEST(now),
    { id: "r1", destinationName: "Trader Joe's", chip: "Trader Joe's", windowStart: iso(now, 24), windowEnd: iso(now, 25), flexibility: "pm30", seats: 1, meetupPointName: "Smith Campus Center", chipIn: true, note: "Just a few bags.", rider: jordan, isOwn: false },
    { id: "r2", destinationName: "Ontario International Airport (ONT)", chip: "Airport (ONT)", windowStart: iso(now, 72), windowEnd: iso(now, 84), flexibility: "anytime", seats: 2, meetupPointName: "Smith Campus Center", chipIn: true, note: null, rider: riley, isOwn: false },
    { id: "r3", destinationName: "Rancho Santa Ana Botanic Garden", chip: "Other", windowStart: iso(now, 48), windowEnd: iso(now, 50), flexibility: "pm60", seats: 1, meetupPointName: "Smith Campus Center", chipIn: false, note: null, rider: alex, isOwn: false },
  ];
}

export type DemoView = "none" | "pending" | "accepted" | "declined" | "unavailable" | "own";
export const DEMO_VIEWS: DemoView[] = ["none", "pending", "accepted", "declined", "unavailable", "own"];

// `view` lets someone judge every state of the trip page by adding ?as=pending (and so on) in demo mode.
export function demoTripDetail(id: string, now: Date, view?: DemoView): TripDetail | null {
  const s = SEEDS.find((x) => x.id === id);
  if (!s) return null;
  let state: TripState = s.own ? "own" : s.mine ?? "none";
  if (s.status !== "open" || s.inHours <= 0 || s.taken >= s.total) state = s.mine === "accepted" ? "accepted" : "unavailable";
  if (view) state = view;
  const reveal = state === "accepted" || state === "own";
  return {
    id: s.id,
    tripStatus: s.status,
    seatsTaken: s.taken,
    myRequestId: state === "pending" || state === "accepted" ? "demo-request" : null,
    conversationId: state === "accepted" ? "c1" : null,
    requests: state === "own" ? demoOwnRequests(now) : null,
    destinationName: s.dest,
    departsAt: iso(now, s.inHours),
    backBy: s.backHours == null ? null : iso(now, s.backHours),
    seatsLeft: s.total - s.taken,
    seatsTotal: s.total,
    driver: s.driver,
    carMake: s.make,
    carColor: s.color,
    costNote: s.cost,
    notes: s.notes,
    meetupPoint: { name: s.point, lat: s.lat, lng: s.lng },
    plate: reveal ? s.plate : null,
    standAt: reveal ? s.stand : null,
    state,
    chip: s.chip,
  };
}

// Chat -----------------------------------------------------------------------------------------------
// c1: the rider side (Sam is driving, with one unread message). c2: the driver side (Jordan is a rider).
// c3: a chat that closed because the trip was over a day ago.
const meMsg = (id: number, body: string, at: string): ChatMessage => ({ id, senderId: DEMO_ME, body, kind: "user", createdAt: at });
const themMsg = (id: number, who: Person, body: string, at: string): ChatMessage => ({ id, senderId: who.id, body, kind: "user", createdAt: at });
const sysMsg = (id: number, who: Person, body: string, at: string): ChatMessage => ({ id, senderId: who.id, body, kind: "system", createdAt: at });

export function demoConversation(id: string, now: Date): Conversation | null {
  const t3 = SEEDS.find((x) => x.id === "t3")!;
  const t10 = SEEDS.find((x) => x.id === "t10")!;
  const t12 = SEEDS.find((x) => x.id === "t12")!;
  if (id === "c1") {
    return {
      id, tripId: "t3", tripName: t3.dest, departsAt: iso(now, t3.inHours), other: sam, open: true, closedReason: null,
      messages: [
        sysMsg(1, sam, "Sam accepted Riley. You can plan the pickup here.", iso(now, -20)),
        themMsg(2, sam, "Hi! I'll be in a green Subaru Outback.", iso(now, -19)),
        meMsg(3, "Great, see you at Balch Hall.", iso(now, -18)),
        themMsg(4, sam, "Running 5 min late, sorry!", iso(now, -1)),
      ],
    };
  }
  if (id === "c2") {
    return {
      id, tripId: "t10", tripName: t10.dest, departsAt: iso(now, t10.inHours), other: jordan, open: true, closedReason: null,
      messages: [
        sysMsg(1, DEMO_ME_PERSON, "Riley accepted Jordan. You can plan the pickup here.", iso(now, -5)),
        themMsg(2, jordan, "Thanks for the ride. I only have a backpack.", iso(now, -4)),
        meMsg(3, "No problem. Platt steps at 6:55?", iso(now, -3.5)),
      ],
    };
  }
  if (id === "c3") {
    return {
      id, tripId: "t12", tripName: t12.dest, departsAt: iso(now, t12.inHours), other: alex, open: false, closedReason: "time",
      messages: [
        sysMsg(1, DEMO_ME_PERSON, "Riley accepted Alex. You can plan the pickup here.", iso(now, -50)),
        meMsg(2, "Meet at the front steps.", iso(now, -49)),
        themMsg(3, alex, "I'm here.", iso(now, -31)),
      ],
    };
  }
  return null;
}

const DEMO_ME_PERSON: Person = { id: DEMO_ME, firstName: "Riley", campusId: "hmc", classYear: 2027, avatarUrl: null };

export function demoThreads(now: Date): ChatThread[] {
  return ["c1", "c2", "c3"].map((id) => {
    const c = demoConversation(id, now)!;
    const last = c.messages[c.messages.length - 1];
    const unread = c.messages.filter((m) => m.kind === "user" && m.senderId !== DEMO_ME && id === "c1" && m.id === 4).length;
    return {
      id, tripId: c.tripId, tripName: c.tripName, departsAt: c.departsAt,
      closesAt: new Date(new Date(c.departsAt).getTime() + 24 * 3600_000).toISOString(),
      other: c.other, lastBody: last.body, lastAt: last.createdAt, lastKind: last.kind, lastFromMe: last.senderId === DEMO_ME, unread,
    };
  }).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

// "In search of" detail -------------------------------------------------------------------------------------
function demoOffers(now: Date): OfferCardData[] {
  const base = { requestId: "r4", tripName: "Trader Joe's", requestName: "Trader Joe's" };
  return [
    { ...base, id: "of1", tripId: "t1", status: "pending", message: "Happy to take you, I have room for bags.", createdAt: iso(now, -3), driver: maya,
      departsAt: iso(now, 31), backBy: iso(now, 33), seatsLeft: 2, meetupPointName: "Platt Campus Center", carMake: "Honda Civic", carColor: "Blue", costNote: "Split gas and parking" },
    { ...base, id: "of2", tripId: "t15", status: "pending", message: null, createdAt: iso(now, -2), driver: jordan,
      departsAt: iso(now, 30.5), backBy: null, seatsLeft: 3, meetupPointName: "Smith Campus Center", carMake: "Mazda 3", carColor: "Red", costNote: null },
    { ...base, id: "of3", tripId: "t16", status: "declined", message: "I can leave a bit earlier.", createdAt: iso(now, -6), driver: alex,
      departsAt: iso(now, 29), backBy: null, seatsLeft: 1, meetupPointName: "Smith Campus Center", carMake: "Toyota RAV4", carColor: "White", costNote: null },
  ];
}
export const demoOffersInbox = (now: Date): OfferCardData[] => demoOffers(now).filter((o) => o.status === "pending");

export type DemoRequestView = "own" | "driver" | "matched" | "cancelled" | "offered";
export const DEMO_REQUEST_VIEWS: DemoRequestView[] = ["own", "driver", "matched", "cancelled", "offered"];

// r4 is the viewer's own request (default "own"). Any other request is seen as a driver who could answer it.
export function demoRequestDetail(id: string, now: Date, view?: DemoRequestView): RequestDetail | null {
  const request = demoRequests(now).find((r) => r.id === id);
  if (!request) return null;
  const mode: DemoRequestView = view ?? (request.isOwn ? "own" : "driver");
  const own = mode === "own" || mode === "matched" || mode === "cancelled";
  const status = mode === "matched" ? "matched" : mode === "cancelled" ? "cancelled" : "open";
  const offers = demoOffers(now).map((o) => ({ ...o, requestId: id }));
  return {
    request: { ...request, isOwn: own },
    status,
    isOwn: own,
    pendingOffers: own && status === "open" ? offers.filter((o) => o.status === "pending").length : 0,
    matchedTripId: status === "matched" ? "t1" : null,
    offers: own ? (status === "open" ? offers : offers.map((o) => (o.status === "pending" ? { ...o, status: o.id === "of1" && status === "matched" ? "accepted" : "closed" } : o))) : [],
    tripOptions: !own
      ? [
          { id: "t20", destinationName: request.destinationName, departsAt: request.windowStart, seatsLeft: 2, meetupPointName: "Platt Campus Center" },
          { id: "t21", destinationName: request.destinationName, departsAt: request.windowEnd, seatsLeft: 3, meetupPointName: "Honnold/Mudd Library" },
        ]
      : [],
    myOffer: mode === "offered" ? { ...offers[0], id: "of9", driver: DEMO_ME_PERSON, requestId: id, status: "pending", message: "I can take you." } : null,
  };
}

export type OwnRequestRow = { request: RequestCardData; status: "open" | "matched" | "expired" | "cancelled"; pendingOffers: number; matchedTripId: string | null };
export function demoMyRequests(now: Date): OwnRequestRow[] {
  const mk = (id: string, dest: string, chip: string, start: number, end: number): RequestCardData => ({
    id, destinationName: dest, chip, windowStart: iso(now, start), windowEnd: iso(now, end), flexibility: "pm60", seats: 1,
    meetupPointName: "Platt Campus Center", chipIn: true, note: null, rider: DEMO_ME_PERSON, isOwn: true,
  });
  return [
    { request: OWN_REQUEST(now), status: "open", pendingOffers: 2, matchedTripId: null },
    { request: mk("r5", "Ontario Mills", "Other", 10, 12), status: "cancelled", pendingOffers: 0, matchedTripId: null },
    { request: mk("r6", "Claremont Village", "The Village", -30, -28), status: "expired", pendingOffers: 0, matchedTripId: null },
  ];
}
