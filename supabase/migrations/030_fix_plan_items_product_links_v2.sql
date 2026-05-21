-- ============================================================
-- Migration 030 - Corrige vínculos de produto/serviço nos itens
-- do 210GLC e 700J II (v2 — usa CTE para evitar limitação do
-- UPDATE...FROM com alias no PostgreSQL)
-- ============================================================

do $$
declare
  v_jd     uuid;
  v_210g   uuid;
  v_210glc uuid;
  v_700j   uuid;
  v_700jii uuid;
begin
  select id into v_jd from public.brands where lower(name) = 'john deere' limit 1;

  select id into v_210g   from public.equipment_models where brand_id = v_jd and name = '210G'    limit 1;
  select id into v_210glc from public.equipment_models where brand_id = v_jd and name = '210GLC'  limit 1;
  select id into v_700j   from public.equipment_models where brand_id = v_jd and name = '700J'    limit 1;
  select id into v_700jii from public.equipment_models where brand_id = v_jd and name = '700J II' limit 1;

  -- ── 210G → 210GLC ───────────────────────────────────────
  -- CTE mapeia dest_item.id → campos do src_item antes do UPDATE
  if v_210g is not null and v_210glc is not null then
    with mapping as (
      select
        di.id          as dest_id,
        si.product_id,
        si.quantity,
        si.service_id
      from public.maintenance_plan_items di
      join public.maintenance_plans dp  on dp.id = di.plan_id and dp.model_id = v_210glc
      join public.maintenance_plans sp  on sp.model_id = v_210g and sp.interval_value = dp.interval_value
      join public.maintenance_plan_items si on si.plan_id = sp.id and si.order_index = di.order_index
    )
    update public.maintenance_plan_items t
    set
      product_id = mapping.product_id,
      quantity   = mapping.quantity,
      service_id = mapping.service_id
    from mapping
    where t.id = mapping.dest_id;
  end if;

  -- ── 700J → 700J II ──────────────────────────────────────
  if v_700j is not null and v_700jii is not null then
    with mapping as (
      select
        di.id          as dest_id,
        si.product_id,
        si.quantity,
        si.service_id
      from public.maintenance_plan_items di
      join public.maintenance_plans dp  on dp.id = di.plan_id and dp.model_id = v_700jii
      join public.maintenance_plans sp  on sp.model_id = v_700j and sp.interval_value = dp.interval_value
      join public.maintenance_plan_items si on si.plan_id = sp.id and si.order_index = di.order_index
    )
    update public.maintenance_plan_items t
    set
      product_id = mapping.product_id,
      quantity   = mapping.quantity,
      service_id = mapping.service_id
    from mapping
    where t.id = mapping.dest_id;
  end if;

end $$;
