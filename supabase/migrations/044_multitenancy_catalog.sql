-- ============================================================
-- Migration 044 - Multi-tenancy nas tabelas de catálogo
-- ------------------------------------------------------------
-- Adiciona tenant_id + RLS por tenant + gatilho auto_set_tenant_id em:
--   brands, equipment_models, maintenance_plans, maintenance_plan_items
-- (Estas tabelas ficaram de fora da migration 037 e até aqui eram um
--  catálogo GLOBAL compartilhado por todos os tenants.)
--
-- Execute APÓS 037/038/039 e com cuidado (veja a observação de backfill).
--
-- ⚠️ BACKFILL: todas as linhas existentes destas tabelas são atribuídas
-- ao tenant da Empesa (00000000-0000-0000-0000-000000000001), seguindo o
-- mesmo critério da 037. Se outro tenant já tiver criado marcas/modelos/
-- planos próprios, eles também serão atribuídos à Empesa e precisarão de
-- reatribuição manual. Verifique antes com:
--   select tenant_id, count(*) from public.equipment group by 1;
-- Se só existir o tenant da Empesa, pode rodar com segurança.
-- ============================================================

-- ============================================================
-- 1. Adiciona tenant_id (nullable), backfill, NOT NULL e índice
-- ============================================================
do $$
declare
  tbl   text;
  tbls  text[] := array['brands', 'equipment_models', 'maintenance_plans', 'maintenance_plan_items'];
begin
  foreach tbl in array tbls loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)', tbl);
    execute format(
      'update public.%I set tenant_id = ''00000000-0000-0000-0000-000000000001'' where tenant_id is null', tbl);
    execute format(
      'alter table public.%I alter column tenant_id set not null', tbl);
    execute format(
      'create index if not exists idx_%s_tenant on public.%I(tenant_id)', tbl, tbl);
  end loop;
end $$;

-- ============================================================
-- 2. Unicidade por tenant
--    brands.name era unique global; passa a ser unique por tenant.
-- ============================================================
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'brands_name_key' and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands drop constraint brands_name_key;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'brands_tenant_name_key' and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands add constraint brands_tenant_name_key unique (tenant_id, name);
  end if;
end $$;

-- ============================================================
-- 3. RLS por tenant (substitui as policies permissivas da 001)
-- ============================================================

-- brands -----------------------------------------------------
drop policy if exists "todos_leem_marcas"     on public.brands;
drop policy if exists "admin_geral_marcas_all" on public.brands;

create policy "brands_tenant_read" on public.brands
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "brands_admin_geral" on public.brands
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- equipment_models -------------------------------------------
drop policy if exists "todos_leem_modelos"      on public.equipment_models;
drop policy if exists "admin_geral_modelos_all"  on public.equipment_models;

create policy "models_tenant_read" on public.equipment_models
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "models_admin_geral" on public.equipment_models
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- maintenance_plans ------------------------------------------
drop policy if exists "todos_leem_planos"      on public.maintenance_plans;
drop policy if exists "admin_geral_planos_all"  on public.maintenance_plans;

create policy "plans_tenant_read" on public.maintenance_plans
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "plans_admin_geral" on public.maintenance_plans
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- maintenance_plan_items -------------------------------------
drop policy if exists "todos_leem_itens_plano"      on public.maintenance_plan_items;
drop policy if exists "admin_geral_itens_plano_all"  on public.maintenance_plan_items;

create policy "plan_items_tenant_read" on public.maintenance_plan_items
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "plan_items_admin_geral" on public.maintenance_plan_items
  for all to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral')
  with check (tenant_id = get_my_tenant_id() and get_my_role() = 'admin_geral');

-- ============================================================
-- 4. Gatilho auto_set_tenant_id nos INSERTs
--    (a função já existe desde a 039)
-- ============================================================
drop trigger if exists trg_auto_tenant_id on public.brands;
create trigger trg_auto_tenant_id
  before insert on public.brands
  for each row execute function public.auto_set_tenant_id();

drop trigger if exists trg_auto_tenant_id on public.equipment_models;
create trigger trg_auto_tenant_id
  before insert on public.equipment_models
  for each row execute function public.auto_set_tenant_id();

drop trigger if exists trg_auto_tenant_id on public.maintenance_plans;
create trigger trg_auto_tenant_id
  before insert on public.maintenance_plans
  for each row execute function public.auto_set_tenant_id();

drop trigger if exists trg_auto_tenant_id on public.maintenance_plan_items;
create trigger trg_auto_tenant_id
  before insert on public.maintenance_plan_items
  for each row execute function public.auto_set_tenant_id();
