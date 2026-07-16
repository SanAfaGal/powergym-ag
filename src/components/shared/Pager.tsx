import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pager({
  page,
  total,
  pageSize,
  buildHref,
  itemLabel = "resultados",
}: {
  page: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages} · {total} {itemLabel}
      </p>
      <div className="flex gap-2">
        <Button
          render={<Link href={buildHref(page - 1)} />}
          nativeButton={false}
          variant="outline"
          size="sm"
          disabled={page <= 1}
        >
          Anterior
        </Button>
        <Button
          render={<Link href={buildHref(page + 1)} />}
          nativeButton={false}
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
