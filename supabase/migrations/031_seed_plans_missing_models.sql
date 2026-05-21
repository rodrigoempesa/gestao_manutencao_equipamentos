-- ============================================================
-- Migration 031 - Seed planos 500h/1000h/2000h para todos os
-- modelos que ainda não possuem nenhum plano de manutenção
-- ============================================================

do $$
declare
  r          record;
  v_interval int;
begin
  for r in
    select
      em.id         as model_id,
      em.name       as model_name,
      b.name        as brand_name
    from public.equipment_models em
    join public.brands b on b.id = em.brand_id
    where not exists (
      select 1 from public.maintenance_plans where model_id = em.id
    )
    order by b.name, em.name
  loop
    foreach v_interval in array array[500, 1000, 2000]::int[] loop
      insert into public.maintenance_plans (model_id, name, interval_value)
      select
        r.model_id,
        r.brand_name || ' - ' || r.model_name || ' - ' || v_interval || 'h',
        v_interval
      where not exists (
        select 1 from public.maintenance_plans
        where model_id = r.model_id and interval_value = v_interval
      );
    end loop;
  end loop;
end $$;
