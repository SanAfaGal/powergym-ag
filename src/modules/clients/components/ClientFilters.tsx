"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
] as const;

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activa" },
  { value: "pending_payment", label: "Pendiente" },
  { value: "scheduled", label: "Programada" },
  { value: "expired", label: "Vencida" },
  { value: "canceled", label: "Cancelada" },
  { value: "none", label: "Sin suscripción" },
] as const;

const BALANCE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "yes", label: "Con saldo pendiente" },
] as const;

export function ClientFilters({
  defaultQuery,
  status,
  subscriptionStatus,
  planId,
  hasBalance,
  plans,
}: {
  defaultQuery: string;
  status: string;
  subscriptionStatus: string;
  planId: string;
  hasBalance: boolean;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // only re-run when the debounced query itself changes -- reacting to
    // router/pathname/searchParams too would refire this on every push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function setParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams);
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar por nombre, alias, documento o email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedFilter
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setParam("status", v, "all")}
        />
        <SegmentedFilter
          options={SUBSCRIPTION_STATUS_OPTIONS}
          value={subscriptionStatus}
          onChange={(v) => setParam("subscriptionStatus", v, "all")}
        />
        <SegmentedFilter
          options={BALANCE_OPTIONS}
          value={hasBalance ? "yes" : "all"}
          onChange={(v) => setParam("hasBalance", v, "all")}
        />
        <Select
          value={planId || "all"}
          onValueChange={(v) => setParam("planId", v ?? "all", "all")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los planes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
