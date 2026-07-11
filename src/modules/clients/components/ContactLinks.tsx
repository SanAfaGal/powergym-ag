import { MessageCircleIcon, PhoneIcon } from "lucide-react";

// Stored numbers are the bare local digits (the form shows a "+57" prefix
// as a hint, not part of the value) -- normalize to a full E.164-ish
// digit string for tel:/wa.me links without assuming a fixed length.
function toWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("57") ? digits : `57${digits}`;
}

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
