"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStaffRole } from "../actions";
import type { StaffRow } from "../queries";
import { DeactivateStaffDialog } from "./DeactivateStaffDialog";

const ROLE_LABELS: Record<StaffRow["role"], string> = {
  admin: "Administrador",
  employee: "Empleado",
};

export function StaffActions({ staff }: { staff: StaffRow }) {
  const [isRolePending, startRoleTransition] = useTransition();

  function handleRoleChange(value: string | null) {
    if (value !== "admin" && value !== "employee") return;
    if (value === staff.role) return;
    startRoleTransition(async () => {
      await updateStaffRole(staff.id, value);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={staff.role}
        onValueChange={handleRoleChange}
        disabled={isRolePending}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue>
            {(value: string) => ROLE_LABELS[value as StaffRow["role"]]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="employee">Empleado</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
        </SelectContent>
      </Select>
      <DeactivateStaffDialog
        staffId={staff.id}
        staffName={staff.full_name}
        isActive={staff.is_active}
      />
    </div>
  );
}
