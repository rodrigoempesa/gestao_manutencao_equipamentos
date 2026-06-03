-- ============================================================
-- Migration 051 - Permissões de SELECT para o papel visualizador
-- ------------------------------------------------------------
-- As policies de SELECT em equipment, branches, readings,
-- maintenance_records, maintenance_record_items e profiles eram
-- definidas por papel (admin_geral / admin_local / encarregado).
-- O visualizador não batia em nenhuma → enxergava 0 linhas.
--
-- Aqui adicionamos policies específicas escopadas por tenant. O
-- visualizador "todas as filiais" vê tudo do tenant. (Se quiser
-- visualizador por filial no futuro, é só adicionar um filtro extra
-- de branch_id nessas policies.)
-- ============================================================

drop policy if exists "equipment_visualizador_read"          on public.equipment;
drop policy if exists "branches_visualizador_read"           on public.branches;
drop policy if exists "readings_visualizador_read"           on public.readings;
drop policy if exists "maintenance_records_visualizador_read" on public.maintenance_records;
drop policy if exists "maint_items_visualizador_read"        on public.maintenance_record_items;
drop policy if exists "profiles_visualizador_read"           on public.profiles;

create policy "equipment_visualizador_read" on public.equipment
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');

create policy "branches_visualizador_read" on public.branches
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');

create policy "readings_visualizador_read" on public.readings
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');

create policy "maintenance_records_visualizador_read" on public.maintenance_records
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');

create policy "maint_items_visualizador_read" on public.maintenance_record_items
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');

create policy "profiles_visualizador_read" on public.profiles
  for select to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() = 'visualizador');
