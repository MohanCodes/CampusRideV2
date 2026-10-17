import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "@/lib/contact";

const id = z.string().uuid("We couldn't find that.");

export const requestSeatSchema = z.object({
  tripId: id,
  seats: z.coerce.number({ error: "Pick how many seats." }).int().min(1, "Pick 1 to 3 seats.").max(3, "Pick 1 to 3 seats."),
  message: z
    .string()
    .trim()
    .max(300, "Keep your message under 300 characters.")
    .optional()
    .default("")
    .refine((m) => !containsContactInfo(m), CONTACT_INFO_MESSAGE),
});

export const respondSchema = z.object({
  requestId: id,
  accept: z.enum(["1", "0"]).transform((v) => v === "1"),
});

export const cancelSeatSchema = z.object({ requestId: id });
export const cancelTripSchema = z.object({ tripId: id });

// "Edit trip": time, notes, cost note, and seats. (Destination, meetup point, and car stay as posted.)
export const updateTripSchema = z
  .object({
    tripId: id,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
    backByTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Pick a time.").optional().default(""),
    seats: z.coerce.number({ error: "Pick how many seats." }).int().min(1, "Pick 1 to 6 seats.").max(6, "Pick 1 to 6 seats."),
    costNote: z.string().trim().max(200, "Keep the cost note under 200 characters.").optional().default(""),
    notes: z.string().trim().max(300, "Keep notes under 300 characters.").optional().default(""),
    confirmOverlap: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (containsContactInfo(v.costNote)) ctx.addIssue({ code: "custom", path: ["costNote"], message: CONTACT_INFO_MESSAGE });
    if (containsContactInfo(v.notes) || (!containsContactInfo(v.costNote) && containsContactInfo(`${v.costNote} ${v.notes}`))) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: CONTACT_INFO_MESSAGE });
    }
  });
