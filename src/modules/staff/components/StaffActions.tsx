"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStaffRole, setStaffActive } from "../actions";
import type { StaffRow } from "../queries";

const ROLE_LABELS: Record<StaffRow["role"], string> = {
  admin: "Administrador",
  employee: "Empleado",
};

export function StaffActions({ staff }: { staff: StaffRow }) {
  const [isRolePending, startRoleTransition] = useTransition();
  const [isActivePending, startActiveTransition] = useTransition();

  function handleRoleChange(value: string | null) {
    if (value !== "admin" && value !== "employee") return;
    if (value === staff.role) return;
    startRoleTransition(async () => {
      await updateStaffRole(staff.id, value);
    });
  }

  function handleToggleActive() {
    startActiveTransition(async () => {
      await setStaffActive(staff.id, !staff.is_active);
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
      <Button
        type="button"
        variant={staff.is_active ? "destructive" : "outline"}
        size="sm"
        onClick={handleToggleActive}
        disabled={isActivePending}
      >
        {isActivePending
          ? "Guardando..."
          : staff.is_active
            ? "Desactivar"
            : "Activar"}
      </Button>
    </div>
  );
}
