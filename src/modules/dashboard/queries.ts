import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/date/bogota";

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "pending_payment"
  | "scheduled"
  | "canceled";

export type DashboardStats = {
  client_stats: { total_active_clients: number; new_clients_in_range: number };
  subscription_stats: Partial<Record<SubscriptionStatus, number>>;
  financial_stats: {
    revenue_in_range: number;
    revenue_by_method: Record<string, number>;
    pending_debt: number;
  };
  alerts: { expiring_within_7_days: number };
};

export type DebtorRow = {
  subscription_id: string;
  client_id: string;
  client_name: string;
  plan_name: string;
  status: SubscriptionStatus;
  remaining: number;
};

export type RevenueByAccountRow = {
  bank_account_id: string;
  total: number;
  methods: { payment_method: string; amount: number }[];
};

export type ExpiringRow = {
  subscription_id: string;
  client_id: string;
  client_name: string;
  plan_name: string;
  end_date: string;
  remaining: number;
};

function sumPayments(payments: { amount: number }[] | null) {
  return (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
}

export async function getDashboardStats(
  start: string,
  end: string
): Promise<DashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_start: start,
    p_end: end,
  });

  if (error) throw error;
  return data as DashboardStats;
}

export async function listRevenueByBankAccount(
  start: string,
  end: string
): Promise<RevenueByAccountRow[]> {
  const supabase = await createClient();
  // payment_date is a timestamptz -- end is a plain date, so compare against
  // the exclusive upper bound (start of the next day) rather than `lte`,
  // which would silently drop same-day payments made after midnight.
  const endExclusive = format(
    addDays(new Date(`${end}T00:00:00`), 1),
    "yyyy-MM-dd"
  );

  const { data, error } = await supabase
    .from("payments")
    .select("amount, bank_account_id, payment_method")
    .not("bank_account_id", "is", null)
    .gte("payment_date", start)
    .lt("payment_date", endExclusive);

  if (error) throw error;

  // Grouped by account first, then by the method that landed in it -- an
  // account can receive money through more than one electronic method.
  const byAccount = new Map<string, Map<string, number>>();
  for (const p of (data ?? []) as {
    amount: number;
    bank_account_id: string;
    payment_method: string;
  }[]) {
    const methodTotals = byAccount.get(p.bank_account_id) ?? new Map();
    methodTotals.set(
      p.payment_method,
      (methodTotals.get(p.payment_method) ?? 0) + p.amount
    );
    byAccount.set(p.bank_account_id, methodTotals);
  }

  return [...byAccount.entries()]
    .map(([bank_account_id, methodTotals]) => {
      const methods = [...methodTotals.entries()].map(
        ([payment_method, amount]) => ({ payment_method, amount })
      );
      return {
        bank_account_id,
        total: methods.reduce((sum, m) => sum + m.amount, 0),
        methods,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function listDebtors(): Promise<DebtorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(name), clients(first_name, last_name), payments(amount)")
    .in("status", ["active", "pending_payment"]);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const { id, client_id, status, final_price, plans, clients, payments } =
        row as {
          id: string;
          client_id: string;
          status: SubscriptionStatus;
          final_price: number;
          plans: { name: string } | null;
          clients: { first_name: string; last_name: string } | null;
          payments: { amount: number }[] | null;
        };
      const paid = sumPayments(payments);
      return {
        subscription_id: id,
        client_id,
        client_name: clients
          ? `${clients.first_name} ${clients.last_name}`
          : "",
        plan_name: plans?.name ?? "",
        status,
        remaining: Math.max(final_price - paid, 0),
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

export async function listExpiringSoon(days = 7): Promise<ExpiringRow[]> {
  const supabase = await createClient();
  const today = bogotaToday();
  const limit = format(addDays(new Date(`${today}T00:00:00`), days), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(name), clients(first_name, last_name), payments(amount)")
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", limit)
    .order("end_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { id, client_id, end_date, final_price, plans, clients, payments } =
      row as {
        id: string;
        client_id: string;
        end_date: string;
        final_price: number;
        plans: { name: string } | null;
        clients: { first_name: string; last_name: string } | null;
        payments: { amount: number }[] | null;
      };
    const paid = sumPayments(payments);
    return {
      subscription_id: id,
      client_id,
      client_name: clients ? `${clients.first_name} ${clients.last_name}` : "",
      plan_name: plans?.name ?? "",
      end_date,
      remaining: Math.max(final_price - paid, 0),
    };
  });
}
