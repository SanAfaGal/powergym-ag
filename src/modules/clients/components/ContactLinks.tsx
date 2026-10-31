import { MessageCircleIcon, PhoneIcon } from "lucide-react";

import { toWhatsAppDigits } from "../lib/whatsapp";

export function ContactLinks({ phone }: { phone: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {phone}
      <a
        href={`tel:${phone}`}
        aria-label={`Llamar a ${phone}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <PhoneIcon className="size-3.5" />
      </a>
      <a
        href={`https://wa.me/${toWhatsAppDigits(phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp a ${phone}`}
        className="text-muted-foreground hover:text-success"
      >
        <MessageCircleIcon className="size-3.5" />
      </a>
    </span>
  );
}
