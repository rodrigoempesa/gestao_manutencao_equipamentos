-- ============================================================
-- Migration 048 - Permite DELETE em purchase_request_items
-- ------------------------------------------------------------
-- Necessário para editar itens de uma solicitação de compra pendente
-- (remover itens já adicionados). Mesmo padrão das policies de UPDATE
-- (escopadas por tenant, restritas a admin_geral/admin_local).
-- ============================================================

drop policy if exists "pri_tenant_delete" on public.purchase_request_items;

create policy "pri_tenant_delete" on public.purchase_request_items
  for delete to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );
