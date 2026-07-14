import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinNames, mapClient, mapPlan, mapPlanPrice, computeBasePrice, mapSubscription, mapPaymentMethod, mapPayment } from './transform.mjs';

test('joinNames concatenates when secondary present', () => {
  assert.equal(joinNames('Ana', 'Maria'), 'Ana Maria');
});

test('joinNames returns primary alone when secondary is null', () => {
  assert.equal(joinNames('Ana', null), 'Ana');
});

test('joinNames treats a whitespace-only secondary as absent', () => {
  assert.equal(joinNames('Sayuri', '  '), 'Sayuri');
});

test('joinNames trims whitespace from both names', () => {
  assert.equal(joinNames('  Bonilla   ', '   '), 'Bonilla');
  assert.equal(joinNames(' Ana ', ' Maria '), 'Ana Maria');
});

test('mapClient concatenates first/middle and last/second-last names, lowercases gender, nulls created_by', () => {
  const old = {
    id: 'c1', dni_type: 'CC', dni_number: '123',
    first_name: 'Ana', middle_name: 'Maria',
    last_name: 'Gomez', second_last_name: 'Diaz',
    phone: '555', alternative_phone: null, birth_date: '1990-01-01',
    gender: 'FEMALE', address: 'Calle 1', is_active: true,
    meta_info: { note: 'x' }, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z',
  };
  const result = mapClient(old);
  assert.equal(result.first_name, 'Ana Maria');
  assert.equal(result.last_name, 'Gomez Diaz');
  assert.equal(result.gender, 'female');
  assert.equal(result.created_by, null);
  assert.deepEqual(result.metadata, { note: 'x' });
});

test('mapClient handles missing middle/second-last name and metadata', () => {
  const old = {
    id: 'c2', dni_type: 'CC', dni_number: '124',
    first_name: 'Luis', middle_name: null,
    last_name: 'Perez', second_last_name: null,
    phone: '555', alternative_phone: null, birth_date: '1990-01-01',
    gender: 'MALE', address: null, is_active: true,
    meta_info: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z',
  };
  const result = mapClient(old);
  assert.equal(result.first_name, 'Luis');
  assert.equal(result.last_name, 'Perez');
  assert.deepEqual(result.metadata, {});
});

test('mapPlan lowercases duration_unit', () => {
  const old = {
    id: 'p1', name: 'Mensual', slug: 'mensual', description: null,
    currency: 'COP', duration_unit: 'MONTH', duration_count: 1, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  };
  assert.equal(mapPlan(old).duration_unit, 'month');
});

test('mapPlanPrice derives valid_from from plan created_at date part', () => {
  const old = { id: 'p1', price: 80000, created_at: '2024-03-15T10:20:00Z' };
  const result = mapPlanPrice(old);
  assert.equal(result.plan_id, 'p1');
  assert.equal(result.price, 80000);
  assert.equal(result.valid_from, '2024-03-15');
  assert.equal(result.valid_until, null);
  assert.equal(result.created_by, null);
});

test('computeBasePrice sums payments when present', () => {
  const payments = [{ amount: 40000 }, { amount: 35000 }];
  assert.equal(computeBasePrice(payments, 90000), 75000);
});

test('computeBasePrice falls back to plan price when no payments', () => {
  assert.equal(computeBasePrice([], 90000), 90000);
});

test('mapSubscription lowercases status, computes base_price, nulls discount_amount and created_by', () => {
  const old = {
    id: 's1', client_id: 'c1', plan_id: 'p1',
    start_date: '2024-01-01', end_date: '2024-02-01',
    status: 'ACTIVE', cancellation_date: null, cancellation_reason: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  };
  const result = mapSubscription(old, [{ amount: 90000 }], 90000);
  assert.equal(result.status, 'active');
  assert.equal(result.base_price, 90000);
  assert.equal(result.discount_amount, null);
  assert.equal(result.created_by, null);
  assert.equal(result.final_price, undefined);
});

test('mapSubscription with no payments falls back to plan price', () => {
  const old = {
    id: 's2', client_id: 'c1', plan_id: 'p1',
    start_date: '2024-01-01', end_date: '2024-02-01',
    status: 'CANCELED', cancellation_date: '2024-01-10', cancellation_reason: 'no-show',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-05T00:00:00Z',
  };
  const result = mapSubscription(old, [], 90000);
  assert.equal(result.status, 'canceled');
  assert.equal(result.base_price, 90000);
  assert.equal(result.cancellation_reason, 'no-show');
});

test('mapPaymentMethod maps CASH to cash and QR to bank', () => {
  assert.equal(mapPaymentMethod('CASH'), 'cash');
  assert.equal(mapPaymentMethod('QR'), 'bank');
});

test('mapPaymentMethod rejects unknown method', () => {
  assert.throws(() => mapPaymentMethod('WIRE'));
});

test('mapPayment sets bank_account_id only for bank method', () => {
  const cash = mapPayment(
    { id: 'pay1', subscription_id: 's1', amount: 1000, payment_method: 'CASH', payment_date: '2024-01-01T00:00:00Z' },
    'legacy-acct-id',
  );
  assert.equal(cash.bank_account_id, null);
  assert.equal(cash.payment_method, 'cash');
  assert.equal(cash.received_by, null);
  assert.equal(cash.notes, null);
  assert.equal(cash.created_at, '2024-01-01T00:00:00Z');

  const qr = mapPayment(
    { id: 'pay2', subscription_id: 's1', amount: 1000, payment_method: 'QR', payment_date: '2024-01-01T00:00:00Z' },
    'legacy-acct-id',
  );
  assert.equal(qr.bank_account_id, 'legacy-acct-id');
  assert.equal(qr.payment_method, 'bank');
});
