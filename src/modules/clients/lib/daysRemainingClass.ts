// Callers only pass non-negative days -- once a subscription is past its
// end_date, "days remaining" no longer applies and callers show a dash
// instead (the SubscriptionStatusBadge already communicates "Vencida").
export function daysRemainingClass(days: number) {
  if (days <= 3) return "text-warning";
  return "";
}
