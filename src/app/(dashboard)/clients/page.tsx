import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  listClients,
  ClientList,
  ClientFilters,
  Pager,
} from "@/modules/clients";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";
  const page = Math.max(1, Number(params.page) || 1);

  const { clients, total, pageSize } = await listClients({ q, status, page });

  function buildHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Buscá, registrá y gestioná los clientes del gimnasio."
        actions={
          <Button render={<Link href="/clients/new" />} nativeButton={false}>
            Nuevo cliente
          </Button>
        }
      />

      <div className="mb-4">
        <ClientFilters defaultQuery={q} status={status} />
      </div>

      <ClientList
        clients={clients}
        hasFilters={Boolean(q) || status !== "all"}
      />

      <div className="mt-4">
        <Pager
          page={page}
          total={total}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </div>
    </div>
  );
}
