"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDownIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "start_date", label: "Fecha de inicio" },
  { value: "remaining", label: "Saldo pendiente" },
  { value: "days_remaining", label: "Días restantes" },
] as const;

const SORT_ITEMS = Object.fromEntries(
  SORT_OPTIONS.map((opt) => [opt.value, opt.label])
);

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

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "start_date") params.delete("sort");
    else params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      items={SORT_ITEMS}
      value={sort}
      onValueChange={(v) => setSort(v ?? "start_date")}
    >
      <SelectTrigger className={className} aria-label="Ordenar por">
        <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
