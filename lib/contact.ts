// The browser copy of the database's contains_contact_info(): phone numbers, emails, handles, and
// links are not allowed in trip and request notes ("Keep contact details in the app chat").
// It lets the form warn before submitting. The database function is the real check; lib/contact.test.ts
// runs both against the same examples so they stay in step.
const PATTERNS: RegExp[] = [
  /(\+?\d[\d\-\s().]{8,}\d)/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(^|\s)@[a-z0-9_.]{2,}/i,
  /(https?:\/\/|www\.)/i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|app|dev)\b/i,
];

export function containsContactInfo(text: string | null | undefined): boolean {
  if (!text) return false;
  return PATTERNS.some((p) => p.test(text));
}

export const CONTACT_INFO_MESSAGE = "Keep contact details in the app chat.";
