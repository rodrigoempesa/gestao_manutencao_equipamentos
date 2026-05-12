-- ============================================================
-- Migration 005 - Solicitações de Compra de Material
-- Execute no editor SQL do Supabase
-- ============================================================

create table if not exists public.purchase_requests (
  id          uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id),
  plan_id      uuid not null references public.maintenance_plans(id),
  status       text not null default 'pendente'
                 check (status in ('pendente', 'aprovado', 'concluido', 'cancelado')),
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.purchase_request_items (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.purchase_requests(id) on delete cascade,
  product_id  uuid references public.products(id),
  plan_item_id uuid references public.maintenance_plan_items(id),
  description text not null,
  quantity    numeric not null default 1,
  unit        text not null default 'un',
  unit_price  numeric not null default 0
);

-- RLS
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;

create policy "pr_select" on public.purchase_requests for select using (
  get_my_role() = 'admin_geral'
  or exists (
    select 1 from public.equipment e
    where e.id = equipment_id and e.branch_id = get_my_branch_id()
  )
);

create policy "pr_insert" on public.purchase_requests for insert with check (
  get_my_role() in ('admin_geral', 'admin_local')
);

create policy "pr_update" on public.purchase_requests for update using (
  get_my_role() in ('admin_geral', 'admin_local')
);

create policy "pri_select" on public.purchase_request_items for select using (
  exists (
    select 1 from public.purchase_requests pr
    join public.equipment e on e.id = pr.equipment_id
    where pr.id = request_id
      and (get_my_role() = 'admin_geral' or e.branch_id = get_my_branch_id())
  )
);

create policy "pri_insert" on public.purchase_request_items for insert with check (
  get_my_role() in ('admin_geral', 'admin_local')
);
