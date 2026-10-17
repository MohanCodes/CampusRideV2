import type { Person, RequestCardData, TripCardData, TripDetail, TripState } from "./types";

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
  { id: "t10", dest: "Target (Montclair)", chip: "Target", inHours: 6, backHours: null, total: 3, taken: 0, point: "Platt Campus Center", make: "Kia Soul", color: "Yellow", cost: "Split gas and parking", notes: null, driver: { id: DEMO_ME, firstName: "Riley", campusId: "hmc", classYear: 2027, avatarUrl: null }, status: "open", plate: "DEV1010", stand: "Stand at the front steps.", own: true, lat: 34.106, lng: -117.709 },
];

export function demoTrips(now: Date): TripCardData[] {
  return SEEDS.filter((s) => s.status === "open" && s.inHours > 0 && s.taken < s.total).map((s) => ({
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
  }));
}

export function demoRequests(now: Date): RequestCardData[] {
  return [
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
