// days_remaining is negative once a subscription has ended (-1 = ended yesterday).
export function expiredAgo(daysRemaining: number): string {
  const days = Math.abs(daysRemaining);
  return days === 1 ? "ayer" : `hace ${days} días`;
}
