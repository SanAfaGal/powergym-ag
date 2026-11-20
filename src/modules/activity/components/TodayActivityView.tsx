import { MessageCircle, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityEntry, TodayActivity } from "../queries";
import { formatMoney, formatTime } from "../lib/format";
import { VoidEntryButton } from "./VoidEntryButton";

function SourceBadge({ source }: { source: ActivityEntry["source"] }) {
  return source === "whatsapp" ? (
    <Badge variant="accent-2">
      <MessageCircle data-icon="inline-start" />
      WhatsApp
    </Badge>
  ) : (
    <Badge variant="outline">
      <Monitor data-icon="inline-start" />
      Panel
    </Badge>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

export function TodayActivityView({ activity }: { activity: TodayActivity }) {
  const { entries, voided } = activity;
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const byMethod = new Map<string, number>();
  for (const e of entries) {
    byMethod.set(e.method, (byMethod.get(e.method) ?? 0) + e.amount);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total del día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(total)}
            </p>
            <p className="text-xs text-muted-foreground">
              {entries.length} {entries.length === 1 ? "pago" : "pagos"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Por método
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byMethod.size === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {[...byMethod.entries()].map(([method, amount]) => (
                  <li key={method} className="flex justify-between gap-4">
                    <span>{method}</span>
                    <span className="tabular-nums">{formatMoney(amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <Empty>Sin pagos este día</Empty>
          ) : (
            <ul className="flex flex-col divide-y">
              {entries.map((e) => (
                <li
                  key={e.number}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-mono text-muted-foreground">
                        P{e.number}
                      </span>{" "}
                      <span className="font-medium">{e.client}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {e.concept}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(e.at)} · {e.method}
                      {e.reportedBy && ` · ${e.reportedBy}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SourceBadge source={e.source} />
                    <span className="font-medium tabular-nums">
                      {formatMoney(e.amount)}
                    </span>
                    <VoidEntryButton
                      number={e.number}
                      label={`${e.client} — ${e.concept} — ${formatMoney(e.amount)}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Anulados</CardTitle>
          </CardHeader>
          <CardContent>
            {voided.length === 0 ? (
              <Empty>Nada anulado</Empty>
            ) : (
              <ul className="flex flex-col divide-y">
                {voided.map((v) => (
                  <li key={v.number} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="min-w-0 truncate line-through decoration-muted-foreground">
                        <span className="font-mono">P{v.number}</span>{" "}
                        {v.client} — {v.concept}
                      </span>
                      <span className="shrink-0 tabular-nums line-through">
                        {formatMoney(v.amount)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anulado por {v.voidedBy || "—"} a las{" "}
                      {formatTime(v.voidedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
