-- ============================================================
-- Migration 028 - Copia itens de planos para 210GLC e 700J II
-- Corrige a ausência de maintenance_plan_items nas migrações
-- 026 (210G → 210GLC) e 027 (700J → 700J II)
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

  select id into v_210g   from public.equipment_models where brand_id = v_jd and name = '210G'   limit 1;
  select id into v_210glc from public.equipment_models where brand_id = v_jd and name = '210GLC' limit 1;
  select id into v_700j   from public.equipment_models where brand_id = v_jd and name = '700J'   limit 1;
  select id into v_700jii from public.equipment_models where brand_id = v_jd and name = '700J II' limit 1;

  -- ── 210G → 210GLC ───────────────────────────────────────
  if v_210g is not null and v_210glc is not null then
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    select
      dest.id,
      src_item.description,
      src_item.order_index
    from public.maintenance_plans src
    join public.maintenance_plans dest
      on dest.model_id = v_210glc and dest.interval_value = src.interval_value
    join public.maintenance_plan_items src_item
      on src_item.plan_id = src.id
    where src.model_id = v_210g
      and not exists (
        select 1 from public.maintenance_plan_items
        where plan_id = dest.id and order_index = src_item.order_index
      );
  end if;

  -- ── 700J → 700J II ──────────────────────────────────────
  if v_700j is not null and v_700jii is not null then
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    select
      dest.id,
      src_item.description,
      src_item.order_index
    from public.maintenance_plans src
    join public.maintenance_plans dest
      on dest.model_id = v_700jii and dest.interval_value = src.interval_value
    join public.maintenance_plan_items src_item
      on src_item.plan_id = src.id
    where src.model_id = v_700j
      and not exists (
        select 1 from public.maintenance_plan_items
        where plan_id = dest.id and order_index = src_item.order_index
      );
  end if;

end $$;
