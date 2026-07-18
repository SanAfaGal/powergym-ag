"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Must render as a child of <Link>, not a sibling -- useLinkStatus only
// picks up pending state from the nearest ancestor Link's navigation.
export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      className={cn("inline size-3.5 animate-spin", className)}
      aria-hidden
    />
  );
}
