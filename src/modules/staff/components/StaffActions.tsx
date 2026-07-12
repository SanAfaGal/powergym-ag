"use client";

import { useState, useTransition } from "react";
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

const SELF_ACTION_TITLE = "No puedes cambiar tu propio rol/estado";

export function StaffActions({
  staff,
  currentUserId,
}: {
  staff: StaffRow;
  currentUserId: string;
}) {
  const [isRolePending, startRoleTransition] = useTransition();
  const [roleError, setRoleError] = useState<string | null>(null);

  // The currently-authenticated admin's own row: disabled here as a cheap,
  // immediate UI guard against self-lockout (demoting or deactivating
  // yourself). The authoritative guard lives in the DB (set_staff_role /
  // set_staff_active, migration 0021), which also covers removing the last
  // OTHER admin -- a case this row-level disable can't catch since it only
  // knows about the current user.
  const isSelf = staff.id === currentUserId;

  function handleRoleChange(value: string | null) {
    if (value !== "admin" && value !== "employee") return;
    if (value === staff.role) return;
    setRoleError(null);
    startRoleTransition(async () => {
      const result = await updateStaffRole(staff.id, value);
      if (!result.success) setRoleError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Select
          value={staff.role}
          onValueChange={handleRoleChange}
          disabled={isRolePending || isSelf}
        >
          <SelectTrigger
            size="sm"
            className="w-[150px]"
            title={isSelf ? SELF_ACTION_TITLE : undefined}
          >
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
          disabled={isSelf}
          disabledTitle={SELF_ACTION_TITLE}
        />
      </div>
      {roleError && <p className="text-xs text-destructive">{roleError}</p>}
    </div>
  );
}
