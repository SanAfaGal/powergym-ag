import { test } from "node:test";
import assert from "node:assert/strict";
import { lastDays, summarizeAttendance } from "./attendance.ts";

// Bogota is UTC-5 all year, so 23:30 Bogota is 04:30Z the next day.
const TODAY = "2026-10-31";

test("no entries means no attendance", () => {
  assert.deepEqual(summarizeAttendance([], TODAY), {
    daysLast12Months: 0,
    daysThisMonth: 0,
    lastVisit: null,
    days: [],
  });
});

test("several entries on one Bogota day count as one attendance", () => {
  const r = summarizeAttendance(
    ["2026-10-20T13:00:00Z", "2026-10-20T22:00:00Z"],
    TODAY,
  );
  assert.equal(r.daysLast12Months, 1);
  assert.equal(r.daysThisMonth, 1);
});

test("the day is decided in Bogota time, not UTC", () => {
  // 2026-10-21T03:00Z is still 2026-10-20 22:00 in Bogota: same day as the first
  const r = summarizeAttendance(
    ["2026-10-20T15:00:00Z", "2026-10-21T03:00:00Z"],
    TODAY,
  );
  assert.equal(r.daysLast12Months, 1);
});

test("this month only counts entries from the current Bogota month", () => {
  const r = summarizeAttendance(
    ["2026-09-30T15:00:00Z", "2026-10-02T15:00:00Z", "2026-10-31T15:00:00Z"],
    TODAY,
  );
  assert.equal(r.daysLast12Months, 3);
  assert.equal(r.daysThisMonth, 2);
});

test("the last visit is the most recent entry, whatever the input order", () => {
  const r = summarizeAttendance(
    ["2026-10-05T15:00:00Z", "2026-10-28T15:00:00Z", "2026-10-01T15:00:00Z"],
    TODAY,
  );
  assert.equal(r.lastVisit, "2026-10-28T15:00:00Z");
});

test("days lists each attended Bogota day once, as yyyy-mm-dd", () => {
  const r = summarizeAttendance(
    ["2026-10-20T13:00:00Z", "2026-10-20T22:00:00Z", "2026-10-21T03:00:00Z", "2026-10-05T15:00:00Z"],
    TODAY,
  );
  assert.deepEqual([...r.days].sort(), ["2026-10-05", "2026-10-20"]);
});

test("lastDays returns the n days ending today, oldest first", () => {
  assert.deepEqual(lastDays("2026-10-31", 3), ["2026-10-29", "2026-10-30", "2026-10-31"]);
});

test("lastDays crosses month and year boundaries", () => {
  assert.deepEqual(lastDays("2027-01-02", 4), [
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]);
});
