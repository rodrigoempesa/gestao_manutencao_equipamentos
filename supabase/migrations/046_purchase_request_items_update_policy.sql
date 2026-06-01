-- ============================================================
-- Migration 046 - Permite UPDATE em purchase_request_items
-- ------------------------------------------------------------
-- Necessário para registrar o preço unitário REAL pago por item no
-- momento da aprovação da solicitação (reajustes de mercado, descontos,
-- etc.) sem perder o histórico estimado.
--
-- Espelha o padrão das policies de UPDATE em outras tabelas (escopadas
-- por tenant + restritas a admin_geral/admin_local).
-- ============================================================

drop policy if exists "pri_tenant_update" on public.purchase_request_items;

create policy "pri_tenant_update" on public.purchase_request_items
  for update to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );
