-- ============================================================
-- Migration 029 - Corrige vínculos de produto/serviço nos itens
-- copiados para 210GLC e 700J II (migrações 026, 027 e 028
-- não copiaram product_id, quantity e service_id)
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
  -- UPDATE ... FROM não permite referenciar a tabela alvo em JOINs;
  -- usamos vírgulas no FROM e todas as condições no WHERE.
  if v_210g is not null and v_210glc is not null then
    update public.maintenance_plan_items dest_item
    set
      product_id = src_item.product_id,
      quantity   = src_item.quantity,
      service_id = src_item.service_id
    from
      public.maintenance_plans  dest_plan,
      public.maintenance_plans  src_plan,
      public.maintenance_plan_items src_item
    where
      dest_item.plan_id        = dest_plan.id
      and dest_plan.model_id   = v_210glc
      and src_plan.model_id    = v_210g
      and src_plan.interval_value = dest_plan.interval_value
      and src_item.plan_id     = src_plan.id
      and src_item.order_index = dest_item.order_index;
  end if;

  -- ── 700J → 700J II ──────────────────────────────────────
  if v_700j is not null and v_700jii is not null then
    update public.maintenance_plan_items dest_item
    set
      product_id = src_item.product_id,
      quantity   = src_item.quantity,
      service_id = src_item.service_id
    from
      public.maintenance_plans  dest_plan,
      public.maintenance_plans  src_plan,
      public.maintenance_plan_items src_item
    where
      dest_item.plan_id        = dest_plan.id
      and dest_plan.model_id   = v_700jii
      and src_plan.model_id    = v_700j
      and src_plan.interval_value = dest_plan.interval_value
      and src_item.plan_id     = src_plan.id
      and src_item.order_index = dest_item.order_index;
  end if;

end $$;
