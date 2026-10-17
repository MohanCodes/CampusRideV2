import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, signInUrl } from "@/lib/routes";
import { updateSession } from "@/lib/supabase/proxy";

// Refreshes the session and sends signed-out visitors to sign in. This is a convenience, not the
// lock: every page and every database function checks for itself.
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (!signedIn && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL(signInUrl(pathname, search), request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
