-- ============================================================
-- GESTÃO DE MANUTENÇÃO DE EQUIPAMENTOS
-- Migration 001 - Schema inicial
-- Execute este SQL no editor SQL do seu projeto Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Filiais
create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,
  state      char(2) not null,
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- Perfis de usuário (espelha auth.users)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'encarregado'
             check (role in ('admin_geral', 'admin_local', 'encarregado')),
  branch_id  uuid references public.branches(id),
  active     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Marcas
create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- Modelos de equipamento
create table public.equipment_models (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete restrict,
  name          text not null,
  tracking_type text not null check (tracking_type in ('hours', 'km')),
  created_at    timestamptz default now()
);

-- Planos de manutenção (por modelo + intervalo)
create table public.maintenance_plans (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null references public.equipment_models(id) on delete restrict,
  interval_value integer not null,   -- ex: 500, 1000, 1500
  name           text not null,      -- ex: "Revisão 500h"
  description    text,
  created_at     timestamptz default now(),
  unique (model_id, interval_value)
);

-- Itens do plano de manutenção
create table public.maintenance_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.maintenance_plans(id) on delete cascade,
  description text not null,
  order_index integer not null default 0,
  created_at  timestamptz default now()
);

-- Equipamentos
create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  model_id      uuid not null references public.equipment_models(id) on delete restrict,
  branch_id     uuid not null references public.branches(id) on delete restrict,
  year          integer,
  serial_number text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Leituras diárias (horímetro / odômetro)
create table public.readings (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete restrict,
  reading_value numeric(10,1) not null,
  reading_date  date not null default current_date,
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now(),
  unique (equipment_id, reading_date)
);

-- Registros de manutenção
create table public.maintenance_records (
  id                     uuid primary key default gen_random_uuid(),
  equipment_id           uuid not null references public.equipment(id) on delete restrict,
  plan_id                uuid references public.maintenance_plans(id),
  reading_at_maintenance numeric(10,1) not null,
  maintenance_date       date not null,
  performed_by           text,
  notes                  text,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz default now()
);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_branch_id()
returns uuid
language sql
security definer
stable
as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger: criar perfil quando usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, branch_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'encarregado'),
    (new.raw_user_meta_data->>'branch_id')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger equipment_updated_at
  before update on public.equipment
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.equipment_models enable row level security;
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_plan_items enable row level security;
alter table public.equipment enable row level security;
alter table public.readings enable row level security;
alter table public.maintenance_records enable row level security;

-- branches --
create policy "admin_geral_branches_all" on public.branches
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "outros_branches_propria" on public.branches
  for select to authenticated
  using (
    public.get_my_role() in ('admin_local', 'encarregado')
    and id = public.get_my_branch_id()
  );

-- profiles --
create policy "admin_geral_profiles_all" on public.profiles
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_profiles_filial" on public.profiles
  for select to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and (branch_id = public.get_my_branch_id() or id = auth.uid())
  );

create policy "admin_local_profiles_write_filial" on public.profiles
  for update to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and branch_id = public.get_my_branch_id()
    and role = 'encarregado'
  )
  with check (
    public.get_my_role() = 'admin_local'
    and branch_id = public.get_my_branch_id()
    and role = 'encarregado'
  );

create policy "encarregado_proprio_perfil" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- brands --
create policy "todos_leem_marcas" on public.brands
  for select to authenticated using (true);

create policy "admin_geral_marcas_all" on public.brands
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

-- equipment_models --
create policy "todos_leem_modelos" on public.equipment_models
  for select to authenticated using (true);

create policy "admin_geral_modelos_all" on public.equipment_models
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

-- maintenance_plans --
create policy "todos_leem_planos" on public.maintenance_plans
  for select to authenticated using (true);

create policy "admin_geral_planos_all" on public.maintenance_plans
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

-- maintenance_plan_items --
create policy "todos_leem_itens_plano" on public.maintenance_plan_items
  for select to authenticated using (true);

