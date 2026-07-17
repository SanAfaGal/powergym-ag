"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bogotaToday } from "@/lib/date/bogota";

export function DailyActivityFilter({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushDate(nextDate: string) {
    const params = new URLSearchParams(searchParams);
    params.set("activityDate", nextDate || bogotaToday());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="activity-date">Actividad del día</Label>
        <Input
          id="activity-date"
          type="date"
          value={date}
          onChange={(e) => pushDate(e.target.value)}
          className="w-auto"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => pushDate(bogotaToday())}
      >
        Hoy
      </Button>
    </div>
  );
}
