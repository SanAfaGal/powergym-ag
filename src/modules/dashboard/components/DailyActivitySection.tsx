import { getDailyActivity } from "../queries";
import { DailyActivityCard } from "./DailyActivityCard";

export async function DailyActivitySection({ date }: { date: string }) {
  const payments = await getDailyActivity(date);
  return <DailyActivityCard date={date} payments={payments} />;
}
