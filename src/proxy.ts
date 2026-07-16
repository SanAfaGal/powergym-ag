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
    .select("is_active")
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
