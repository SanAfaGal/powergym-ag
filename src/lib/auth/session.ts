import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Request-scoped dedup: React's cache() memoizes per render tree, so no
// matter how many Server Components (layout, page, admin guards) call this
// within the same request, getUser() + the profiles lookup run once. Does
// NOT dedupe across the middleware boundary -- that's a separate process
// invocation with its own getUser() call (see src/middleware.ts), kept
// intentionally independent as the first line of defense.
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { user, profile };
});
