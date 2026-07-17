"use client";

import { useTransition } from "react";
import { format, startOfWeek } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bogotaToday } from "@/lib/date/bogota";

export function DashboardFilters({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function pushRange(nextStart: string, nextEnd: string) {
    const params = new URLSearchParams(searchParams);
    params.set("start", nextStart);
    params.set("end", nextEnd);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function setThisWeek() {
    const today = bogotaToday();
    const weekStart = format(
      startOfWeek(new Date(`${today}T00:00:00`), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    pushRange(weekStart, today);
  }

  function setThisMonth() {
    const today = bogotaToday();
    pushRange(`${today.slice(0, 7)}-01`, today);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-start">Desde</Label>
        <Input
          id="dashboard-start"
          type="date"
          value={start}
          onChange={(e) => pushRange(e.target.value, end)}
          className="w-auto"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-end">Hasta</Label>
        <Input
          id="dashboard-end"
          type="date"
          value={end}
          onChange={(e) => pushRange(start, e.target.value)}
          className="w-auto"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={setThisWeek}>
          Esta semana
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={setThisMonth}>
          Este mes
        </Button>
        {isPending && (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
