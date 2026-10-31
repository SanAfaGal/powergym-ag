// Stored numbers are the bare local digits (the form shows a "+57" prefix
// as a hint, not part of the value) -- normalize to a full E.164-ish
// digit string for tel:/wa.me links without assuming a fixed length.
// A Colombian mobile starts with 3, so a leading "57" can only be the country
// code (some legacy rows have it baked in).
export function toWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("57") ? digits : `57${digits}`;
}
