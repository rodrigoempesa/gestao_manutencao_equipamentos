-- Migration 037 - Multi-tenancy: tabela tenants + colunas tenant_id + constraints
-- Execute no Supabase SQL Editor em ordem: 037, 038, 039

-- ============================================================
-- 1. Tabela de tenants (empresas)
-- ============================================================

create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- RLS habilitado; gerenciado apenas via service_role (API Admin).
-- Nenhuma policy de usuário autenticado é necessária aqui —
-- o acesso acontece via get_my_tenant_id() (SECURITY DEFINER).
alter table public.tenants enable row level security;

-- ============================================================
-- 2. Seed: tenant inicial para os dados existentes
-- ============================================================

-- Ajuste 'name' e 'slug' conforme o nome real da empresa.
insert into public.tenants (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', 'empresa-padrao');

-- ============================================================
-- 3. Adicionar tenant_id em todas as tabelas de tenant
--    (nullable primeiro para permitir backfill antes do NOT NULL)
-- ============================================================

alter table public.branches
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.equipment
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.readings
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.maintenance_records
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.maintenance_record_items
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.purchase_requests
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.purchase_request_items
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.equipment_branch_transfers
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.work_orders
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.products
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.services
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.access_profiles
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.access_profile_modules
  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.role_module_permissions
  add column if not exists tenant_id uuid references public.tenants(id);

-- ============================================================
-- 4. Backfill: associar todos os dados existentes ao tenant inicial
-- ============================================================

update public.branches                set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.profiles                set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.equipment               set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.readings                set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.maintenance_records     set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.maintenance_record_items set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.purchase_requests       set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.purchase_request_items  set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.equipment_branch_transfers set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.work_orders             set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.products                set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.services                set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.access_profiles         set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.access_profile_modules  set tenant_id = '00000000-0000-0000-0000-000000000001';
update public.role_module_permissions set tenant_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 5. Tornar tenant_id NOT NULL após backfill
-- ============================================================

alter table public.branches               alter column tenant_id set not null;
alter table public.profiles               alter column tenant_id set not null;
alter table public.equipment              alter column tenant_id set not null;
alter table public.readings               alter column tenant_id set not null;
alter table public.maintenance_records    alter column tenant_id set not null;
alter table public.maintenance_record_items alter column tenant_id set not null;
alter table public.purchase_requests      alter column tenant_id set not null;
alter table public.purchase_request_items alter column tenant_id set not null;
alter table public.equipment_branch_transfers alter column tenant_id set not null;
alter table public.work_orders            alter column tenant_id set not null;
alter table public.products               alter column tenant_id set not null;
alter table public.services               alter column tenant_id set not null;
alter table public.access_profiles        alter column tenant_id set not null;
alter table public.access_profile_modules alter column tenant_id set not null;
alter table public.role_module_permissions alter column tenant_id set not null;

-- ============================================================
-- 6. Corrigir unique constraints para escopo por tenant
-- ============================================================

-- equipment.code: era global, passa a ser único por tenant
alter table public.equipment drop constraint if exists equipment_code_key;
alter table public.equipment add constraint equipment_tenant_code_key unique (tenant_id, code);

-- products.code: era global, passa a ser único por tenant
alter table public.products drop constraint if exists products_code_key;
alter table public.products add constraint products_tenant_code_key unique (tenant_id, code);

-- access_profiles.name: era global, passa a ser único por tenant
alter table public.access_profiles drop constraint if exists access_profiles_name_key;
alter table public.access_profiles add constraint access_profiles_tenant_name_key unique (tenant_id, name);

-- work_orders.number: era global, passa a ser único por tenant
alter table public.work_orders drop constraint if exists work_orders_number_key;
alter table public.work_orders add constraint work_orders_tenant_number_key unique (tenant_id, number);

-- role_module_permissions: PK era (role, module_slug), passa a ser (tenant_id, role, module_slug)
alter table public.role_module_permissions drop constraint if exists role_module_permissions_pkey;
alter table public.role_module_permissions add primary key (tenant_id, role, module_slug);

-- ============================================================
-- 7. Índices de performance
-- ============================================================

create index if not exists idx_branches_tenant               on public.branches(tenant_id);
create index if not exists idx_profiles_tenant               on public.profiles(tenant_id);
create index if not exists idx_equipment_tenant              on public.equipment(tenant_id);
create index if not exists idx_readings_tenant               on public.readings(tenant_id);
create index if not exists idx_maintenance_records_tenant    on public.maintenance_records(tenant_id);
create index if not exists idx_maint_record_items_tenant     on public.maintenance_record_items(tenant_id);
create index if not exists idx_purchase_requests_tenant      on public.purchase_requests(tenant_id);
create index if not exists idx_purchase_request_items_tenant on public.purchase_request_items(tenant_id);
create index if not exists idx_transfers_tenant              on public.equipment_branch_transfers(tenant_id);
create index if not exists idx_work_orders_tenant            on public.work_orders(tenant_id);
create index if not exists idx_products_tenant               on public.products(tenant_id);
create index if not exists idx_services_tenant               on public.services(tenant_id);
create index if not exists idx_access_profiles_tenant        on public.access_profiles(tenant_id);
create index if not exists idx_access_profile_modules_tenant on public.access_profile_modules(tenant_id);
create index if not exists idx_rmp_tenant                    on public.role_module_permissions(tenant_id);
