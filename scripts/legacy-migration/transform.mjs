export function joinNames(primary, secondary) {
  if (!primary || !primary.trim()) throw new Error('joinNames: primary name is required');
  const trimmedPrimary = primary.trim();
  const trimmedSecondary = secondary ? secondary.trim() : '';
  return trimmedSecondary ? `${trimmedPrimary} ${trimmedSecondary}` : trimmedPrimary;
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function mapClient(old) {
  return {
    id: old.id,
    dni_type: old.dni_type,
    dni_number: old.dni_number,
    first_name: joinNames(old.first_name, old.middle_name),
    last_name: joinNames(old.last_name, old.second_last_name),
    alias: null,
    email: null,
    phone: old.phone,
    alternative_phone: old.alternative_phone,
    birth_date: old.birth_date,
    gender: old.gender ? old.gender.toLowerCase() : null,
    address: old.address,
    is_active: old.is_active,
    metadata: old.meta_info ?? {},
    created_by: null,
    created_at: old.created_at,
    updated_at: old.updated_at,
  };
}

export function mapPlan(old) {
  return {
    id: old.id,
    name: old.name,
    slug: old.slug,
    description: old.description,
    currency: old.currency,
    duration_unit: old.duration_unit.toLowerCase(),
    duration_count: old.duration_count,
    is_active: old.is_active,
    created_at: old.created_at,
    updated_at: old.updated_at,
  };
}

export function mapPlanPrice(old) {
  return {
    plan_id: old.id,
    price: old.price,
    valid_from: old.created_at.slice(0, 10),
    valid_until: null,
    created_by: null,
    created_at: old.created_at,
  };
}

export function computeBasePrice(payments, planPrice) {
  if (payments.length === 0) return planPrice;
  return round2(payments.reduce((sum, p) => sum + Number(p.amount), 0));
}

export function mapSubscription(old, payments, planPrice) {
  return {
    id: old.id,
    client_id: old.client_id,
    plan_id: old.plan_id,
    start_date: old.start_date,
    end_date: old.end_date,
    status: old.status.toLowerCase(),
    base_price: computeBasePrice(payments, planPrice),
    discount_amount: null,
    cancellation_date: old.cancellation_date,
    cancellation_reason: old.cancellation_reason,
    created_by: null,
    created_at: old.created_at,
    updated_at: old.updated_at,
  };
}

export function mapPaymentMethod(old) {
  if (old === 'CASH') return 'cash';
  if (old === 'QR') return 'bank';
  throw new Error(`mapPaymentMethod: unknown legacy payment_method "${old}"`);
}

export function mapPayment(old, legacyBankAccountId) {
  const payment_method = mapPaymentMethod(old.payment_method);
  return {
    id: old.id,
    subscription_id: old.subscription_id,
    amount: old.amount,
    payment_method,
    payment_date: old.payment_date,
    received_by: null,
    notes: null,
    bank_account_id: payment_method === 'bank' ? legacyBankAccountId : null,
    created_at: old.payment_date,
  };
}
