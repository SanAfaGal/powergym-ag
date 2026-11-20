"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { OpenDoubt } from "../queries";
import { CloseDoubtButton } from "./CloseDoubtButton";

const VISIBLE = 4;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function OpenDoubtsCard({ doubts }: { doubts: OpenDoubt[] }) {
  const [expanded, setExpanded] = useState(false);

  // Sin dudas no se muestra nada.
  if (doubts.length === 0) return null;

  const shown = expanded ? doubts : doubts.slice(0, VISIBLE);
  const hidden = doubts.length - VISIBLE;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <CircleHelp className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Dudas abiertas</span>
        <Badge variant="destructive">{doubts.length}</Badge>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Se responden en el grupo con «D12 respuesta»
        </span>
      </div>
      <ul className="flex flex-col divide-y">
        {shown.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 px-3 py-2 text-sm"
            title={d.question}
          >
            <span className="w-10 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
              D{d.id}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words">«{d.originalMessage}»</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.question}
              </p>
              <p className="text-xs text-muted-foreground sm:hidden">
                {d.reportedBy} · {formatWhen(d.createdAt)}
              </p>
            </div>
            <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
              {d.reportedBy}
              <br />
              {formatWhen(d.createdAt)}
            </span>
            <CloseDoubtButton id={d.id} />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full rounded-none border-t text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown /> Ver {hidden} más
            </>
          )}
        </Button>
      )}
    </Card>
  );
}
