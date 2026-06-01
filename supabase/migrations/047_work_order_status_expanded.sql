-- ============================================================
-- Migration 047 - Expande o fluxo de status da OS
-- ------------------------------------------------------------
-- Fluxo antigo:  aberta → iniciada → finalizada (+ cancelada)
-- Fluxo novo:    criada → iniciada (aguardando material)
--                       → material_retirado (aguardando serviço)
--                       → servico_iniciado  (captura horímetro)
--                       → servico_finalizado (captura horímetro,
--                          cria registro de manutenção, baixa estoque)
--                Em qualquer etapa não-terminal pode ir p/ cancelada.
--
-- Captura de horímetro: somente em servico_iniciado e servico_finalizado.
-- ============================================================

-- 1. Remove a CHECK constraint antiga (de qualquer nome) referenciando status
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.work_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute 'alter table public.work_orders drop constraint ' || quote_ident(c);
  end loop;
end $$;

-- 2. Backfill dos status existentes
update public.work_orders set status = case
  when status = 'aberta'      then 'criada'
  when status = 'iniciada'    then 'servico_iniciado'  -- já tinha horímetro capturado
  when status = 'finalizada'  then 'servico_finalizado'
  else status -- cancelada e quaisquer outros permanecem
end
where status in ('aberta', 'iniciada', 'finalizada');

-- 3. Nova CHECK constraint
alter table public.work_orders
  add constraint work_orders_status_check
  check (status in (
    'criada',
    'iniciada',
    'material_retirado',
    'servico_iniciado',
    'servico_finalizado',
    'cancelada'
  ));

-- 4. Default agora é 'criada'
alter table public.work_orders alter column status set default 'criada';

-- 5. Colunas de auditoria das transições intermediárias (sem horímetro)
alter table public.work_orders
  add column if not exists materials_requested_at timestamptz,
  add column if not exists materials_requested_by uuid references auth.users(id),
  add column if not exists materials_picked_at    timestamptz,
  add column if not exists materials_picked_by    uuid references auth.users(id);

-- 6. Atualiza a vw_equipment_status: "OS ativa" agora considera qualquer
--    status não-terminal (tudo menos servico_finalizado e cancelada).
--    Mantém TODAS as colunas existentes na mesma ordem para que
--    `create or replace view` funcione.

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
  em.cycle_duration,
  br.id        as brand_id,
  br.name      as brand_name,

  r_last.reading_value  as current_reading,
  r_last.reading_date   as last_reading_date,

  case
    when r_avg.span_days > 0
    then round((r_avg.max_val - r_avg.min_val)::numeric / r_avg.span_days, 2)
    else null
  end as daily_avg,

  lm.maintenance_date          as last_maintenance_date,
  lm.reading_at_maintenance    as last_maintenance_reading,
  lm_plan.interval_value       as last_maintenance_interval,
  lm_plan.name                 as last_maintenance_plan_name,

  coalesce(lm.reading_at_maintenance, e.initial_reading, 0) as base_reading,

  case
    when r_last.reading_value is not null
    then r_last.reading_value
         - coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
    else null
  end as accumulated_since_maintenance,

  np.interval_value  as next_maintenance_interval,
  np.name            as next_maintenance_plan_name,

  case
    when np.interval_value is not null and np.is_same_cycle
    then coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
         + np.interval_value
         - coalesce(lm_plan.interval_value, 0)
    when np.interval_value is not null and not np.is_same_cycle
    then coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
         + np.interval_value
    else null
  end as next_maintenance_threshold,

  up.interval_value  as upcoming_maintenance_interval,
  up.name            as upcoming_maintenance_plan_name,

  case
    when up.interval_value is not null and np.interval_value is not null and np.is_same_cycle
    then coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
         + np.interval_value - coalesce(lm_plan.interval_value, 0)
         + up.interval_value - np.interval_value
    when up.interval_value is not null and np.interval_value is not null and not np.is_same_cycle
    then coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
         + np.interval_value
         + up.interval_value - np.interval_value
    else null
  end as upcoming_maintenance_threshold,

  -- OS ativa: qualquer status não-terminal
  exists(
    select 1 from public.work_orders wo
    where wo.equipment_id = e.id
      and wo.status in ('criada','iniciada','material_retirado','servico_iniciado')
  ) as has_active_os,

  active_os.number as active_os_number,
  active_os.status as active_os_status,
  active_os.id     as active_os_id,
  np.id            as next_maintenance_plan_id

from public.equipment e
join public.branches b on b.id = e.branch_id
join public.equipment_models em on em.id = e.model_id
join public.brands br on br.id = em.brand_id

left join lateral (
  select reading_value, reading_date
  from public.readings
  where equipment_id = e.id
  order by reading_date desc, created_at desc
  limit 1
) r_last on true

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

left join lateral (
  select maintenance_date, reading_at_maintenance, plan_id
  from public.maintenance_records
  where equipment_id = e.id
  order by reading_at_maintenance desc, maintenance_date desc
  limit 1
) lm on true
left join public.maintenance_plans lm_plan on lm_plan.id = lm.plan_id

left join lateral (
  select * from (
    select
      mp.id,
      mp.interval_value,
      mp.name,
      true as is_same_cycle
    from public.maintenance_plans mp
    where mp.model_id = e.model_id
      and mp.interval_value > coalesce(lm_plan.interval_value, 0)
      and (em.cycle_duration is null or coalesce(lm_plan.interval_value, 0) < em.cycle_duration)
    order by mp.interval_value asc
    limit 1
  ) same_cycle

  union all

  select * from (
    select
      mp.id,
      mp.interval_value,
      mp.name,
      false as is_same_cycle
    from public.maintenance_plans mp
    where mp.model_id = e.model_id
      and em.cycle_duration is not null
      and coalesce(lm_plan.interval_value, 0) >= em.cycle_duration
    order by mp.interval_value asc
    limit 1
  ) new_cycle

  limit 1
) np on true

left join lateral (
  select mp.interval_value, mp.name
  from public.maintenance_plans mp
  where mp.model_id = e.model_id
    and np.interval_value is not null
    and mp.interval_value > np.interval_value
  order by mp.interval_value asc
  limit 1
) up on true

-- OS ativa (qualquer status não-terminal)
left join lateral (
  select id, number, status
  from public.work_orders
  where equipment_id = e.id
    and status in ('criada','iniciada','material_retirado','servico_iniciado')
  order by created_at desc
  limit 1
) active_os on true;
