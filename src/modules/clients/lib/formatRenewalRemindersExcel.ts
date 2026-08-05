import type { ExpiringClient } from "../queries";
import { formatRenewalReminderMessage } from "./formatRenewalReminderMessage";
import { toWhatsAppDigits } from "../components/ContactLinks";

// RFC4180-style quoting: without it, a multi-line message pasted into Excel
// spills across extra rows instead of staying in one "Mensaje" cell.
function tsvField(value: string): string {
  return /[\t\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Two columns only (no Nombre) -- the message already greets the client by
// name, so staff just need the phone to paste into WhatsApp Web and the
// message to paste alongside it.
export function formatRenewalRemindersExcel(
  clients: ExpiringClient[],
  today: string
): string {
  return clients
    .map((c) => {
      // toWhatsAppDigits already handles phones stored with or without the
      // country code -- some production rows have "57"/"+57" baked in from
      // a legacy import, so blindly prefixing "+57" here double-counted it.
      const phone = c.phone ? `+${toWhatsAppDigits(c.phone)}` : "-";
      const message = formatRenewalReminderMessage(c.first_name, c.end_date, today);
      return `${tsvField(phone)}\t${tsvField(message)}`;
    })
    .join("\n");
}
