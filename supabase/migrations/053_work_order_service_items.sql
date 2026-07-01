-- ============================================================
-- Migration 053 - Itens de serviço por OS
-- ------------------------------------------------------------
-- Permite anexar linhas de serviço (ex: deslocamento em km, mão de
-- obra em h, etc.) a uma OS específica. Ao finalizar a OS, esses
-- itens viram maintenance_record_items com service_id — do mesmo jeito
-- que os materiais viram itens com product_id.
-- ============================================================

create table if not exists public.work_order_service_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  service_id    uuid references public.services(id),
  description   text not null,
  quantity      numeric(12,3) not null default 1,
  unit          text not null default 'un',
  unit_price    numeric(12,2) not null default 0,
  invoice_path  text,
  notes         text,
  created_at    timestamptz not null default now()
);

comment on table public.work_order_service_items
  is 'Itens de serviço (mão de obra, deslocamento, terceiros) associados a uma OS específica. Consumidos no registro de manutenção ao finalizar.';

create index if not exists idx_wosi_work_order on public.work_order_service_items(work_order_id);
create index if not exists idx_wosi_tenant    on public.work_order_service_items(tenant_id);

drop trigger if exists trg_auto_tenant_id on public.work_order_service_items;
create trigger trg_auto_tenant_id
  before insert on public.work_order_service_items
  for each row execute function public.auto_set_tenant_id();

alter table public.work_order_service_items enable row level security;

drop policy if exists "wosi_tenant_read"  on public.work_order_service_items;
drop policy if exists "wosi_admin_insert" on public.work_order_service_items;
drop policy if exists "wosi_admin_update" on public.work_order_service_items;
drop policy if exists "wosi_admin_delete" on public.work_order_service_items;

create policy "wosi_tenant_read" on public.work_order_service_items
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "wosi_admin_insert" on public.work_order_service_items
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

create policy "wosi_admin_update" on public.work_order_service_items
  for update to authenticated
  using  (tenant_id = get_my_tenant_id() and get_my_role() in ('admin_geral', 'admin_local'))
  with check (tenant_id = get_my_tenant_id() and get_my_role() in ('admin_geral', 'admin_local'));

create policy "wosi_admin_delete" on public.work_order_service_items
  for delete to authenticated
  using (tenant_id = get_my_tenant_id() and get_my_role() in ('admin_geral', 'admin_local'));
