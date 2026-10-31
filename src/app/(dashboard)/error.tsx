"use client";

import { Button } from "@/components/ui/button";

// Boundary for any query that throws while a dashboard page renders (e.g.
// Supabase unreachable). Keeps the sidebar and offers a retry instead of
// Next's generic error page. The raw error is never shown: it can carry
// database details.
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="font-heading text-xl font-bold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No pudimos cargar esta página. Intentá de nuevo; si el problema sigue,
        avisale a un administrador.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
