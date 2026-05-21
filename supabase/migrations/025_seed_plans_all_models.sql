-- ============================================================
-- Migration 025 - Seed planos de manutenção para todos os modelos
-- Modelos: 750J, 750J II, 700J, 310K, 310L (John Deere)
--          R220LC-9SB (Hyundai)
--          818H, 766A, 4180D (LiuGong)
--          580N4X4, 1150L (CASE)
-- ============================================================

do $$
declare
  -- Brands
  v_jd   uuid;
  v_hyu  uuid;
  v_liu  uuid;
  v_cas  uuid;

  -- Models
  v_750j   uuid;
  v_750jii uuid;
  v_700j   uuid;
  v_310k   uuid;
  v_310l   uuid;
  v_r220   uuid;
  v_818h   uuid;
  v_766a   uuid;
  v_4180d  uuid;
  v_580n   uuid;
  v_1150l  uuid;

begin
  -- ── Brands ──────────────────────────────────────────────
  select id into v_jd  from public.brands where lower(name) = 'john deere' limit 1;
  select id into v_hyu from public.brands where lower(name) = 'hyundai'    limit 1;
  select id into v_liu from public.brands where lower(name) = 'liugong'    limit 1;
  select id into v_cas from public.brands where lower(name) = 'case'       limit 1;

  if v_jd  is null then insert into public.brands (name) values ('John Deere') returning id into v_jd;  end if;
  if v_hyu is null then insert into public.brands (name) values ('Hyundai')    returning id into v_hyu; end if;
  if v_liu is null then insert into public.brands (name) values ('LiuGong')    returning id into v_liu; end if;
  if v_cas is null then insert into public.brands (name) values ('CASE')       returning id into v_cas; end if;

  -- ── Models ──────────────────────────────────────────────
  -- John Deere 750J
  select id into v_750j from public.equipment_models where brand_id = v_jd and name = '750J' limit 1;
  if v_750j is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_jd, '750J', 'hours') returning id into v_750j;
  end if;

  -- John Deere 750J II
  select id into v_750jii from public.equipment_models where brand_id = v_jd and name = '750J II' limit 1;
  if v_750jii is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_jd, '750J II', 'hours') returning id into v_750jii;
  end if;

  -- John Deere 700J
  select id into v_700j from public.equipment_models where brand_id = v_jd and name = '700J' limit 1;
  if v_700j is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_jd, '700J', 'hours') returning id into v_700j;
  end if;

  -- John Deere 310K
  select id into v_310k from public.equipment_models where brand_id = v_jd and name = '310K' limit 1;
  if v_310k is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_jd, '310K', 'hours') returning id into v_310k;
  end if;

  -- John Deere 310L
  select id into v_310l from public.equipment_models where brand_id = v_jd and name = '310L' limit 1;
  if v_310l is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_jd, '310L', 'hours') returning id into v_310l;
  end if;

  -- Hyundai R220LC-9SB
  select id into v_r220 from public.equipment_models where brand_id = v_hyu and name = 'R220LC-9SB' limit 1;
  if v_r220 is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_hyu, 'R220LC-9SB', 'hours') returning id into v_r220;
  end if;

  -- LiuGong 818H
  select id into v_818h from public.equipment_models where brand_id = v_liu and name = '818H' limit 1;
  if v_818h is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_liu, '818H', 'hours') returning id into v_818h;
  end if;

  -- LiuGong 766A
  select id into v_766a from public.equipment_models where brand_id = v_liu and name = '766A' limit 1;
  if v_766a is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_liu, '766A', 'hours') returning id into v_766a;
  end if;

  -- LiuGong 4180D
  select id into v_4180d from public.equipment_models where brand_id = v_liu and name = '4180D' limit 1;
  if v_4180d is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_liu, '4180D', 'hours') returning id into v_4180d;
  end if;

  -- CASE 580N4X4
  select id into v_580n from public.equipment_models where brand_id = v_cas and name = '580N4X4' limit 1;
  if v_580n is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_cas, '580N4X4', 'hours') returning id into v_580n;
  end if;

  -- CASE 1150L
  select id into v_1150l from public.equipment_models where brand_id = v_cas and name = '1150L' limit 1;
  if v_1150l is null then
    insert into public.equipment_models (brand_id, name, tracking_type) values (v_cas, '1150L', 'hours') returning id into v_1150l;
  end if;

  -- ── Plans ────────────────────────────────────────────────
  -- John Deere 750J (3 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_750j, p.name, p.iv from (values
    ('John Deere - 750J - 500h',  500),
    ('John Deere - 750J - 1000h', 1000),
    ('John Deere - 750J - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_750j and interval_value = p.iv
  );

  -- John Deere 750J II (4 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_750jii, p.name, p.iv from (values
    ('John Deere - 750J II - 500h',  500),
    ('John Deere - 750J II - 1000h', 1000),
    ('John Deere - 750J II - 1500h', 1500),
    ('John Deere - 750J II - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_750jii and interval_value = p.iv
  );

  -- John Deere 700J (8 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_700j, p.name, p.iv from (values
    ('John Deere - 700J - 500h',  500),
    ('John Deere - 700J - 1000h', 1000),
    ('John Deere - 700J - 2000h', 2000),
    ('John Deere - 700J - 3000h', 3000),
    ('John Deere - 700J - 4000h', 4000),
    ('John Deere - 700J - 4500h', 4500),
    ('John Deere - 700J - 5000h', 5000),
    ('John Deere - 700J - 6000h', 6000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_700j and interval_value = p.iv
  );

  -- John Deere 310K (3 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_310k, p.name, p.iv from (values
    ('John Deere - 310K - 500h',  500),
    ('John Deere - 310K - 1000h', 1000),
    ('John Deere - 310K - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_310k and interval_value = p.iv
  );

  -- John Deere 310L (7 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_310l, p.name, p.iv from (values
    ('John Deere - 310L - 500h',  500),
    ('John Deere - 310L - 1000h', 1000),
    ('John Deere - 310L - 2000h', 2000),
    ('John Deere - 310L - 3000h', 3000),
    ('John Deere - 310L - 4000h', 4000),
    ('John Deere - 310L - 5000h', 5000),
    ('John Deere - 310L - 6000h', 6000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_310l and interval_value = p.iv
  );

  -- Hyundai R220LC-9SB (2 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_r220, p.name, p.iv from (values
    ('Hyundai - R220LC-9SB - 500h',  500),
    ('Hyundai - R220LC-9SB - 1000h', 1000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_r220 and interval_value = p.iv
  );

  -- LiuGong 818H (4 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_818h, p.name, p.iv from (values
    ('LiuGong - 818H - 500h',  500),
    ('LiuGong - 818H - 1000h', 1000),
    ('LiuGong - 818H - 1500h', 1500),
    ('LiuGong - 818H - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_818h and interval_value = p.iv
  );

  -- LiuGong 766A (4 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_766a, p.name, p.iv from (values
    ('LiuGong - 766A - 500h',  500),
    ('LiuGong - 766A - 1000h', 1000),
    ('LiuGong - 766A - 1500h', 1500),
    ('LiuGong - 766A - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_766a and interval_value = p.iv
  );

  -- LiuGong 4180D (1 plano)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_4180d, p.name, p.iv from (values
    ('LiuGong - 4180D - 500h', 500)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_4180d and interval_value = p.iv
  );

  -- CASE 580N4X4 (3 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_580n, p.name, p.iv from (values
    ('CASE - 580N4X4 - 500h',  500),
    ('CASE - 580N4X4 - 1000h', 1000),
    ('CASE - 580N4X4 - 2000h', 2000)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_580n and interval_value = p.iv
  );

  -- CASE 1150L (3 planos)
  insert into public.maintenance_plans (model_id, name, interval_value)
  select v_1150l, p.name, p.iv from (values
    ('CASE - 1150L - 500h',  500),
    ('CASE - 1150L - 1000h', 1000),
    ('CASE - 1150L - 1500h', 1500)
  ) as p(name, iv)
  where not exists (
    select 1 from public.maintenance_plans where model_id = v_1150l and interval_value = p.iv
  );

end $$;
