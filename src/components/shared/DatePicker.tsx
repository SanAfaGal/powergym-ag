"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateValue,
  maskDateInput,
  parseTypedDate,
} from "@/lib/date/dateInput";
import { cn } from "@/lib/utils";

// value/min/max are "yyyy-MM-dd" strings, matching bogotaToday() (src/lib/date/bogota.ts).
// Parsed at local midnight (not UTC) so the calendar day shown always matches
// the string, regardless of the browser's timezone.
//
// The date can be typed (dd/mm/aaaa, the slashes go in by themselves) or picked
// from the calendar, which has month and year dropdowns so an old date, such as
// a birth date, is two clicks away instead of one month at a time.
function parseDateValue(value: string | undefined) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const FIRST_YEAR = 1900;
const YEARS_AHEAD = 10;

export function DatePicker({
  value,
  onChange,
  min,
  max,
  className,
  disabled,
  ...props
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
} & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "children" | "type"
>) {
  const selected = parseDateValue(value);
  const minDate = min ? parseDateValue(min) : undefined;
  const maxDate = max ? parseDateValue(max) : undefined;
  const [open, setOpen] = useState(false);

  // What is in the box while typing. Null means "show the value": it is set on
  // the first keystroke and dropped again once the text is committed or left.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatDateValue(value);
  const invalid = draft !== null && draft.length === 10 && parseTypedDate(draft, { min, max }) === null;

  function type(raw: string) {
    const masked = maskDateInput(raw);
    setDraft(masked);
    // emptying the box clears the date (optional fields and filters)
    if (masked === "") {
      onChange("");
      return;
    }
    const parsed = parseTypedDate(masked, { min, max });
    if (parsed) onChange(parsed);
  }

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        disabled={disabled}
        data-value={value ?? ""}
        aria-invalid={invalid || props["aria-invalid"] ? true : undefined}
        value={text}
        onChange={(e) => type(e.target.value)}
        // leaving the box with a half-typed or invalid date puts the last good
        // value back instead of leaving a date the form does not have
        onBlur={(e) => {
          setDraft(null);
          props.onBlur?.(e);
        }}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          aria-label="Abrir calendario"
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          <CalendarIcon className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={es}
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected ?? maxDate}
            startMonth={minDate ?? new Date(FIRST_YEAR, 0)}
            endMonth={
              maxDate ?? new Date(new Date().getFullYear() + YEARS_AHEAD, 11)
            }
            disabled={(date) =>
              (minDate ? date < minDate : false) ||
              (maxDate ? date > maxDate : false)
            }
            onSelect={(date) => {
              if (!date) return;
              setDraft(null);
              onChange(toDateValue(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
