-- ============================================================
-- Migration 052 - Histórico de períodos de inatividade do equipamento
-- ------------------------------------------------------------
-- Cada ciclo "desativou → reativou" vira uma linha. Quando o equipamento
-- volta a ficar inativo, abre-se um novo período (reactivated_* nulo).
-- Quando reativado, fecha-se o período preenchendo reactivated_*.
-- ============================================================

create table if not exists public.equipment_inactivity_periods (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id),
  equipment_id        uuid not null references public.equipment(id) on delete cascade,
  inactivated_at      timestamptz not null,
  inactivated_reading numeric,
  inactivated_reason  text check (inactivated_reason in ('manutencao', 'vendido', 'parada')),
  inactivated_by      uuid references auth.users(id),
  reactivated_at      timestamptz,
  reactivated_reading numeric,
  reactivated_by      uuid references auth.users(id),
  notes               text,
  created_at          timestamptz not null default now()
);

comment on table public.equipment_inactivity_periods
  is 'Histórico de períodos em que um equipamento ficou inativo. Um registro por ciclo (desativação → reativação).';

create index if not exists idx_eip_equipment on public.equipment_inactivity_periods(equipment_id);
create index if not exists idx_eip_tenant    on public.equipment_inactivity_periods(tenant_id);
-- Permite encontrar o período aberto de um equipamento rapidamente
create index if not exists idx_eip_open
  on public.equipment_inactivity_periods(equipment_id)
  where reactivated_at is null;

-- Gatilho de tenant automático (função já existe desde a 039)
drop trigger if exists trg_auto_tenant_id on public.equipment_inactivity_periods;
create trigger trg_auto_tenant_id
  before insert on public.equipment_inactivity_periods
  for each row execute function public.auto_set_tenant_id();

-- RLS
alter table public.equipment_inactivity_periods enable row level security;

drop policy if exists "eip_tenant_read"   on public.equipment_inactivity_periods;
drop policy if exists "eip_admin_insert"  on public.equipment_inactivity_periods;
drop policy if exists "eip_admin_update"  on public.equipment_inactivity_periods;

create policy "eip_tenant_read" on public.equipment_inactivity_periods
  for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "eip_admin_insert" on public.equipment_inactivity_periods
  for insert to authenticated
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

create policy "eip_admin_update" on public.equipment_inactivity_periods
  for update to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  )
  with check (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('admin_geral', 'admin_local')
  );

-- Backfill: para cada equipamento atualmente inativo (com inactive_at
-- preenchido), cria um período aberto refletindo o estado atual. Idempotente:
-- só insere se o equipamento ainda não tiver um período aberto.
insert into public.equipment_inactivity_periods (
  tenant_id, equipment_id, inactivated_at, inactivated_reading, inactivated_reason
)
select
  e.tenant_id,
  e.id,
  coalesce(e.inactive_at, e.updated_at, now()),
  e.inactive_reading,
  e.inactive_reason
from public.equipment e
where e.active = false
  and e.inactive_at is not null
  and not exists (
    select 1 from public.equipment_inactivity_periods p
    where p.equipment_id = e.id and p.reactivated_at is null
  );
