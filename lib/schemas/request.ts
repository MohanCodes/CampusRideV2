import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";

const id = z.string().uuid("We couldn't find that.");
export const FLEXIBILITY = ["exact", "pm30", "pm60", "anytime"] as const;
export type Flexibility = (typeof FLEXIBILITY)[number];
export const FLEXIBILITY_LABEL: Record<Flexibility, string> = {
  exact: "Exactly then",
  pm30: "Plus or minus 30 minutes",
  pm60: "Plus or minus 1 hour",
  anytime: "Any time that day",
};

const note = z.string().trim().max(200, "Keep your note under 200 characters.").optional().default("")
  .refine((n) => !containsContactInfo(n), CONTACT_INFO_MESSAGE);
const seats = z.coerce.number({ error: "Pick how many seats." }).int().min(1, "Pick 1 to 3 seats.").max(3, "Pick 1 to 3 seats.");

// "Ask for a ride" (WEB_FLOWS.md 4.6). There is no price field: only whether you'll chip in.
export const postRequestSchema = z
  .object({
    destinationKind: z.enum(["place", "other"], { error: "Pick where you're going." }),
    placeId: z.string().trim().max(80).optional().default(""),
    mapboxId: z.string().trim().max(200).optional().default(""),
    sessionToken: z.string().trim().max(80).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
    flexibility: z.enum(FLEXIBILITY, { error: "Pick how flexible you are." }),
    seats,
    meetupPointId: z.string().uuid("Pick an approved meetup point."),
    chipIn: z.string().optional().default(""),
    note,
  })
  .superRefine((v, ctx) => {
    if (v.destinationKind === "place" && !v.placeId) ctx.addIssue({ code: "custom", path: ["destination"], message: "Pick where you're going." });
    if (v.destinationKind === "other" && !v.mapboxId) ctx.addIssue({ code: "custom", path: ["destination"], message: "Pick where you're going." });
  });

export const updateRequestSchema = z.object({
  requestId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
  flexibility: z.enum(FLEXIBILITY, { error: "Pick how flexible you are." }),
  seats,
  chipIn: z.string().optional().default(""),
  note,
});

export const sendOfferSchema = z.object({
  requestId: id,
  tripId: id,
  message: z.string().trim().max(300, "Keep your message under 300 characters.").optional().default("")
    .refine((m) => !containsContactInfo(m), CONTACT_INFO_MESSAGE),
});

export const respondOfferSchema = z.object({ offerId: id, accept: z.enum(["1", "0"]).transform((v) => v === "1") });
export const offerIdSchema = z.object({ offerId: id });
export const requestIdSchema = z.object({ requestId: id });
