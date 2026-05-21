-- ============================================================
-- Migration 027 - Copia planos do John Deere 700J para 700J II
-- ============================================================

do $$
declare
  v_jd    uuid;
  v_700j  uuid;
  v_700jii uuid;
begin
  -- Brand
  select id into v_jd from public.brands where lower(name) = 'john deere' limit 1;
  if v_jd is null then
    raise exception 'Marca John Deere não encontrada';
  end if;

  -- Modelo 700J (origem)
  select id into v_700j from public.equipment_models where brand_id = v_jd and name = '700J' limit 1;
  if v_700j is null then
    raise exception 'Modelo 700J não encontrado';
  end if;

  -- Modelo 700J II (destino) — cria se não existir
  select id into v_700jii from public.equipment_models where brand_id = v_jd and name = '700J II' limit 1;
  if v_700jii is null then
    insert into public.equipment_models (brand_id, name, tracking_type)
    values (v_jd, '700J II', 'hours')
    returning id into v_700jii;
  end if;

  -- Copia planos do 700J para o 700J II (somente os que ainda não existem)
  insert into public.maintenance_plans (model_id, name, interval_value, description)
  select
    v_700jii,
    replace(mp.name, '700J', '700J II'),
    mp.interval_value,
    mp.description
  from public.maintenance_plans mp
  where mp.model_id = v_700j
    and not exists (
      select 1 from public.maintenance_plans
      where model_id = v_700jii and interval_value = mp.interval_value
    );

end $$;
