// Three urgency tiers instead of a flat warning/normal split -- 7 days
// mirrors the threshold already used elsewhere for "por vencer" (see
// migration 0037's expiring_within_7_days), so this reads consistently
// with the rest of the app rather than inventing its own cutoff.
// Callers only pass non-negative days -- once a subscription is past its
// end_date, "days remaining" no longer applies and callers show a dash
// instead (the SubscriptionStatusBadge already communicates "Vencida").
export function daysRemainingClass(days: number) {
  if (days <= 3) return "text-destructive";
  if (days <= 7) return "text-warning";
  return "";
}
