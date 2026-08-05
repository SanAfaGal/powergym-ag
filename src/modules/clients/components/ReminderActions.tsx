"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatRenewalReminderMessage } from "../lib/formatRenewalReminderMessage";
import { toWhatsAppDigits } from "./ContactLinks";

// Callers gate rendering on the same condition the "días restantes" column
// already uses (subscription_status === "active" && end_date present) --
// a reminder only makes sense for a client who actually has one to renew.
export function ReminderActions({
  firstName,
  endDate,
  phone,
  today,
}: {
  firstName: string;
  endDate: string;
  phone: string | null;
  today: string;
}) {
  const message = formatRenewalReminderMessage(firstName, endDate, today);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensaje de recordatorio copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Copiar mensaje de recordatorio para ${firstName}`}
        onClick={handleCopy}
      >
        <CopyIcon />
      </Button>
      {phone && (
        <Button
          render={
            <a
              href={`https://wa.me/${toWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
          variant="outline"
          size="icon-sm"
          aria-label={`Enviar recordatorio por WhatsApp a ${firstName}`}
        >
          <MessageCircleIcon />
        </Button>
      )}
    </>
  );
}
