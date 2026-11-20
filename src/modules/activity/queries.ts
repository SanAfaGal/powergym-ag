import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

// Bogota has no DST: a calendar day there is always [00:00-05:00, next 00:00-05:00).
function dayRange(date: string): { start: string; end: string } {
  const next = format(addDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
  return { start: `${date}T00:00:00-05:00`, end: `${next}T00:00:00-05:00` };
}

type PersonRow = { first_name: string; last_name: string } | null;

function fullName(p: PersonRow | undefined): string {
  return p ? `${p.first_name} ${p.last_name}`.trim() : "Sin cliente";
}

export type ActivitySource = "panel" | "whatsapp";

export type ActivityEntry = {
  number: number;
  at: string;
  client: string;
  concept: string;
  amount: number;
  method: string;
  reportedBy: string | null;
  source: ActivitySource;
};

export type VoidedEntry = ActivityEntry & {
  voidedAt: string;
  voidedBy: string;
  reason: string | null;
};

export type NewDebt = {
  client: string;
  concept: string;
  amount: number;
  reportedBy: string | null;
  at: string;
};

export type TodayActivity = {
  entries: ActivityEntry[];
  voided: VoidedEntry[];
  debts: NewDebt[];
};

type PaymentRow = {
  number: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  source: ActivitySource;
  reported_by: string | null;
  subscriptions: { clients: PersonRow; plans: { name: string } | null } | null;
};

type VoidedPaymentRow = PaymentRow & {
  voided_at: string;
  voided_by: string;
  void_reason: string | null;
};

type SaleRow = {
  number: number;
  amount: number;
  payment_method: string;
  sold_at: string;
  source: ActivitySource;
  reported_by: string | null;
  description: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  products: { name: string } | null;
  clients: PersonRow;
};

type DebtRow = {
  amount: number;
  concept: string | null;
  reported_by: string | null;
  created_at: string;
  status: string;
  clients: PersonRow;
};

const PAYMENT_SELECT =
  "number, amount, payment_method, payment_date, source, reported_by, subscriptions(clients(first_name, last_name), plans(name))";

export async function getTodayActivity(date: string): Promise<TodayActivity> {
  const supabase = await createClient();
  const { start, end } = dayRange(date);

  const [methods, payments, voidedPayments, sales, debts] = await Promise.all([
    supabase.from("payment_types").select("code, name"),
    supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .gte("payment_date", start)
      .lt("payment_date", end),
    supabase
      .from("voided_payments")
      .select(`${PAYMENT_SELECT}, voided_at, voided_by, void_reason`)
      .gte("voided_at", start)
      .lt("voided_at", end),
    supabase
      .from("product_sales")
      .select(
        "number, amount, payment_method, sold_at, source, reported_by, description, voided_at, voided_by, void_reason, products(name), clients(first_name, last_name)"
      )
      .gte("sold_at", start)
      .lt("sold_at", end),
    supabase
      .from("debts")
      .select(
        "amount, concept, reported_by, created_at, status, clients(first_name, last_name)"
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .neq("status", "voided"),
  ]);

  for (const r of [methods, payments, voidedPayments, sales, debts]) {
    if (r.error) throw r.error;
  }

  const methodName = new Map(
    ((methods.data ?? []) as { code: string; name: string }[]).map((m) => [
      m.code,
      m.name,
    ])
  );
  const nameOf = (code: string) => methodName.get(code) ?? code;

  const fromPayment = (p: PaymentRow): ActivityEntry => ({
    number: p.number,
    at: p.payment_date,
    client: fullName(p.subscriptions?.clients),
    concept: p.subscriptions?.plans?.name ?? "Membresía",
    amount: Number(p.amount),
    method: nameOf(p.payment_method),
    reportedBy: p.reported_by,
    source: p.source,
  });

  const fromSale = (s: SaleRow): ActivityEntry => ({
    number: s.number,
    at: s.sold_at,
    client: fullName(s.clients),
    concept: s.products?.name ?? s.description ?? "Producto",
    amount: Number(s.amount),
    method: nameOf(s.payment_method),
    reportedBy: s.reported_by,
    source: s.source,
  });

  const saleRows = (sales.data ?? []) as unknown as SaleRow[];

  const entries = [
    ...((payments.data ?? []) as unknown as PaymentRow[]).map(fromPayment),
    ...saleRows.filter((s) => !s.voided_at).map(fromSale),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const voided: VoidedEntry[] = [
    ...((voidedPayments.data ?? []) as unknown as VoidedPaymentRow[]).map(
      (p) => ({
        ...fromPayment(p),
        voidedAt: p.voided_at,
        voidedBy: p.voided_by,
        reason: p.void_reason,
      })
    ),
    ...saleRows
      .filter((s) => s.voided_at)
      .map((s) => ({
        ...fromSale(s),
        voidedAt: s.voided_at as string,
        voidedBy: s.voided_by ?? "",
        reason: s.void_reason,
      })),
  ].sort((a, b) => b.voidedAt.localeCompare(a.voidedAt));

  const newDebts: NewDebt[] = ((debts.data ?? []) as unknown as DebtRow[])
    .map((d) => ({
      client: fullName(d.clients),
      concept: d.concept ?? "Deuda",
      amount: Number(d.amount),
      reportedBy: d.reported_by,
      at: d.created_at,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));

  return { entries, voided, debts: newDebts };
}

export type OpenDoubt = {
  id: number;
  question: string;
  originalMessage: string;
  reportedBy: string;
  createdAt: string;
};

// Dudas del bot sin resolver. No dependen del día elegido: una duda sigue abierta hasta que alguien la responde o la cierra.
export async function getOpenDoubts(): Promise<OpenDoubt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clarifications")
    .select("id, question, original_message, reported_by, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (
    (data ?? []) as {
      id: number;
      question: string;
      original_message: string;
      reported_by: string;
      created_at: string;
    }[]
  ).map((d) => ({
    id: d.id,
    question: d.question,
    originalMessage: d.original_message,
    reportedBy: d.reported_by,
    createdAt: d.created_at,
  }));
}

// Solo el número, para el globito del menú y el resumen de Inicio.
export async function getOpenDoubtsCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("clarifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}
