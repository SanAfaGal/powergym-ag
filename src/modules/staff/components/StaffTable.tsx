import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffRoleBadge } from "./StaffRoleBadge";
import { StaffActions } from "./StaffActions";
import type { StaffRow } from "../queries";

export function StaffTable({ staff }: { staff: StaffRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="sticky right-0 bg-card text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">
                {member.full_name}
              </TableCell>
              <TableCell>
                <StaffRoleBadge role={member.role} />
              </TableCell>
              <TableCell>
                <StatusBadge isActive={member.is_active} />
              </TableCell>
              <TableCell className="sticky right-0 flex justify-end gap-2 bg-card text-right">
                <StaffActions staff={member} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
