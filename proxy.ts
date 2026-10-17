import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/demo";
import { isProtectedPath, signInUrl } from "@/lib/routes";
import { updateSession } from "@/lib/supabase/proxy";

// Refreshes the session and sends signed-out visitors to sign in. This is a convenience, not the
// lock: every page and every database function checks for itself.
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  // Demo mode (sample data, no backend) also opens the trip, post, rides, inbox, chat and request pages so the screens can be reviewed.
  const demoOpen = isDemo() && ["/trip/", "/post", "/rides", "/inbox", "/chat/", "/request/"].some((p) => pathname.startsWith(p));
  if (!signedIn && !demoOpen && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL(signInUrl(pathname, search), request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
