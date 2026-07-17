-- Drop "Otro" from gender_types: the app only distinguishes masculino/femenino.
-- Null out any client rows still pointing at it first so the delete never
-- trips the clients_gender_fkey constraint.
update public.clients set gender = null where gender = 'other';

delete from public.gender_types where code = 'other';