create policy "admin_geral_itens_plano_all" on public.maintenance_plan_items
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

-- equipment --
create policy "admin_geral_equipment_all" on public.equipment
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_equipment_filial" on public.equipment
  for all to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and branch_id = public.get_my_branch_id()
  )
  with check (
    public.get_my_role() = 'admin_local'
    and branch_id = public.get_my_branch_id()
  );

create policy "encarregado_equipment_filial_leitura" on public.equipment
  for select to authenticated
  using (
    public.get_my_role() = 'encarregado'
    and branch_id = public.get_my_branch_id()
  );

-- readings --
create policy "admin_geral_readings_all" on public.readings
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_readings_filial" on public.readings
  for all to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  )
  with check (
    public.get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  );

create policy "encarregado_readings_filial" on public.readings
  for all to authenticated
  using (
    public.get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  )
  with check (
    public.get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  );

-- maintenance_records --
create policy "admin_geral_maintenance_all" on public.maintenance_records
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_maintenance_filial" on public.maintenance_records
  for all to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  )
  with check (
    public.get_my_role() = 'admin_local'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  );

create policy "encarregado_maintenance_filial_leitura" on public.maintenance_records
  for select to authenticated
  using (
    public.get_my_role() = 'encarregado'
    and equipment_id in (
      select id from public.equipment where branch_id = public.get_my_branch_id()
    )
  );

-- ============================================================
-- VIEW: status dos equipamentos (usada pelo dashboard)
-- ============================================================

create or replace view public.vw_equipment_status
with (security_invoker = true)
as
select
  e.id,
  e.code,
  e.name,
  e.active,
  e.branch_id,
  b.name       as branch_name,
  b.city       as branch_city,
  b.state      as branch_state,
  e.model_id,
  em.name      as model_name,
  em.tracking_type,
  br.id        as brand_id,
  br.name      as brand_name,

  -- Última leitura
  r_last.reading_value  as current_reading,
  r_last.reading_date   as last_reading_date,

  -- Média diária (últimos 30 dias)
  case
    when r_avg.span_days > 0
    then round((r_avg.max_val - r_avg.min_val)::numeric / r_avg.span_days, 2)
    else null
  end as daily_avg,

  -- Último registro de manutenção
  lm.maintenance_date          as last_maintenance_date,
  lm.reading_at_maintenance    as last_maintenance_reading,
  lm_plan.interval_value       as last_maintenance_interval,
  lm_plan.name                 as last_maintenance_plan_name,

  -- Próximo plano de manutenção
  np.interval_value  as next_maintenance_interval,
  np.name            as next_maintenance_plan_name

from public.equipment e
join public.branches b on b.id = e.branch_id
join public.equipment_models em on em.id = e.model_id
join public.brands br on br.id = em.brand_id

-- Última leitura
left join lateral (
  select reading_value, reading_date
  from public.readings
  where equipment_id = e.id
  order by reading_date desc, created_at desc
  limit 1
) r_last on true

-- Dados para média (últimos 30 dias)
left join lateral (
  select
    max(reading_value) as max_val,
    min(reading_value) as min_val,
    greatest(
      extract(epoch from (max(reading_date::timestamptz) - min(reading_date::timestamptz))) / 86400,
      1
    ) as span_days
  from public.readings
  where equipment_id = e.id
    and reading_date >= current_date - interval '30 days'
  having count(*) >= 2
) r_avg on true

-- Último registro de manutenção
left join lateral (
  select maintenance_date, reading_at_maintenance, plan_id
  from public.maintenance_records
  where equipment_id = e.id
  order by reading_at_maintenance desc, maintenance_date desc
  limit 1
) lm on true
left join public.maintenance_plans lm_plan on lm_plan.id = lm.plan_id

-- Próximo intervalo de manutenção não feito
left join lateral (
  select interval_value, name
  from public.maintenance_plans
  where model_id = e.model_id
    and interval_value > coalesce(lm.reading_at_maintenance, 0)
  order by interval_value asc
  limit 1
) np on true;
