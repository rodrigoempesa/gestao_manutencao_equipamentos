-- ============================================================
-- Migration 035 - Adiciona has_active_os à vw_equipment_status
-- Equipamentos com OS aberta ou iniciada recebem status especial
-- e não aparecem como vencidos no dashboard.
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
  em.cycle_duration,
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

  -- Base de cálculo
  coalesce(lm.reading_at_maintenance, e.initial_reading, 0) as base_reading,

  -- Acumulado desde a última revisão
  case
    when r_last.reading_value is not null
    then r_last.reading_value
         - coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
    else null
  end as accumulated_since_maintenance,

  -- Próximo plano
  np.interval_value  as next_maintenance_interval,
  np.name            as next_maintenance_plan_name,

  -- Limiar da próxima manutenção
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

  -- Plano subsequente
  up.interval_value  as upcoming_maintenance_interval,
  up.name            as upcoming_maintenance_plan_name,

  -- Limiar do plano subsequente
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

  -- OS ativa (aberta ou iniciada) — suspende alertas de vencimento
  exists(
    select 1 from public.work_orders wo
    where wo.equipment_id = e.id
      and wo.status in ('aberta', 'iniciada')
  ) as has_active_os,

  -- Número da OS ativa (para exibição)
  active_os.number as active_os_number,
  active_os.status as active_os_status,
  active_os.id     as active_os_id

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

-- Média diária (últimos 30 dias)
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

-- Próximo plano
left join lateral (
  select * from (
    select
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

-- Plano subsequente
left join lateral (
  select mp.interval_value, mp.name
  from public.maintenance_plans mp
  where mp.model_id = e.model_id
    and np.interval_value is not null
    and mp.interval_value > np.interval_value
  order by mp.interval_value asc
  limit 1
) up on true

-- OS ativa (para exibir número e link)
left join lateral (
  select id, number, status
  from public.work_orders
  where equipment_id = e.id
    and status in ('aberta', 'iniciada')
  order by created_at desc
  limit 1
) active_os on true;
