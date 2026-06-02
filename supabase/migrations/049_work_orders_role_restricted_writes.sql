-- ============================================================
-- Migration 049 - Restringe writes em work_orders aos papéis operacionais
-- ------------------------------------------------------------
-- Permite o papel "visualizador" (read-only): visualizador continua lendo
-- tudo (wo_tenant_read não muda), mas não pode mais inserir nem alterar.
-- ============================================================

drop policy if exists "wo_tenant_insert" on public.work_orders;
drop policy if exists "wo_tenant_update" on public.work_orders;

create policy "wo_tenant_insert" on public.work_orders
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local', 'encarregado')
  );

create policy "wo_tenant_update" on public.work_orders
  for update to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local', 'encarregado')
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local', 'encarregado')
  );
