-- ============================================================
-- Migration 026 - Copia planos do John Deere 210G para 210GLC
-- ============================================================

do $$
declare
  v_jd     uuid;
  v_210g   uuid;
  v_210glc uuid;
begin
  -- Brand
  select id into v_jd from public.brands where lower(name) = 'john deere' limit 1;
  if v_jd is null then
    raise exception 'Marca John Deere não encontrada';
  end if;

  -- Modelo 210G (origem)
  select id into v_210g from public.equipment_models where brand_id = v_jd and name = '210G' limit 1;
  if v_210g is null then
    raise exception 'Modelo 210G não encontrado';
  end if;

  -- Modelo 210GLC (destino) — cria se não existir
  select id into v_210glc from public.equipment_models where brand_id = v_jd and name = '210GLC' limit 1;
  if v_210glc is null then
    insert into public.equipment_models (brand_id, name, tracking_type)
    values (v_jd, '210GLC', 'hours')
    returning id into v_210glc;
  end if;

  -- Copia planos do 210G para o 210GLC (somente os que ainda não existem)
  insert into public.maintenance_plans (model_id, name, interval_value, description)
  select
    v_210glc,
    replace(mp.name, '210G', '210GLC'),
    mp.interval_value,
    mp.description
  from public.maintenance_plans mp
  where mp.model_id = v_210g
    and not exists (
      select 1 from public.maintenance_plans
      where model_id = v_210glc and interval_value = mp.interval_value
    );

end $$;
