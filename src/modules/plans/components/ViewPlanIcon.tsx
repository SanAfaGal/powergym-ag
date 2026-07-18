"use client";

import { useLinkStatus } from "next/link";
import { Eye, Loader2 } from "lucide-react";

// Child of the "Ver plan" <Link>-rendered Button -- swaps to a spinner the
// instant the click registers, instead of the icon sitting static while the
// navigation resolves.
export function ViewPlanIcon() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye />;
}
