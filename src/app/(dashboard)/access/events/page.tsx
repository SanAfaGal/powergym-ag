import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/session";
import {
  AccessBackLink,
  AccessEventsList,
  listAccessEvents,
} from "@/modules/access-control";

const ADMIN_LIMIT = 200;
const EMPLOYEE_LIMIT = 50;

export default async function AccessEventsPage() {
  const auth = await getAuthContext();
  const isAdmin = auth?.profile.role === "admin";

  const events = await listAccessEvents({
    limit: isAdmin ? ADMIN_LIMIT : EMPLOYEE_LIMIT,
    withScores: isAdmin,
  });

  return (
    <div>
      <AccessBackLink />
      <PageHeader
        title="Intentos de acceso"
        description={
          isAdmin
            ? `Los últimos ${ADMIN_LIMIT} intentos, autorizados y denegados.`
            : `Los últimos ${EMPLOYEE_LIMIT} intentos.`
        }
      />
      <AccessEventsList events={events} showScore={isAdmin} />
    </div>
  );
}
