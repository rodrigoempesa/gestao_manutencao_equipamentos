-- ============================================================
-- Migration 009 - Adiciona horas/km acumulados desde última revisão
-- Execute no editor SQL do Supabase
-- ============================================================

-- DROP necessário pois CREATE OR REPLACE não permite inserir coluna no meio da lista
drop view if exists public.vw_equipment_status;

create view public.vw_equipment_status
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

  -- Horas/km acumulados desde a última revisão
  -- Ponto de partida = leitura registrada na última manutenção
  case
    when r_last.reading_value is not null and lm.reading_at_maintenance is not null
    then r_last.reading_value - lm.reading_at_maintenance
    else null
  end as accumulated_since_maintenance,

  -- Próximo plano de manutenção não feito
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

-- Último registro de manutenção (pelo reading mais alto, depois por data)
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
