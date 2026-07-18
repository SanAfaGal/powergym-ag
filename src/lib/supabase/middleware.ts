import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the auth token cookie on every request (Supabase access tokens
// are short-lived) and returns the current user. Uses getClaims(), not
// getSession() -- getSession() only reads the cookie without verifying it.
// getClaims() verifies the JWT: locally against the cached JWKS if the
// project uses asymmetric signing keys (no network round trip), or via a
// network call to Supabase's servers otherwise -- same safety guarantee
// getUser() gave, but with a fast path once asymmetric keys are enabled on
// the project (see Auth > JWT Keys in the Supabase dashboard).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const user = data ? { id: data.claims.sub } : null;

  return { supabase, supabaseResponse, user };
}
