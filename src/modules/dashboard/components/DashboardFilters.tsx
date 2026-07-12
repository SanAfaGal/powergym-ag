"use client";

import { format, startOfWeek } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  function pushRange(nextStart: string, nextEnd: string) {
    const params = new URLSearchParams(searchParams);
    params.set("start", nextStart);
    params.set("end", nextEnd);
    router.push(`${pathname}?${params.toString()}`);
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
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={setThisWeek}>
          Esta semana
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={setThisMonth}>
          Este mes
        </Button>
      </div>
    </div>
  );
}
