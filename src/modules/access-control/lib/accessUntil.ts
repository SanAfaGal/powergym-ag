export type AccessUntil = {
  headline: string;
  detail: string | null;
  tone: "ok" | "last" | "expired";
};

const DAY_MS = 86_400_000;

function parse(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function longDate(utcMs: number): string {
  return new Date(utcMs).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

// Tells the staff (and the client) up to which day entry is allowed, in plain
// words, instead of a bare "expires" date. Both arguments are yyyy-mm-dd in
// Bogota time; the count uses UTC math on those dates, so no timezone drift.
export function describeAccessUntil(
  endDate: string,
  todayIso: string,
): AccessUntil | null {
  const end = parse(endDate);
  const today = parse(todayIso);
  if (end === null || today === null) return null;

  const diff = Math.round((end - today) / DAY_MS);
  if (diff > 0) {
    return {
      headline: `Puede ingresar hasta el ${longDate(end)}`,
      detail: `${diff === 1 ? "Le queda" : "Le quedan"} ${days(diff)}`,
      tone: "ok",
    };
  }
  if (diff === 0) {
    return { headline: "Hoy es su último día de acceso", detail: null, tone: "last" };
  }
  return {
    headline: `Su membresía venció el ${longDate(end)}`,
    detail: `Hace ${days(-diff)}`,
    tone: "expired",
  };
}
