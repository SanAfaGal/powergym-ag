import { StaffTable } from "./StaffTable";
import { StaffCards } from "./StaffCards";
import type { StaffRow } from "../queries";

export function StaffList({ staff }: { staff: StaffRow[] }) {
  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">Todavía no hay usuarios de staff registrados</p>
      </div>
    );
  }

  return (
    <>
      <StaffTable staff={staff} />
      <StaffCards staff={staff} />
    </>
  );
}
