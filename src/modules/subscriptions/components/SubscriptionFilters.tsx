"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "pending_payment", label: "Pendientes de pago" },
  { value: "scheduled", label: "Programadas" },
  { value: "expired", label: "Vencidas" },
  { value: "canceled", label: "Canceladas" },
] as const;

export function SubscriptionFilters({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") params.delete("status");
    else params.set("status", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <SegmentedFilter options={STATUS_OPTIONS} value={status} onChange={setStatus} />
  );
}
