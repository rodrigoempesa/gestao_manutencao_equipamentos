-- ============================================================
-- Migration 033 - Ordens de Serviço (OS)
-- Fluxo: Aberta → Iniciada → Finalizada (cria maintenance_record)
-- Numeração: OS-YYYY-NNNN, gerada automaticamente por trigger
-- ============================================================

-- Função para gerar número sequencial por ano
create or replace function public.set_work_order_number()
returns trigger language plpgsql security definer as $$
declare
  v_year text;
  v_next int;
begin
  if new.number is not null and new.number <> '' then
    return new;
  end if;

  v_year := to_char(now(), 'YYYY');

  -- Lock transacional para evitar duplicatas concorrentes
  perform pg_advisory_xact_lock(hashtext('wo_seq_' || v_year));

  select coalesce(max((regexp_match(number, '[0-9]+$'))[1]::int), 0) + 1
  into v_next
  from public.work_orders
  where number like 'OS-' || v_year || '-%';

  new.number := 'OS-' || v_year || '-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

-- Tabela principal
create table if not exists public.work_orders (
  id                    uuid primary key default gen_random_uuid(),
  number                text not null unique default '',

  type                  text not null default 'preventive'
                          check (type in ('preventive', 'corrective')),
  status                text not null default 'aberta'
                          check (status in ('aberta', 'iniciada', 'finalizada', 'cancelada')),

  equipment_id          uuid not null references public.equipment(id) on delete restrict,
  plan_id               uuid references public.maintenance_plans(id),
  description           text,   -- descrição para OS corretiva
  notes                 text,

  -- Abertura
  opened_at             timestamptz not null default now(),
  opened_by             uuid references auth.users(id),

  -- Início
  started_at            timestamptz,
  started_reading       numeric,
  started_by            uuid references auth.users(id),

  -- Finalização
  finished_at           timestamptz,
  finished_reading      numeric,
  finished_by           uuid references auth.users(id),

  -- Registro de manutenção criado na finalização
  maintenance_record_id uuid references public.maintenance_records(id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Trigger de numeração automática
create trigger trg_work_order_number
  before insert on public.work_orders
  for each row
  execute function public.set_work_order_number();

-- RLS
alter table public.work_orders enable row level security;

create policy "Autenticados podem ver OS"
  on public.work_orders for select
  to authenticated using (true);

create policy "Autenticados podem criar OS"
  on public.work_orders for insert
  to authenticated with check (true);

create policy "Autenticados podem atualizar OS"
  on public.work_orders for update
  to authenticated using (true);

comment on table public.work_orders
  is 'Ordens de Serviço de manutenção. Fluxo: aberta → iniciada → finalizada.';
