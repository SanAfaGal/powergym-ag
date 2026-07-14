import { createClient } from '@supabase/supabase-js';
import {
  mapClient,
  mapPlan,
  mapPlanPrice,
  mapSubscription,
  mapPayment,
} from './transform.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const oldClient = createClient(
  requireEnv('MIGRATION_OLD_URL'),
  requireEnv('MIGRATION_OLD_SERVICE_KEY'),
);
const newClient = createClient(
  requireEnv('MIGRATION_NEW_URL'),
  requireEnv('MIGRATION_NEW_SERVICE_KEY'),
);

async function fetchAll(client, table, columns = '*') {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await client.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const LEGACY_ACCOUNT_NUMBER = 'LEGACY-MIGRACION';

async function ensureLegacyBankAccount() {
  const { data: existing, error: selectError } = await newClient
    .from('bank_accounts')
    .select('id')
    .eq('account_number', LEGACY_ACCOUNT_NUMBER)
    .maybeSingle();
  if (selectError) throw new Error(`ensureLegacyBankAccount select: ${selectError.message}`);
  if (existing) return existing.id;

  const { data: created, error: insertError } = await newClient
    .from('bank_accounts')
    .insert({
      bank_code: 'BANCOLOMBIA',
      account_type_code: 'savings',
      account_number: LEGACY_ACCOUNT_NUMBER,
      account_holder_name: 'Migración datos legacy',
      is_active: false,
    })
    .select('id')
    .single();
  if (insertError) throw new Error(`ensureLegacyBankAccount insert: ${insertError.message}`);
  return created.id;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

async function clearMigratedTables() {
  for (const table of ['payments', 'subscriptions', 'plan_prices', 'plans', 'clients']) {
    const { error } = await newClient.from(table).delete().neq('id', NIL_UUID);
    if (error) throw new Error(`clearMigratedTables(${table}): ${error.message}`);
  }
}

async function insertChunked(table, rows, chunkSize = 50) {
  const failed = [];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await newClient.from(table).insert(chunk);
    if (!error) {
      inserted += chunk.length;
      continue;
    }
    for (const row of chunk) {
      const { error: rowError } = await newClient.from(table).insert([row]);
      if (rowError) {
        failed.push({ id: row.id, error: rowError.message });
      } else {
        inserted += 1;
      }
    }
  }
  return { table, inserted, failed };
}

async function main() {
  console.log('Fetching from OLD...');
  const [oldClients, oldPlans, oldSubscriptions, oldPayments] = await Promise.all([
    fetchAll(oldClient, 'clients'),
    fetchAll(oldClient, 'plans'),
    fetchAll(oldClient, 'subscriptions'),
    fetchAll(oldClient, 'payments'),
  ]);
  console.log(`OLD counts — clients: ${oldClients.length}, plans: ${oldPlans.length}, subscriptions: ${oldSubscriptions.length}, payments: ${oldPayments.length}`);

  const planPriceByPlanId = new Map(oldPlans.map((p) => [p.id, Number(p.price)]));
  const paymentsBySubscriptionId = new Map();
  for (const payment of oldPayments) {
    const list = paymentsBySubscriptionId.get(payment.subscription_id) ?? [];
    list.push(payment);
    paymentsBySubscriptionId.set(payment.subscription_id, list);
  }

  console.log('Ensuring legacy placeholder bank account...');
  const legacyBankAccountId = await ensureLegacyBankAccount();

  console.log('Clearing previously migrated rows in NEW...');
  await clearMigratedTables();

  const mappedClients = oldClients.map(mapClient);
  const mappedPlans = oldPlans.map(mapPlan);
  const mappedPlanPrices = oldPlans.map(mapPlanPrice);
  const mappedSubscriptions = oldSubscriptions.map((s) =>
    mapSubscription(s, paymentsBySubscriptionId.get(s.id) ?? [], planPriceByPlanId.get(s.plan_id)),
  );
  const mappedPayments = oldPayments.map((p) => mapPayment(p, legacyBankAccountId));

  console.log('Inserting into NEW...');
  const results = [];
  results.push(await insertChunked('plans', mappedPlans));
  results.push(await insertChunked('plan_prices', mappedPlanPrices));
  results.push(await insertChunked('clients', mappedClients));
  results.push(await insertChunked('subscriptions', mappedSubscriptions));
  results.push(await insertChunked('payments', mappedPayments));

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`${r.table}: inserted ${r.inserted}, failed ${r.failed.length}`);
    for (const f of r.failed) console.log(`  FAILED id=${f.id}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
