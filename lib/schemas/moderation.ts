import { z } from "zod";

const id = z.string().uuid("We couldn't find that.");

// The five reasons from WEB_FLOWS.md Flow F, exactly.
export const REPORT_REASONS = ["Unsafe driving", "Harassment", "No-show", "Fake profile", "Other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGETS = ["user", "trip", "request"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS, { error: "We couldn't find that to report." }),
  targetId: id,
  tripId: id.optional().or(z.literal("")).default(""),
  reason: z.enum(REPORT_REASONS, { error: "Pick a reason." }),
  details: z.string().trim().max(1000, "Keep the details under 1,000 characters.").optional().default(""),
});

export const userIdSchema = z.object({ userId: id });
export const noShowSchema = z.object({ tripId: id, riderId: id });

// Admin ------------------------------------------------------------------------------------------------------------------
export const REPORT_STATUSES = ["new", "reviewing", "actioned", "dismissed"] as const;
export const MEETUP_STATUSES = ["approved", "suspended", "retired"] as const;
export const MEETUP_TYPES = ["hub", "academic", "residence", "shared", "transit"] as const;

export const adminReportStatusSchema = z.object({ reportId: id, status: z.enum(["reviewing", "dismissed", "actioned", "new"]) });
export const adminUserActionSchema = z.object({
  userId: id,
  reportId: id.optional().or(z.literal("")).default(""),
  days: z.coerce.number().int().optional(),
});
export const adminSuspendSchema = adminUserActionSchema.extend({
  days: z.coerce.number().int().refine((d) => d === 7 || d === 30, "A suspension is 7 or 30 days."),
});

export const meetupPointSchema = z.object({
  campusId: z.string().trim().min(1, "Pick a college."),
  name: z.string().trim().min(2, "Give the point a name.").max(80, "Keep the name under 80 characters."),
  type: z.enum(MEETUP_TYPES, { error: "Pick a type." }),
  // Southern California only: the same box the database enforces, so a flipped sign is caught here first.
  lat: z.coerce.number({ error: "Enter the latitude." }).min(32, "That latitude is outside Southern California.").max(35.9, "That latitude is outside Southern California."),
  lng: z.coerce.number({ error: "Enter the longitude." }).min(-121, "That longitude is outside Southern California.").max(-114, "That longitude is outside Southern California."),
  shared: z.string().optional().default(""),
  standAt: z.string().trim().min(3, "Say where exactly to stand.").max(200, "Keep it under 200 characters."),
});
export const meetupPointUpdateSchema = meetupPointSchema.omit({ campusId: true }).extend({ pointId: id });
export const meetupStatusSchema = z.object({ pointId: id, status: z.enum(MEETUP_STATUSES) });
