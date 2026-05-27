-- ============================================================
-- Migration 043 - Copia os planos do John Deere 750J para
--                 750J II, 700J II e 700J (planos + itens)
-- ------------------------------------------------------------
-- Execute no SQL Editor do Supabase.
--
-- • Copia todos os planos do modelo de origem (750J) que ainda não
--   existam no destino (casados por interval_value).
-- • Copia os itens de cada plano (descrição, ordem, produto,
--   quantidade e serviço).
-- • Preserva o tenant_id da origem (a coluna é NOT NULL e o gatilho
--   auto_set_tenant_id não funciona no SQL Editor, que não tem
--   sessão autenticada).
-- • Idempotente: pode ser executado mais de uma vez sem duplicar.
-- ============================================================

do $$
declare
  v_jd          uuid;
  v_src         uuid;            -- modelo de origem (750J)
  v_target_name text;
  v_target      uuid;
  target_names  text[] := array['750J II', '700J II', '700J'];
begin
  -- Marca John Deere
  select id into v_jd from public.brands where lower(name) = 'john deere' limit 1;
  if v_jd is null then
    raise exception 'Marca John Deere não encontrada';
  end if;

  -- Modelo de origem 750J
  select id into v_src
  from public.equipment_models
  where brand_id = v_jd and name = '750J'
  limit 1;
  if v_src is null then
    raise exception 'Modelo John Deere 750J não encontrado';
  end if;

  foreach v_target_name in array target_names loop
    -- Modelo de destino — cria se não existir (mesmas características da origem)
    select id into v_target
    from public.equipment_models
    where brand_id = v_jd and name = v_target_name
    limit 1;

    if v_target is null then
      insert into public.equipment_models (brand_id, name, tracking_type, cycle_duration, tenant_id)
      select brand_id, v_target_name, tracking_type, cycle_duration, tenant_id
      from public.equipment_models where id = v_src
      returning id into v_target;
    end if;

    -- Copia os planos (apenas os intervalos ainda não existentes no destino)
    insert into public.maintenance_plans (model_id, name, interval_value, description, tenant_id)
    select
      v_target,
      replace(mp.name, '750J', v_target_name),
      mp.interval_value,
      mp.description,
      mp.tenant_id
    from public.maintenance_plans mp
    where mp.model_id = v_src
      and not exists (
        select 1 from public.maintenance_plans d
        where d.model_id = v_target and d.interval_value = mp.interval_value
      );

    -- Copia os itens dos planos (casando origem x destino por interval_value)
    insert into public.maintenance_plan_items
      (plan_id, description, order_index, product_id, quantity, service_id, tenant_id)
    select
      dest.id,
      si.description,
      si.order_index,
      si.product_id,
      si.quantity,
      si.service_id,
      si.tenant_id
    from public.maintenance_plans src
    join public.maintenance_plans dest
      on dest.model_id = v_target and dest.interval_value = src.interval_value
    join public.maintenance_plan_items si
      on si.plan_id = src.id
    where src.model_id = v_src
      and not exists (
        select 1 from public.maintenance_plan_items di
        where di.plan_id = dest.id and di.order_index = si.order_index
      );

    raise notice 'Planos do 750J copiados para %', v_target_name;
  end loop;
end $$;
