// Turns whatever someone pastes or types into the one-time code boxes into up to six digits.
export function digitsOnly(input: string, max = 6): string {
  return input.replace(/\D/g, "").slice(0, max);
}

export const RESEND_AFTER_SECONDS = 30;
