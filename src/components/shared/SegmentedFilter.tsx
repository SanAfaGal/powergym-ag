"use client";

import { cn } from "@/lib/utils";

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap gap-[3px] rounded-lg border border-input bg-muted p-[3px]",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-card text-primary shadow-[var(--shadow-sm)]"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
