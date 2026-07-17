"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Prefers router.back() so the user lands back on the exact list URL they
// left (filters/sort/page intact) instead of a clean list. Falls back to
// href when there's no history entry to return to (direct link, new tab,
// or a hard refresh on the detail page itself) -- history.length > 1 means
// this tab's immediately preceding entry exists, and for a detail page
// that's only ever reached by clicking through from its own list, that
// entry is that list page. document.referrer is NOT usable for this check:
// in a client-side-routed app it only reflects the referrer of the tab's
// very first page load, never updating across in-app navigations, so it
// stays empty (or app-external) for the entire session after a direct
// URL/bookmark entry -- which is the common case, not the exception.
// Known gap: a brand-new tab's blank starting entry can itself count
// toward history.length, so a direct link opened in a fresh tab may still
// go "back" to that blank entry instead of falling through to href.
// Accepted tradeoff -- direct-linking into a client/plan detail page isn't
// how staff use this app today (see 2026-07-16-back-link-design.md).
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="mb-4 text-muted-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Volver a {label}
    </Button>
  );
}
