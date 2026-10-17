import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";

const text = (max: number, tooLong: string) => z.string().trim().max(max, tooLong).optional().default("");

// The "Offer a ride" form. Mirrors the checks in post_trip so people hear about a problem before
// the database does; the database is still the real check.
export const postTripSchema = z
  .object({
    destinationKind: z.enum(["place", "other"], { error: "Pick where you're going." }),
    placeId: z.string().trim().max(80).optional().default(""),
    mapboxId: z.string().trim().max(200).optional().default(""),
    sessionToken: z.string().trim().max(80).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
    backByTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Pick a time.").optional().default(""),
    seats: z.coerce.number({ error: "Pick how many seats." }).int().min(1, "Pick 1 to 6 seats.").max(6, "Pick 1 to 6 seats."),
    meetupPointId: z.string().uuid("Pick an approved meetup point."),
    carMake: z.string().trim().min(1, "Add the car's make.").max(40, "Keep it under 40 characters."),
    carColor: z.string().trim().min(1, "Add the car's color.").max(40, "Keep it under 40 characters."),
    carPlate: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9 -]{0,8}[A-Z0-9]$/, "Enter the plate, 2 to 10 letters and numbers."),
    costNote: text(200, "Keep the cost note under 200 characters."),
    notes: text(300, "Keep notes under 300 characters."),
    confirmOverlap: z.string().optional().default(""),
    // Set when the trip is posted to answer an "In search of" request: the offer goes out with it.
    forRequest: z.string().trim().max(40).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.destinationKind === "place" && !v.placeId) ctx.addIssue({ code: "custom", path: ["destination"], message: "Pick where you're going." });
    if (v.destinationKind === "other" && !v.mapboxId) ctx.addIssue({ code: "custom", path: ["destination"], message: "Pick where you're going." });
    if (containsContactInfo(v.costNote)) ctx.addIssue({ code: "custom", path: ["costNote"], message: CONTACT_INFO_MESSAGE });
    if (containsContactInfo(v.notes)) ctx.addIssue({ code: "custom", path: ["notes"], message: CONTACT_INFO_MESSAGE });
    // The database also checks the two notes joined together, so a number can't be split across them.
    if (!containsContactInfo(v.costNote) && !containsContactInfo(v.notes) && containsContactInfo(`${v.costNote} ${v.notes}`)) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: CONTACT_INFO_MESSAGE });
    }
  });

export type PostTripInput = z.infer<typeof postTripSchema>;

export const searchOtherSchema = z.object({
  query: z.string().trim().min(3).max(80),
  sessionToken: z.string().uuid(),
});
