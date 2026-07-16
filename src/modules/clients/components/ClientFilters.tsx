"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon, WalletIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";
import { cn } from "@/lib/utils";
import { ClientSortControl } from "./ClientSortControl";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
] as const;

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "all", label: "Todas las suscripciones" },
  { value: "active", label: "Activa" },
  { value: "pending_payment", label: "Pendiente" },
  { value: "scheduled", label: "Programada" },
  { value: "expired", label: "Vencida" },
  { value: "canceled", label: "Cancelada" },
  { value: "none", label: "Sin suscripción" },
] as const;

const FILTER_KEYS = ["status", "subscriptionStatus", "planId", "hasBalance"] as const;

const SUBSCRIPTION_STATUS_ITEMS = Object.fromEntries(
  SUBSCRIPTION_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

export function ClientFilters({
  defaultQuery,
  status,
  subscriptionStatus,
  planId,
  hasBalance,
  sort,
  plans,
}: {
  defaultQuery: string;
  status: string;
  subscriptionStatus: string;
  planId: string;
  hasBalance: boolean;
  sort: string;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  function clearFilters() {
    const params = new URLSearchParams(searchParams);
    for (const key of FILTER_KEYS) params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const planItems = {
    all: "Todos los planes",
    ...Object.fromEntries(plans.map((plan) => [plan.id, plan.name])),
  };

  const activeCount = [
    status !== "all",
    subscriptionStatus !== "all",
    Boolean(planId),
    hasBalance,
  ].filter(Boolean).length;

  function filterGroups() {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Cliente
          </span>
          <SegmentedFilter
            aria-label="Estado del cliente"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setParam("status", v, "all")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Suscripción
          </span>
          <Select
            items={SUBSCRIPTION_STATUS_ITEMS}
            value={subscriptionStatus}
            onValueChange={(v) => setParam("subscriptionStatus", v ?? "all", "all")}
          >
            <SelectTrigger aria-label="Estado de suscripción" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Plan
          </span>
          <Select
            items={planItems}
            value={planId || "all"}
            onValueChange={(v) => setParam("planId", v ?? "all", "all")}
          >
            <SelectTrigger aria-label="Plan" className="w-full sm:w-48">
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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Saldo
          </span>
          <button
            type="button"
            aria-pressed={hasBalance}
            onClick={() => setParam("hasBalance", hasBalance ? "all" : "yes", "all")}
            className={cn(
              "inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-medium transition-colors",
              hasBalance
                ? "border-transparent bg-primary/15 text-primary"
                : "border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <WalletIcon className="size-3.5" />
            Con saldo pendiente
          </button>
        </div>
      </>
    );
  }

  function searchInput() {
    return (
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, alias, documento o email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet */}
      <Card size="sm" className="hidden md:block">
        <CardContent className="flex flex-col gap-3">
          {searchInput()}
          <div className="flex flex-wrap items-end gap-4">
            {filterGroups()}
            <div className="ml-auto flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Ordenar
              </span>
              <ClientSortControl sort={sort} className="w-full sm:w-44" />
            </div>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {activeCount} filtro{activeCount === 1 ? "" : "s"} activo
                {activeCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {searchInput()}
        <div className="flex items-center gap-2">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="sm" className="gap-1.5" />}
            >
              <SlidersHorizontalIcon className="size-3.5" />
              Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh]">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto px-4">
                {filterGroups()}
              </div>
              <SheetFooter className="flex-row justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  disabled={activeCount === 0}
                >
                  Limpiar
                </Button>
                <SheetClose render={<Button size="sm" />}>Aplicar</SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <ClientSortControl sort={sort} className="flex-1" />
        </div>
      </div>
    </>
  );
}
