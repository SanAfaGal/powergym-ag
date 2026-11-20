// Pestañas de la lista de clientes: una sola idea para recorrer la lista.
//  activos  = tienen una membresía vigente (al día o con saldo)
//  deben    = membresía vigente con saldo pendiente
//  antiguos = ya no tienen membresía vigente (vencida, cancelada o nunca tuvieron)
//  todos    = sin filtro por membresía
export type ClientView = "activos" | "deben" | "antiguos" | "todos";
export const CLIENT_VIEWS: ClientView[] = ["activos", "deben", "antiguos", "todos"];
export const DEFAULT_CLIENT_VIEW: ClientView = "activos";

// Estados en los que la membresía cuenta como vigente. "Pendiente de pago" no significa que no pueda entrenar:
// es una membresía en curso que aún no está paga completa (un abono ya la deja así).
export const CURRENT_SUBSCRIPTION_STATUSES = ["active", "pending_payment", "scheduled"] as const;
