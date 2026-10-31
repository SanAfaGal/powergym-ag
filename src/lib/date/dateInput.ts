// Typed dates, as the date fields show them: dd/mm/yyyy. Values elsewhere in the
// app are "yyyy-MM-dd" strings (see bogota.ts); these helpers only translate.

const MIN_YEAR = 1900;

// Keeps the digits (at most 8) and puts the slashes in as you type:
// "12102026" -> "12/10/2026".
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "dd/mm/yyyy" -> "yyyy-MM-dd", or null when it is incomplete, not a real date,
// from before 1900 or outside min/max (both inclusive, "yyyy-MM-dd").
export function parseTypedDate(
  text: string,
  { min, max }: { min?: string; max?: string },
): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1) return null;

  // a real calendar day: the date rolls over if the day does not exist
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (min && iso < min) return null;
  if (max && iso > max) return null;
  return iso;
}

export function formatDateValue(value: string | undefined): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
