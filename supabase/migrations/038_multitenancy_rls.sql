-- Migration 038 - Multi-tenancy: função get_my_tenant_id + RLS por tenant
-- Execute após 037

-- ============================================================
-- 1. Função auxiliar get_my_tenant_id()
--    Espelha o padrão de get_my_role() / get_my_branch_id()
-- ============================================================

create or replace function public.get_my_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- 2. Remover todas as policies antigas das tabelas de tenant
-- ============================================================

-- branches
drop policy if exists "admin_geral_branches_all" on public.branches;
drop policy if exists "outros_branches_propria"   on public.branches;

-- profiles
drop policy if exists "admin_geral_profiles_all"           on public.profiles;
drop policy if exists "admin_local_profiles_filial"        on public.profiles;
drop policy if exists "admin_local_profiles_write_filial"  on public.profiles;
drop policy if exists "encarregado_proprio_perfil"         on public.profiles;

-- equipment
drop policy if exists "admin_geral_equipment_all"            on public.equipment;
drop policy if exists "admin_local_equipment_filial"         on public.equipment;
drop policy if exists "encarregado_equipment_filial_leitura" on public.equipment;

-- readings
drop policy if exists "admin_geral_readings_all"    on public.readings;
drop policy if exists "admin_local_readings_filial" on public.readings;
drop policy if exists "encarregado_readings_filial" on public.readings;

-- maintenance_records
drop policy if exists "admin_geral_maintenance_all"            on public.maintenance_records;
drop policy if exists "admin_local_maintenance_filial"         on public.maintenance_records;
drop policy if exists "encarregado_maintenance_filial_leitura" on public.maintenance_records;

-- maintenance_record_items
drop policy if exists "admin_geral_record_items_all"    on public.maintenance_record_items;
drop policy if exists "admin_local_record_items_filial" on public.maintenance_record_items;
drop policy if exists "encarregado_record_items_read"   on public.maintenance_record_items;

-- products
drop policy if exists "todos_leem_produtos"         on public.products;
drop policy if exists "admin_geral_produtos_all"    on public.products;
drop policy if exists "admin_local_produtos_write"  on public.products;
drop policy if exists "admin_local_produtos_update" on public.products;

-- services
drop policy if exists "todos_leem_servicos"      on public.services;
drop policy if exists "admin_geral_servicos_all" on public.services;

-- purchase_requests
drop policy if exists "pr_select" on public.purchase_requests;
drop policy if exists "pr_insert" on public.purchase_requests;
drop policy if exists "pr_update" on public.purchase_requests;

-- purchase_request_items
drop policy if exists "pri_select" on public.purchase_request_items;
drop policy if exists "pri_insert" on public.purchase_request_items;

-- role_module_permissions
drop policy if exists "rmp_read_all"    on public.role_module_permissions;
drop policy if exists "rmp_admin_write" on public.role_module_permissions;

-- access_profiles
drop policy if exists "access_profiles: admin_geral full"   on public.access_profiles;
drop policy if exists "access_profiles: authenticated read" on public.access_profiles;

-- access_profile_modules
drop policy if exists "access_profile_modules: admin_geral full"   on public.access_profile_modules;
drop policy if exists "access_profile_modules: authenticated read" on public.access_profile_modules;

-- equipment_branch_transfers
drop policy if exists "Autenticados podem ver transferências" on public.equipment_branch_transfers;
drop policy if exists "Admins podem inserir transferências"   on public.equipment_branch_transfers;

-- work_orders
drop policy if exists "Autenticados podem ver OS"       on public.work_orders;
drop policy if exists "Autenticados podem criar OS"     on public.work_orders;
drop policy if exists "Autenticados podem atualizar OS" on public.work_orders;

-- ============================================================
-- 3. Recriar policies com isolamento por tenant
--    Padrão: tenant_id = get_my_tenant_id() AND (regra de papel)
-- ============================================================

-- ── branches ──────────────────────────────────────────────────

