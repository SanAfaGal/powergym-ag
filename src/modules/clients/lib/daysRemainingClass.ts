export function daysRemainingClass(days: number) {
  if (days < 0) return "text-destructive";
  if (days <= 3) return "text-warning";
  return "";
}
