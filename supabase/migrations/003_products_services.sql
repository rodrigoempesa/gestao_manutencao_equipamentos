-- ============================================================
-- Migration 003 - Produtos, Serviços e Manutenção Avançada
-- Execute este SQL no editor SQL do Supabase
-- ============================================================

-- ============================================================
-- PRODUTOS (gestão de estoque)
-- ============================================================
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  unit          text not null default 'un',  -- un, L, kg, m, cx, par...
  current_stock numeric(12,3) not null default 0,
  min_stock     numeric(12,3) not null default 0,
  unit_price    numeric(12,2) not null default 0,
  category      text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- SERVIÇOS (mão de obra e terceiros)
-- ============================================================
create table public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  unit        text not null default 'h',    -- h (hora), un, diária...
  unit_price  numeric(12,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- ============================================================
-- ALTERAÇÕES EM TABELAS EXISTENTES
-- ============================================================

-- Plano de manutenção: vincular produto e quantidade ao item
alter table public.maintenance_plan_items
  add column if not exists product_id uuid references public.products(id),
  add column if not exists quantity   numeric(12,3) not null default 1;

-- Registro de manutenção: tipo, parada/retomada, mão de obra
alter table public.maintenance_records
  add column if not exists type       text not null default 'preventive'
                                      check (type in ('preventive', 'corrective')),
  add column if not exists stopped_at  timestamptz,
  add column if not exists resumed_at  timestamptz,
  add column if not exists labor_cost  numeric(12,2) not null default 0;

-- ============================================================
-- ITENS REAIS USADOS NA MANUTENÇÃO
-- ============================================================
create table public.maintenance_record_items (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references public.maintenance_records(id) on delete cascade,
  product_id    uuid references public.products(id),
  service_id    uuid references public.services(id),
  plan_item_id  uuid references public.maintenance_plan_items(id),
  description   text not null,
  quantity      numeric(12,3) not null default 1,
  unit          text not null default 'un',
  unit_price    numeric(12,2) not null default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at para products
create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.handle_updated_at();

-- Atualiza estoque ao inserir/deletar item de manutenção
create or replace function public.handle_maintenance_item_stock()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' and NEW.product_id is not null then
    update public.products
    set current_stock = current_stock - NEW.quantity
    where id = NEW.product_id;
  end if;
  if TG_OP = 'DELETE' and OLD.product_id is not null then
    update public.products
    set current_stock = current_stock + OLD.quantity
    where id = OLD.product_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create trigger maintenance_record_item_stock
  after insert or delete on public.maintenance_record_items
  for each row execute procedure public.handle_maintenance_item_stock();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.maintenance_record_items enable row level security;

-- products: todos leem, admin escreve
create policy "todos_leem_produtos" on public.products
  for select to authenticated using (true);

create policy "admin_geral_produtos_all" on public.products
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_produtos_write" on public.products
  for insert to authenticated
  with check (public.get_my_role() = 'admin_local');

create policy "admin_local_produtos_update" on public.products
  for update to authenticated
  using (public.get_my_role() = 'admin_local')
  with check (public.get_my_role() = 'admin_local');

-- services: todos leem, admin_geral escreve
create policy "todos_leem_servicos" on public.services
  for select to authenticated using (true);

create policy "admin_geral_servicos_all" on public.services
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

-- maintenance_record_items: mesmas regras do maintenance_records
create policy "admin_geral_record_items_all" on public.maintenance_record_items
  for all to authenticated
  using (public.get_my_role() = 'admin_geral')
  with check (public.get_my_role() = 'admin_geral');

create policy "admin_local_record_items_filial" on public.maintenance_record_items
  for all to authenticated
  using (
    public.get_my_role() = 'admin_local'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = public.get_my_branch_id()
    )
  )
  with check (
    public.get_my_role() = 'admin_local'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = public.get_my_branch_id()
    )
  );

create policy "encarregado_record_items_read" on public.maintenance_record_items
  for select to authenticated
  using (
    public.get_my_role() = 'encarregado'
    and record_id in (
      select mr.id from public.maintenance_records mr
      join public.equipment e on e.id = mr.equipment_id
      where e.branch_id = public.get_my_branch_id()
    )
  );
