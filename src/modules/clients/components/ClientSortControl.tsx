"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

// days_remaining is the only field staff sort by -- this is a direction
// toggle, not a field picker. Ascending (soonest expiring / most overdue
// first) is the default and most actionable order.
export function ClientSortControl({
  sort,
  className,
}: {
  sort: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ascending = sort !== "days_remaining_desc";
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const params = new URLSearchParams(searchParams);
    if (ascending) params.set("sort", "days_remaining_desc");
    else params.delete("sort");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const Icon = ascending ? ArrowUpNarrowWide : ArrowDownNarrowWide;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      className={className}
      aria-label={`Ordenar por días restantes, ${
        ascending ? "ascendente" : "descendente"
      }`}
    >
      {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
      Días restantes
    </Button>
  );
}
