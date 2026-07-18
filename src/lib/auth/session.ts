import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "employee";
  is_active: boolean;
};

function isProfile(value: unknown): value is Profile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Profile).id === "string" &&
    typeof (value as Profile).full_name === "string" &&
    ((value as Profile).role === "admin" || (value as Profile).role === "employee") &&
    typeof (value as Profile).is_active === "boolean"
  );
}

// src/proxy.ts already validated the session (getUser()) and fetched this
// same profile row this request -- forwarded via this header. Trusting it
// here skips a second JWT round trip and a second profile query entirely.
// Safe to trust: this is a request header set on the *forwarded* request
// inside middleware, after validation, not something the browser can see or
// set itself -- whatever a client sends under this name is overwritten by
// proxy.ts before the request ever reaches this code.
async function forwardedProfile(): Promise<Profile | null> {
  const h = await headers();
  const raw = h.get("x-staff-profile");
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Request-scoped dedup: React's cache() memoizes per render tree, so no
// matter how many Server Components (layout, page, admin guards) call this
// within the same request, this runs once. The forwarded-header path below
// does zero Supabase calls -- middleware is now the sole point where the
// session is validated for every request the matcher covers (see
// src/proxy.ts's config.matcher). The full independent check remains as a
// fallback for requests that reach here without having gone through
// middleware (outside the matcher, or some other invocation path), so
// behavior degrades gracefully rather than trusting an absent header.
export const getAuthContext = cache(async () => {
  const forwarded = await forwardedProfile();
  if (forwarded) {
    return { user: { id: forwarded.id }, profile: forwarded };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) return null;
  const user = { id: data.claims.sub };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { user, profile: profile as Profile };
});
