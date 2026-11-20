-- Migración 0065: las tablas de dinero del bot entran al registro de auditoría (audit_log, migración 0053).
-- La convención del repo (CLAUDE.md) es poner audit_row_change() en toda tabla de dinero nueva.
-- Las del bot que guardan dinero o precios: deudas, abonos a deudas, pagos anulados, ventas de producto
-- y el catálogo de productos. NO se auditan las tablas de trabajo del bot (mensajes crudos, propuestas
-- pendientes, dudas, events): son operativas, repiten textos de WhatsApp y sus cambios ya quedan en events.
-- El bot escribe con la llave de servicio, sin usuario: actor_id queda en null (la columna lo permite);
-- quién lo reportó está en reported_by de cada fila.

create trigger audit_debts
  after insert or update or delete on public.debts
  for each row execute function public.audit_row_change();
create trigger audit_debt_payments
  after insert or update or delete on public.debt_payments
  for each row execute function public.audit_row_change();
create trigger audit_voided_payments
  after insert or update or delete on public.voided_payments
  for each row execute function public.audit_row_change();
create trigger audit_product_sales
  after insert or update or delete on public.product_sales
  for each row execute function public.audit_row_change();
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
