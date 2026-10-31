export type AttendanceSummary = {
  // distinct Bogota days with a granted entry in the retained history
  daysLast12Months: number;
  daysThisMonth: number;
  lastVisit: string | null;
};

// "Attendance" = a day on which the client was let in at least once, so
// entering twice on the same day does not count double. The day is decided in
// Bogota time (a 23:30 entry is still that evening, though its UTC date is the
// next day). Only access_events within the 12-month retention are available.
export function summarizeAttendance(
  grantedAt: string[],
  todayIso: string,
): AttendanceSummary {
  const bogotaDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const monthPrefix = todayIso.slice(0, 7);
  const days = new Set<string>();
  const thisMonth = new Set<string>();
  let last: string | null = null;

  for (const iso of grantedAt) {
    const day = bogotaDay(iso);
    days.add(day);
    if (day.startsWith(monthPrefix)) thisMonth.add(day);
    if (last === null || new Date(iso) > new Date(last)) last = iso;
  }

  return {
    daysLast12Months: days.size,
    daysThisMonth: thisMonth.size,
    lastVisit: last,
  };
}
