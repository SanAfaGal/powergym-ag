import { createClient } from "@/lib/supabase/server";

export type DurationUnit = "day" | "week" | "month" | "year";

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  day: "día(s)",
  week: "semana(s)",
  month: "mes(es)",
  year: "año(s)",
};

export type Plan = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  currency: string;
  duration_unit: DurationUnit;
  duration_count: number;
  is_active: boolean;
  created_at: string;
};

export type PlanPrice = {
  id: string;
  plan_id: string;
  price: number;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
};

export async function listPlans() {
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const withPrices = await Promise.all(
    (plans ?? []).map(async (plan) => ({
      ...(plan as Plan),
      currentPrice: await currentPriceFor(plan.id),
    }))
  );

  return withPrices;
}

export async function getPlan(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Plan;
}

export async function getPriceHistory(planId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_prices")
    .select("*")
    .eq("plan_id", planId)
    .order("valid_from", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlanPrice[];
}

export async function currentPriceFor(planId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plan_price_at", {
    p_plan_id: planId,
  });

  if (error) throw error;
  return data as number | null;
}

export async function isAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_active_admin");
  if (error) throw error;
  return Boolean(data);
}
