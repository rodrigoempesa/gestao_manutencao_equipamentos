create table if not exists public.equipment_branch_transfers (
  id               uuid primary key default gen_random_uuid(),
  equipment_id     uuid not null references public.equipment(id) on delete cascade,
  from_branch_id   uuid not null references public.branches(id),
  to_branch_id     uuid not null references public.branches(id),
  transfer_date    date not null,
  reading_at_transfer numeric not null,
  notes            text default null,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);

comment on table public.equipment_branch_transfers
  is 'Histórico de transferências de equipamentos entre filiais.';

alter table public.equipment_branch_transfers enable row level security;

create policy "Autenticados podem ver transferências"
  on public.equipment_branch_transfers for select
  to authenticated using (true);

create policy "Admins podem inserir transferências"
  on public.equipment_branch_transfers for insert
  to authenticated with check (true);
