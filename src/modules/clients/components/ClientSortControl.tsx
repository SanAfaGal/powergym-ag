"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";

const SORT_OPTIONS = [
  { value: "start_date", label: "Fecha de inicio" },
  { value: "remaining", label: "Saldo pendiente" },
  { value: "days_remaining", label: "Días restantes" },
] as const;

export function ClientSortControl({ sort }: { sort: string }) {
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
    <SegmentedFilter options={SORT_OPTIONS} value={sort} onChange={setSort} />
  );
}
