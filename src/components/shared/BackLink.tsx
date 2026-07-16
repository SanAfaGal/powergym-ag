"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Prefers router.back() so the user lands back on the exact list URL they
// left (filters/sort/page intact) instead of a clean list. Falls back to
// href when there's no same-origin in-app history to return to (direct
// link, new tab, or a hard refresh on the detail page itself) --
// document.referrer only reflects the referrer of the current tab's
// initial page load, not client-side route changes, so it's a proxy for
// "did this browser tab's session start from within this app."
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();

  function handleClick() {
    const hasInAppHistory =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin);

    if (hasInAppHistory) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Volver a {label}
    </button>
  );
}
