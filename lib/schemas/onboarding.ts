import { z } from "zod";

// Mirrors the limits in complete_onboarding and the profiles table, so people hear about a
// problem before the database does. The database is still the real check.
export const onboardingSchema = z.object({
  firstName: z.string().trim().min(1, "Add your first name.").max(40, "Keep your first name under 40 letters."),
  lastName: z.string().trim().min(1, "Add your last name.").max(40, "Keep your last name under 40 letters."),
  classYear: z.coerce
    .number({ error: "Pick your class year." })
    .int("Pick your class year.")
    .min(2020, "Pick your class year.")
    .max(2035, "Pick your class year."),
  bio: z.string().trim().max(280, "Keep your bio under 280 characters.").optional().default(""),
  avatarPath: z.string().min(1, "Add a photo of your face to continue."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;
