-- ============================================================
-- Migration 019 - Adiciona duração do ciclo ao modelo de equipamento
-- e reescreve vw_equipment_status com lógica correta de ciclo:
--
-- 1. Usa initial_reading como base quando não há manutenção registrada
-- 2. Detecta fim de ciclo (last_plan.interval_value >= cycle_duration)
--    e reinicia para o primeiro plano do ciclo
-- 3. Atraso propaga: threshold = last_reading + (next_interval - last_interval)
--    ou last_reading + next_interval (quando novo ciclo)
-- ============================================================

-- 1. Adiciona coluna cycle_duration ao modelo
alter table public.equipment_models
  add column if not exists cycle_duration integer default null;

comment on column public.equipment_models.cycle_duration
  is 'Duração total do ciclo de manutenção em horas/km. Ex: 6000 para John Deere 750J. Após completar o ciclo, os planos reiniciam do primeiro intervalo.';

-- 2. Recria a view com a nova lógica
drop view if exists public.vw_equipment_status cascade;

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

  -- Base de cálculo: última revisão ou, se ainda não há revisão, horímetro inicial
  coalesce(lm.reading_at_maintenance, e.initial_reading, 0) as base_reading,

  -- Horas/km acumulados desde a última revisão (ou desde o horímetro inicial)
  case
    when r_last.reading_value is not null
    then r_last.reading_value
         - coalesce(lm.reading_at_maintenance, e.initial_reading, 0)
    else null
  end as accumulated_since_maintenance,

  -- Próximo plano dentro do ciclo atual
  np.interval_value  as next_maintenance_interval,
  np.name            as next_maintenance_plan_name,

  -- Limiar real da próxima manutenção
  -- Mesmo ciclo: base + (próximo_intervalo - último_intervalo)
  -- Novo ciclo:  base + primeiro_intervalo
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

  -- Plano subsequente (o que vem depois do próximo, dentro do mesmo ciclo ou novo)
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
  end as upcoming_maintenance_threshold

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

-- Último registro de manutenção (pelo reading mais alto, depois por data)
left join lateral (
  select maintenance_date, reading_at_maintenance, plan_id
  from public.maintenance_records
  where equipment_id = e.id
  order by reading_at_maintenance desc, maintenance_date desc
  limit 1
) lm on true
left join public.maintenance_plans lm_plan on lm_plan.id = lm.plan_id

-- Próximo plano:
--   Se ainda há planos com interval_value maior que o último, usa o próximo no ciclo.
--   Se o ciclo terminou (último plano >= cycle_duration ou não há próximo), retorna o
--   primeiro plano do ciclo com is_same_cycle = false.
left join lateral (
  select
    mp.interval_value,
    mp.name,
    true as is_same_cycle
  from public.maintenance_plans mp
  where mp.model_id = e.model_id
    -- Mesmo ciclo: próximo intervalo maior que o último plano feito
    and mp.interval_value > coalesce(lm_plan.interval_value, 0)
    -- Não é novo ciclo: o último plano não fechou o ciclo
    and (em.cycle_duration is null or coalesce(lm_plan.interval_value, 0) < em.cycle_duration)
  order by mp.interval_value asc
  limit 1

  union all

  -- Novo ciclo: o último plano fechou o ciclo (ou cycle_duration não está definido e não há próximo)
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
) np on true

-- Plano subsequente (o que vem depois do próximo)
left join lateral (
  select mp.interval_value, mp.name
  from public.maintenance_plans mp
  where mp.model_id = e.model_id
    and np.interval_value is not null
    and mp.interval_value > np.interval_value
    and (np.is_same_cycle or true) -- dentro do ciclo seguinte ao np
  order by mp.interval_value asc
  limit 1
) up on true;
