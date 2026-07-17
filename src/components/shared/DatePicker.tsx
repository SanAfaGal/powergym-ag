"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// value/min/max are "yyyy-MM-dd" strings, matching bogotaToday() (src/lib/date/bogota.ts)
// and the native date input this component replaces. Parsed at local midnight (not UTC)
// so the calendar day shown always matches the string, regardless of the browser's timezone.
function parseDateValue(value: string | undefined) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Seleccionar",
  className,
  disabled,
  ...props
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
} & Omit<
  React.ComponentProps<typeof Button>,
  "value" | "onChange" | "children"
>) {
  const selected = parseDateValue(value);
  const minDate = min ? parseDateValue(min) : undefined;
  const maxDate = max ? parseDateValue(max) : undefined;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            data-value={value ?? ""}
            className={cn(
              "w-full min-w-0 shrink justify-start font-normal",
              !selected && "text-muted-foreground",
              className
            )}
            {...props}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0" />
        <span className="truncate">
          {selected ? format(selected, "d MMM yyyy", { locale: es }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={(date) =>
            (minDate ? date < minDate : false) ||
            (maxDate ? date > maxDate : false)
          }
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateValue(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
