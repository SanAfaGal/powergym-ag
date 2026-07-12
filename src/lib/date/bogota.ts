// Client-safe "today" in America/Bogota, matching the DB's today_bogota()
// (supabase/migrations/00000000000011_fix_whole_branch_review_findings.sql).
// new Date().toISOString()'s calendar date is UTC's, which has already
// rolled to tomorrow relative to Bogota from ~19:00 onward -- a form field
// defaulted from that reads one day ahead of what the DB considers "today"
// for the rest of that evening. en-CA formats as YYYY-MM-DD, matching a
// date input's expected value and today_bogota()'s own return type.
export function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}
