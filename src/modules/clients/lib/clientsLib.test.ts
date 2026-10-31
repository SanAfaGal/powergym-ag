import { test } from "node:test";
import assert from "node:assert/strict";
import { daysRemainingClass } from "./daysRemainingClass.ts";
import { expiredAgo } from "./expiredAgo.ts";
import { toWhatsAppDigits } from "./whatsapp.ts";
import { formatRenewalReminderMessage } from "./formatRenewalReminderMessage.ts";
import { formatRenewalRemindersExcel } from "./formatRenewalRemindersExcel.ts";
import { formatExpiringClientsSummary } from "./formatExpiringClientsSummary.ts";

const TODAY = "2026-10-31";

test("daysRemainingClass has three urgency tiers", () => {
  assert.equal(daysRemainingClass(0), "text-destructive");
  assert.equal(daysRemainingClass(3), "text-destructive");
  assert.equal(daysRemainingClass(4), "text-warning");
  assert.equal(daysRemainingClass(7), "text-warning");
  assert.equal(daysRemainingClass(8), "");
});

test("expiredAgo says 'ayer' for -1 and counts days otherwise", () => {
  assert.equal(expiredAgo(-1), "ayer");
  assert.equal(expiredAgo(-2), "hace 2 días");
  assert.equal(expiredAgo(-30), "hace 30 días");
});

test("toWhatsAppDigits adds the country code once", () => {
  assert.equal(toWhatsAppDigits("3001234567"), "573001234567");
  assert.equal(toWhatsAppDigits("573001234567"), "573001234567");
  assert.equal(toWhatsAppDigits("+57 300 123 4567"), "573001234567");
  assert.equal(toWhatsAppDigits("300-123-4567"), "573001234567");
});

test("the reminder greets the client and says when the membership ends", () => {
  const message = formatRenewalReminderMessage("Ana", "2026-11-15", TODAY);
  assert.ok(message.startsWith("Hola, Ana.\n"));
  assert.match(message, /finaliza el 15\/11 /);
  assert.equal(message.split("\n").length, 4);
});

test("the reminder uses relative words around today", () => {
  assert.match(formatRenewalReminderMessage("Ana", "2026-11-01", TODAY), /finaliza mañana/);
  assert.match(formatRenewalReminderMessage("Ana", "2026-10-31", TODAY), /finaliza hoy/);
  assert.match(formatRenewalReminderMessage("Ana", "2026-10-30", TODAY), /finalizó ayer/);
});

test("a reminder for an older expiry uses the past tense with the date", () => {
  const message = formatRenewalReminderMessage("Ana", "2026-10-20", TODAY);
  assert.match(message, /finalizó el 20\/10 /);
  assert.doesNotMatch(message, /finaliza /);
});

const clients = [
  {
    client_id: "1",
    client_name: "Ana Pérez",
    first_name: "Ana",
    end_date: "2026-10-30",
    plan_name: "Mensual",
    phone: "3001234567",
  },
  {
    client_id: "2",
    client_name: "Luis Gómez",
    first_name: "Luis",
    end_date: "2026-10-30",
    plan_name: null,
    phone: "573009998877",
  },
  {
    client_id: "3",
    client_name: "Eva Ruiz",
    first_name: "Eva",
    end_date: "2026-11-02",
    plan_name: "Anual",
    phone: null,
  },
];

test("the Excel export has one phone and one quoted message per client", () => {
  const text = formatRenewalRemindersExcel(clients, TODAY);
  // messages contain line breaks, so each is quoted into a single cell
  assert.ok(text.includes('+573001234567\t"Hola, Ana.'));
  assert.ok(text.includes('+573009998877\t"Hola, Luis.'));
  assert.ok(text.includes('-\t"Hola, Eva.'));
});

test("the Excel export is empty without clients", () => {
  assert.equal(formatRenewalRemindersExcel([], TODAY), "");
});

test("the summary groups clients under each end date", () => {
  const lines = formatExpiringClientsSummary(
    "2026-10-30",
    "2026-11-02",
    clients,
  ).split("\n");
  assert.match(lines[0], /^Vencimientos .+ – .+$/);
  assert.equal(lines[1], "");
  assert.equal(lines[2], "30 de octubre");
  assert.equal(lines[3], "- Ana Pérez (Mensual)");
  assert.equal(lines[4], "- Luis Gómez");
  assert.equal(lines[5], "");
  assert.equal(lines[6], "02 de noviembre");
  assert.equal(lines[7], "- Eva Ruiz (Anual)");
});

test("the summary title handles open-ended ranges", () => {
  assert.match(
    formatExpiringClientsSummary(undefined, "2026-10-30", []),
    /^Vencimientos hasta /,
  );
  assert.match(
    formatExpiringClientsSummary("2026-10-01", undefined, []),
    /^Vencimientos desde /,
  );
});

test("the summary says so when nobody matches", () => {
  const text = formatExpiringClientsSummary("2026-10-30", "2026-10-30", []);
  assert.match(text, /Sin clientes con vencimiento en este rango$/);
});
