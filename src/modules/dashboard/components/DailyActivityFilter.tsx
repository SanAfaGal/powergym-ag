"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/DatePicker";
import { bogotaToday } from "@/lib/date/bogota";

export function DailyActivityFilter({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function pushDate(nextDate: string) {
    const params = new URLSearchParams(searchParams);
    params.set("activityDate", nextDate || bogotaToday());
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="activity-date">Actividad del día</Label>
        <DatePicker
          id="activity-date"
          value={date}
          onChange={pushDate}
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
      {isPending && (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
