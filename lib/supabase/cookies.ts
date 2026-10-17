import type { CookieOptions } from "@supabase/ssr";

// BUILD.md Section 12: cookies are Secure, HttpOnly, SameSite=Lax. The browser never reads the
// session itself; server code does, and hands a short-lived token to anything that needs one.
export function sessionCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}
