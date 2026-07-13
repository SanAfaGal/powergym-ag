"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(
    value
  );
}

export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: number;
  onChange: (value: number) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const [display, setDisplay] = useState(() =>
    value ? formatCOP(value) : ""
  );
  // Tracks the last value this component itself emitted, so the sync effect
  // below can tell "value changed because the user typed" (skip resync,
  // display is already correct) apart from "value changed because the
  // parent reset the form" (resync display from the new value). Without
  // this, external resets (e.g. RecordPaymentDialog re-syncing `amount` to
  // the current `remaining` balance on dialog reopen) would be invisible --
  // the input would keep showing whatever was last typed.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setDisplay(value ? formatCOP(value) : "");
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const parsed = digits === "" ? 0 : parseInt(digits, 10);
    lastEmitted.current = parsed;
    setDisplay(digits === "" ? "" : formatCOP(parsed));
    onChange(parsed);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        className={cn("pl-6", className)}
        {...props}
      />
    </div>
  );
}
