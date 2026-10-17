import { z } from "zod";

export const NOT_SCHOOL_EMAIL = "Use your school email.";
export const BAD_CODE = "That code didn't work. Check it and try again.";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, NOT_SCHOOL_EMAIL)
  .pipe(z.email(NOT_SCHOOL_EMAIL));

export const codeSchema = z.string().trim().regex(/^\d{6}$/, BAD_CODE);

export const requestCodeSchema = z.object({ email: emailSchema });
export const verifyCodeSchema = z.object({ email: emailSchema, code: codeSchema });