create policy "branches_admin_geral" on public.branches
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "branches_outros_propria" on public.branches
  for select to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_local', 'encarregado')
    and id = get_my_branch_id()
  );

-- ── profiles ──────────────────────────────────────────────────

create policy "profiles_admin_geral" on public.profiles
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "profiles_admin_local_select" on public.profiles
  for select to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and (branch_id = get_my_branch_id() or id = auth.uid())
  );

create policy "profiles_admin_local_update" on public.profiles
  for update to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and branch_id = get_my_branch_id()
    and role = 'encarregado'
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and branch_id = get_my_branch_id()
    and role = 'encarregado'
  );

create policy "profiles_proprio" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ── equipment ─────────────────────────────────────────────────

create policy "equipment_admin_geral" on public.equipment
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "equipment_admin_local" on public.equipment
  for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and branch_id = get_my_branch_id()
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and branch_id = get_my_branch_id()
  );

create policy "equipment_encarregado_read" on public.equipment
  for select to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'encarregado'
    and branch_id = get_my_branch_id()
  );

-- ── readings ──────────────────────────────────────────────────

create policy "readings_admin_geral" on public.readings
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "readings_admin_local" on public.readings
  for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  );

create policy "readings_encarregado" on public.readings
  for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  );

-- ── maintenance_records ───────────────────────────────────────

create policy "maintenance_records_admin_geral" on public.maintenance_records
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "maintenance_records_admin_local" on public.maintenance_records
  for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  );

create policy "maintenance_records_encarregado_read" on public.maintenance_records
  for select to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment
      where branch_id = get_my_branch_id()
    )
  );

-- ── maintenance_record_items ──────────────────────────────────

create policy "maint_items_admin_geral" on public.maintenance_record_items
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "maint_items_admin_local" on public.maintenance_record_items
  for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = get_my_branch_id()
    )
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'admin_local'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = get_my_branch_id()
    )
  );

create policy "maint_items_encarregado_read" on public.maintenance_record_items
  for select to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() = 'encarregado'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = get_my_branch_id()
    )
  );

-- ── products ──────────────────────────────────────────────────

create policy "products_tenant_read" on public.products
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "products_admin_geral" on public.products
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

create policy "products_admin_local_insert" on public.products
  for insert to authenticated
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_local');

create policy "products_admin_local_update" on public.products
  for update to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_local')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_local');

-- ── services ──────────────────────────────────────────────────

create policy "services_tenant_read" on public.services
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "services_admin_geral" on public.services
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- ── purchase_requests ─────────────────────────────────────────

create policy "pr_tenant_select" on public.purchase_requests
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "pr_tenant_insert" on public.purchase_requests
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

create policy "pr_tenant_update" on public.purchase_requests
  for update to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

-- ── purchase_request_items ────────────────────────────────────

create policy "pri_tenant_select" on public.purchase_request_items
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "pri_tenant_insert" on public.purchase_request_items
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

-- ── role_module_permissions ───────────────────────────────────

create policy "rmp_tenant_read" on public.role_module_permissions
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "rmp_admin_geral_write" on public.role_module_permissions
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- ── access_profiles ───────────────────────────────────────────

create policy "access_profiles_tenant_read" on public.access_profiles
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "access_profiles_admin_geral" on public.access_profiles
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- ── access_profile_modules ────────────────────────────────────

create policy "apm_tenant_read" on public.access_profile_modules
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "apm_admin_geral" on public.access_profile_modules
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- ── equipment_branch_transfers ────────────────────────────────

create policy "transfers_tenant_read" on public.equipment_branch_transfers
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "transfers_admin_insert" on public.equipment_branch_transfers
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

-- ── work_orders ───────────────────────────────────────────────

create policy "wo_tenant_read" on public.work_orders
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "wo_tenant_insert" on public.work_orders
  for insert to authenticated
  with check (tenant_id = get_my_tenant_id());

create policy "wo_tenant_update" on public.work_orders
  for update to authenticated
  using  (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());
