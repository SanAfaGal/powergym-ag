"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const FILTER_KEYS = [
  "status",
  "subscriptionStatus",
  "planId",
  "hasBalance",
  "expiresFrom",
  "expiresTo",
] as const;

const SUBSCRIPTION_STATUS_ITEMS = Object.fromEntries(
  SUBSCRIPTION_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

export function ClientFilters({
  defaultQuery,
  status,
  subscriptionStatus,
  planId,
  hasBalance,
  expiresFrom,
  expiresTo,
  sort,
  plans,
}: {
  defaultQuery: string;
  status: string;
  subscriptionStatus: string;
  planId: string;
  hasBalance: boolean;
  expiresFrom: string;
  expiresTo: string;
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

  function setDateParam(key: "expiresFrom" | "expiresTo", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
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

  const isExpiringFilterActive = Boolean(expiresFrom && expiresTo);

  const activeCount = [
    status !== "all",
    subscriptionStatus !== "all",
    Boolean(planId),
    hasBalance,
    isExpiringFilterActive,
  ].filter(Boolean).length;

  // Fixed, generous widths per control -- not flex-1/w-full stretched into
  // an N-column grid. Forcing 5 equal columns squeezed everything (the
  // Suscripción select's own text got clipped, the Cliente pills wrapped
  // mid-group) at exactly the desktop widths this panel actually renders
  // at. flex-wrap lets each control keep the room it needs and wrap to a
  // second line as a whole group, rather than every group shrinking together.
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
        <div className="flex w-56 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Suscripción
          </span>
          <Select
            items={SUBSCRIPTION_STATUS_ITEMS}
            value={subscriptionStatus}
            onValueChange={(v) => setParam("subscriptionStatus", v ?? "all", "all")}
            disabled={isExpiringFilterActive}
          >
            <SelectTrigger aria-label="Estado de suscripción" className="w-full">
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
          {isExpiringFilterActive && (
            <span className="text-xs text-muted-foreground">
              Se ignora mientras el filtro de vencimientos esté activo
            </span>
          )}
        </div>
        <div className="flex w-80 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Vence entre
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Vence desde"
              value={expiresFrom}
              onChange={(e) => setDateParam("expiresFrom", e.target.value)}
              className="w-full"
            />
            <span className="shrink-0 text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              aria-label="Vence hasta"
              value={expiresTo}
              onChange={(e) => setDateParam("expiresTo", e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex w-48 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Plan
          </span>
          <Select
            items={planItems}
            value={planId || "all"}
            onValueChange={(v) => setParam("planId", v ?? "all", "all")}
          >
            <SelectTrigger aria-label="Plan" className="w-full">
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
        <div className="flex w-52 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Saldo
          </span>
          <button
            type="button"
            aria-pressed={hasBalance}
            onClick={() => setParam("hasBalance", hasBalance ? "all" : "yes", "all")}
            className={cn(
              "inline-flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors",
              hasBalance
                ? "border-transparent bg-primary/15 text-primary"
                : "border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <WalletIcon className="size-3.5 shrink-0" />
            <span className="truncate">Con saldo pendiente</span>
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
          <Collapsible defaultOpen={activeCount > 0}>
            {/* Toolbar: search grows to absorb all the slack, filter
                controls stay a tight cluster, sort anchors to the far
                right -- three clear zones instead of edge-justified
                elements with a dead gap between them. Every control here
                is h-8 (Input's default, and Button's "default" size, not
                "sm") so the row shares one baseline. */}
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">{searchInput()}</div>
              <CollapsibleTrigger
                render={<Button variant="outline" className="group shrink-0 gap-1.5" />}
              >
                <SlidersHorizontalIcon className="size-3.5" />
                Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
                <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
              </CollapsibleTrigger>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="shrink-0 cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  Limpiar
                </button>
              )}
              <ClientSortControl sort={sort} className="ml-auto shrink-0" />
            </div>
            <CollapsibleContent className="pt-4">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                {filterGroups()}
              </div>
            </CollapsibleContent>
          </Collapsible>
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
