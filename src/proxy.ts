import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!user) {
    if (isLoginPage) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Deactivated staff can still hold a valid session token -- RLS would
  // just return empty results everywhere, which reads as a broken app, not
  // a blocked account. Check explicitly and sign them out instead.
  // `profiles_select_own` (migration 0007) allows reading your own row
  // regardless of `is_active`, so this read is never blocked by RLS.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "inactive");

    // signOut() clears cookies on `supabaseResponse` (via updateSession's
    // setAll), not on the fresh response NextResponse.redirect() creates
    // below -- copy them across, or the browser keeps sending the
    // now-signed-out session cookie.
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Forward the validated user + profile to the Server Component tree via a
  // request header -- getAuthContext (src/lib/auth/session.ts) trusts this
  // instead of re-validating the JWT and re-querying the profile itself.
  // Middleware is the sole point of session validation for every request
  // this matcher covers; getAuthContext keeps an independent fallback check
  // only for requests that somehow reach it without going through here.
  // Recomputed fresh on every request after validation, so a client can't
  // forge this header: whatever it sent gets overwritten here before the
  // request is forwarded downstream.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-staff-profile", JSON.stringify(profile));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
