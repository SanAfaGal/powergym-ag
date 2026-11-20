import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DebtLine = { concept: string; balance: number; date: string };

export type Debtor = {
  clientId: string;
  name: string;
  phone: string | null;
  total: number;
  since: string;
  lines: DebtLine[];
};

type Row = {
  client_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  total: number | string;
  since: string;
  detail: { concepto: string; saldo: number | string; fecha: string }[];
};

// Quién debe y cuánto: deudas sueltas + saldo de membresías (migración 0061). La más antigua primero.
export async function getDebtors(): Promise<Debtor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("panel_debtors");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    clientId: r.client_id,
    name: `${r.first_name} ${r.last_name}`.trim(),
    phone: r.phone,
    total: Number(r.total),
    since: r.since,
    lines: r.detail.map((l) => ({
      concept: l.concepto,
      balance: Number(l.saldo),
      date: l.fecha,
    })),
  }));
}
