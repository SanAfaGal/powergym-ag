"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/DatePicker";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";

const RESULT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "granted", label: "Autorizados" },
  { value: "denied", label: "Denegados" },
] as const;

// Filters live in the URL (like the clients list), so a filtered view can be
// shared or reloaded, and the server does the filtering and paging.
export function AccessEventFilters({
  result,
  defaultQuery,
  from,
  to,
}: {
  result: string;
  defaultQuery: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);
  // clear() resets the text itself; the debounced effect must not then push a
  // stale copy of the old params back into the URL.
  const skipNextDebounce = useRef(false);

  const hasFilters = result !== "all" || Boolean(defaultQuery || from || to);

  function push(params: URLSearchParams) {
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      push(params);
    }, 300);
    return () => clearTimeout(timeout);
    // only the debounced text should retrigger this, not every URL push
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function setParam(key: string, value: string, defaultValue = "") {
    const params = new URLSearchParams(searchParams);
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    push(params);
  }

  function clear() {
    if (query) skipNextDebounce.current = true;
    setQuery("");
    push(new URLSearchParams());
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Resultado</span>
        <SegmentedFilter
          aria-label="Resultado del intento"
          options={RESULT_OPTIONS}
          value={result as "all" | "granted" | "denied"}
          onChange={(v) => setParam("result", v, "all")}
        />
      </div>

      <div className="flex w-64 flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Cliente</span>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            aria-label="Buscar cliente"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Desde</span>
        <DatePicker
          value={from || undefined}
          onChange={(v) => setParam("from", v)}
          max={to || undefined}
          placeholder="Fecha"
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Hasta</span>
        <DatePicker
          value={to || undefined}
          onChange={(v) => setParam("to", v)}
          min={from || undefined}
          placeholder="Fecha"
          className="w-40"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <XIcon />
          Limpiar
        </Button>
      )}
      {isPending && (
        <Loader2Icon className="mb-2 size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
