// Which paths need a signed-in person. Everything else is open: the landing page, sign-in,
// the Safety, Terms and Privacy pages, and the health check. Row-level security reads trips
// only for signed-in people, so trip and request pages sign people in first and then bring them back.
const OPEN_PREFIXES = ["/sign-in", "/auth", "/safety", "/terms", "/privacy", "/api/health"];

export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return false;
  return !OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Only ever send people back to a path on this site. Rejects "//evil.com", "https://...", and
// backslash tricks that some browsers treat as a host.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  return next;
}

export function signInUrl(pathname: string, search = ""): string {
  return `/sign-in?next=${encodeURIComponent(pathname + search)}`;
}
