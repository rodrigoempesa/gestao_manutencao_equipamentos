-- Migration 037 - Multi-tenancy: tabela tenants + colunas tenant_id + constraints
-- Execute no Supabase SQL Editor em ordem: 037, 038, 039
-- Esta migration é resiliente: tabelas que ainda não existem no banco são silenciosamente ignoradas.

-- ============================================================
-- 1. Tabela de tenants (empresas)
-- ============================================================

create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- RLS habilitado; gerenciado apenas via service_role (API Admin).
alter table public.tenants enable row level security;

-- ============================================================
-- 2. Seed: tenant inicial para os dados existentes
--    Ajuste 'name' e 'slug' para o nome real da sua empresa.
-- ============================================================

insert into public.tenants (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', 'empresa-padrao')
on conflict (id) do nothing;

-- ============================================================
-- 3. Adicionar tenant_id, backfill e NOT NULL em todas as
--    tabelas de tenant que existirem no banco.
--    Tabelas ausentes (migrations pendentes) são ignoradas.
-- ============================================================

do $$
declare
  tbl text;
  tbls text[] := array[
    'branches',
    'profiles',
    'equipment',
    'readings',
    'maintenance_records',
    'maintenance_record_items',
    'purchase_requests',
    'purchase_request_items',
    'equipment_branch_transfers',
    'work_orders',
    'products',
    'services',
    'access_profiles',
    'access_profile_modules',
    'role_module_permissions'
  ];
begin
  foreach tbl in array tbls loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      -- Adiciona coluna (nullable primeiro)
      execute format(
        'alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)',
        tbl
      );
      -- Backfill
      execute format(
        'update public.%I set tenant_id = ''00000000-0000-0000-0000-000000000001'' where tenant_id is null',
        tbl
      );
      -- NOT NULL
      execute format(
        'alter table public.%I alter column tenant_id set not null',
        tbl
      );
      -- Índice de performance
      execute format(
        'create index if not exists idx_%s_tenant on public.%I(tenant_id)',
        tbl, tbl
      );
      raise notice 'tenant_id adicionado em: %', tbl;
    else
      raise notice 'Tabela % não existe ainda — ignorando (execute a migration correspondente antes de usar essa tabela)', tbl;
    end if;
  end loop;
end $$;

-- ============================================================
-- 4. Corrigir unique constraints para escopo por tenant
--    (apenas para tabelas que existirem)
-- ============================================================

-- equipment.code
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='equipment') then
    alter table public.equipment drop constraint if exists equipment_code_key;
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='equipment' and constraint_name='equipment_tenant_code_key'
    ) then
      alter table public.equipment add constraint equipment_tenant_code_key unique (tenant_id, code);
    end if;
  end if;
end $$;

-- products.code
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='products') then
    alter table public.products drop constraint if exists products_code_key;
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='products' and constraint_name='products_tenant_code_key'
    ) then
      alter table public.products add constraint products_tenant_code_key unique (tenant_id, code);
    end if;
  end if;
end $$;

-- access_profiles.name
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='access_profiles') then
    alter table public.access_profiles drop constraint if exists access_profiles_name_key;
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='access_profiles' and constraint_name='access_profiles_tenant_name_key'
    ) then
      alter table public.access_profiles add constraint access_profiles_tenant_name_key unique (tenant_id, name);
    end if;
  end if;
end $$;

-- work_orders.number
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='work_orders') then
    alter table public.work_orders drop constraint if exists work_orders_number_key;
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='work_orders' and constraint_name='work_orders_tenant_number_key'
    ) then
      alter table public.work_orders add constraint work_orders_tenant_number_key unique (tenant_id, number);
    end if;
  end if;
end $$;

-- ============================================================
-- 5. role_module_permissions: PK (role, module_slug) →
--    (tenant_id, role, module_slug)
-- ============================================================

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='role_module_permissions') then
    if exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='role_module_permissions'
        and constraint_name='role_module_permissions_pkey'
        and constraint_type='PRIMARY KEY'
    ) then
      -- Verifica se tenant_id já está na PK antes de recriar
      if not exists (
        select 1 from information_schema.key_column_usage
        where table_schema='public' and table_name='role_module_permissions'
          and constraint_name='role_module_permissions_pkey'
          and column_name='tenant_id'
      ) then
        alter table public.role_module_permissions drop constraint role_module_permissions_pkey;
        alter table public.role_module_permissions add primary key (tenant_id, role, module_slug);
      end if;
    end if;
  end if;
end $$;
