// Turns the yyyy-mm-dd filters of the audit log into timestamptz bounds in
// Bogota time (UTC-5 all year, no DST). `to` is inclusive for the user, so the
// bound handed to the query is midnight of the NEXT day, used with `<`.
function valid(iso: string | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function bogotaRange(
  from: string | undefined,
  to: string | undefined,
): { fromIso: string | undefined; toExclusiveIso: string | undefined } {
  return {
    fromIso: valid(from) ? `${from}T00:00:00-05:00` : undefined,
    toExclusiveIso: valid(to) ? `${nextDay(to)}T00:00:00-05:00` : undefined,
  };
}
