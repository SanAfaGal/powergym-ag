import { PageHeader } from "@/components/layout/PageHeader";
import { Pager } from "@/components/shared/Pager";
import { getAuthContext } from "@/lib/auth/session";
import {
  AccessBackLink,
  AccessEventFilters,
  AccessEventsList,
  listAccessEvents,
} from "@/modules/access-control";

const PAGE_SIZE = 25;
// Non-admins browse the most recent entries only.
const EMPLOYEE_MAX_ROWS = 50;

export default async function AccessEventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    result?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const auth = await getAuthContext();
  const isAdmin = auth?.profile.role === "admin";

  const result =
    params.result === "granted" || params.result === "denied"
      ? params.result
      : "all";
  const q = params.q ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const { events, total } = await listAccessEvents({
    result: result === "all" ? undefined : result,
    q,
    from,
    to,
    page,
    pageSize: PAGE_SIZE,
    maxRows: isAdmin ? undefined : EMPLOYEE_MAX_ROWS,
    withScores: isAdmin,
  });

  function buildHref(targetPage: number) {
    const p = new URLSearchParams();
    if (result !== "all") p.set("result", result);
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/access/events?${qs}` : "/access/events";
  }

  return (
    <div>
      <AccessBackLink />
      <PageHeader
        title="Intentos de acceso"
        description={
          isAdmin
            ? "Todos los intentos, autorizados y denegados."
            : `Los últimos ${EMPLOYEE_MAX_ROWS} intentos.`
        }
      />
      <AccessEventFilters result={result} defaultQuery={q} from={from} to={to} />
      <AccessEventsList events={events} showScore={isAdmin} />
      <div className="mt-4">
        <Pager
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          buildHref={buildHref}
          itemLabel="intentos"
        />
      </div>
    </div>
  );
}
