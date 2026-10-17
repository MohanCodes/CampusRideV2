import { describe, expect, it } from "vitest";
import { postTripSchema } from "./post";

const valid = {
  destinationKind: "place", placeId: "tj-claremont", date: "2026-10-18", time: "15:30", seats: "3",
  meetupPointId: "00000000-0000-4000-8000-000000000001", carMake: "Honda", carColor: "Blue", carPlate: " abc 123 ",
};
const issues = (v: object) => {
  const r = postTripSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]);
};

describe("postTripSchema", () => {
  it("accepts a complete form and tidies it", () => {
    const r = postTripSchema.parse(valid);
    expect(r.seats).toBe(3);
    expect(r.carPlate).toBe("ABC 123");
    expect(r.costNote).toBe("");
  });
  it("needs a destination of the right kind", () => {
    expect(issues({ ...valid, placeId: "" })).toContainEqual(["destination", "Pick where you're going."]);
    expect(issues({ ...valid, destinationKind: "other", placeId: "", mapboxId: "" })).toContainEqual(["destination", "Pick where you're going."]);
    expect(issues({ ...valid, destinationKind: "other", placeId: "", mapboxId: "poi.1" })).toEqual([]);
  });
  it("needs a real date, time, seat count, and meetup point", () => {
    expect(issues({ ...valid, date: "" })).toContainEqual(["date", "Pick a date."]);
    expect(issues({ ...valid, time: "3pm" })).toContainEqual(["time", "Pick a time."]);
    expect(issues({ ...valid, seats: "0" })[0][0]).toBe("seats");
    expect(issues({ ...valid, seats: "7" })[0][0]).toBe("seats");
    expect(issues({ ...valid, meetupPointId: "platt" })).toContainEqual(["meetupPointId", "Pick an approved meetup point."]);
  });
  it("has no free-text meetup address: only an id of a point is accepted", () => {
    expect(issues({ ...valid, meetupPointId: "123 Main Street" })[0][0]).toBe("meetupPointId");
  });
  it("checks the car", () => {
    expect(issues({ ...valid, carMake: "" })[0][0]).toBe("carMake");
    expect(issues({ ...valid, carPlate: "A" })[0][0]).toBe("carPlate");
    expect(issues({ ...valid, carPlate: "AB<>12" })[0][0]).toBe("carPlate");
    expect(issues({ ...valid, carPlate: "ABCDEFGHIJK" })[0][0]).toBe("carPlate");
    expect(issues({ ...valid, carPlate: "a1" })).toEqual([]);
  });
  it("keeps contact details out of both notes, with the plain message", () => {
    expect(issues({ ...valid, notes: "text me 909-555-0123" })).toContainEqual(["notes", "Keep contact details in the app chat."]);
    expect(issues({ ...valid, costNote: "venmo @maya" })).toContainEqual(["costNote", "Keep contact details in the app chat."]);
  });
  it("catches a number split across the two notes", () => {
    expect(issues({ ...valid, costNote: "909-555", notes: "0123" })).toContainEqual(["notes", "Keep contact details in the app chat."]);
  });
  it("allows ordinary notes and an optional back-by", () => {
    expect(issues({ ...valid, costNote: "Split gas and parking", notes: "Back by 5, no big bags", backByTime: "17:00" })).toEqual([]);
  });
  it("limits note length", () => {
    expect(issues({ ...valid, notes: "x".repeat(301) })[0][0]).toBe("notes");
    expect(issues({ ...valid, costNote: "x".repeat(201) })[0][0]).toBe("costNote");
  });
});
