import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DURATION_UNIT_LABELS, type Plan } from "../queries";

type PlanRow = Plan & { currentPrice: number | null };

export function PlanTable({ plans }: { plans: PlanRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="sticky right-0 bg-card text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="font-medium">
                <Link href={`/plans/${plan.id}`} className="hover:underline">
                  {plan.name}
                </Link>
              </TableCell>
              <TableCell>
                {plan.duration_count} {DURATION_UNIT_LABELS[plan.duration_unit]}
              </TableCell>
              <TableCell className="tabular-nums">
                {plan.currentPrice != null ? (
                  `$${plan.currentPrice.toLocaleString("es-CO")} ${plan.currency}`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge isActive={plan.is_active} />
              </TableCell>
              <TableCell className="sticky right-0 bg-card text-right">
                <Button
                  render={<Link href={`/plans/${plan.id}`} />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                >
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
