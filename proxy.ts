import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, makeNonce } from "@/lib/csp";
import { isDemo } from "@/lib/demo";
import { isProtectedPath, signInUrl } from "@/lib/routes";
import { updateSession } from "@/lib/supabase/proxy";

// Refreshes the session and sends signed-out visitors to sign in. This is a convenience, not the
// lock: every page and every database function checks for itself.
export async function proxy(request: NextRequest) {
  // One nonce and one Content-Security-Policy per response. The policy goes on the request too, so Next puts the nonce on its own scripts.
  const csp = buildCsp({
    nonce: makeNonce(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.SENTRY_DSN,
    dev: process.env.NODE_ENV !== "production",
  });
  request.headers.set("Content-Security-Policy", csp);
  const { response, signedIn } = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  const { pathname, search } = request.nextUrl;
  // Demo mode (sample data, no backend) also opens the trip, post, rides, inbox, chat, request, profile and admin pages so the screens can be reviewed.
  const demoOpen = isDemo() && ["/trip/", "/post", "/rides", "/inbox", "/chat/", "/request/", "/user/", "/admin", "/me", "/onboarding"].some((p) => pathname.startsWith(p));
  if (!signedIn && !demoOpen && isProtectedPath(pathname)) {
    const redirect = NextResponse.redirect(new URL(signInUrl(pathname, search), request.url));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
