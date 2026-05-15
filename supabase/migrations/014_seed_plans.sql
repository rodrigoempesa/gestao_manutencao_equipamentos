-- ============================================================
-- Migration 014 - Planos de manutenção + produtos ausentes
-- Fonte: LISTAGEM KIT DE MATERIAIS X MATERIAIS (Excel)
-- 41 novos produtos | 19 planos | 186 itens
-- Nomenclatura: Marca - Modelo - Intervaloh  (ex: John Deere - 750J - 500h)
-- Execute no editor SQL do Supabase
-- ============================================================

-- ------------------------------------------------------------
-- PARTE 1: 41 produtos novos (unit_price = 0, atualize depois)
-- ------------------------------------------------------------
insert into public.products (code, name, unit, unit_price, current_stock, min_stock, active)
values
  ('74527R61BR', 'ÓLEO DE TRANSMISSÃO / HIDRÁULICO CASE 580N4X4', 'un', 0, 0, 0, true),
  ('76061R61BR', 'ÓLEO DO EIXO TRASEIRO E DIFERENCIAL (80W140)', 'un', 0, 0, 0, true),
  ('76265R61BR', 'ÓLEO DO EIXO DIANTEIRO (80W140)', 'un', 0, 0, 0, true),
  ('84278184', 'CORREIA DO MOTOR CASE 580N4X4', 'un', 0, 0, 0, true),
  ('87393292', 'CORREIRA DO AR CONDICIONADO CASE 580N4X4', 'un', 0, 0, 0, true),
  ('CNH55001', 'ADITIVO ACITIOL', 'L', 0, 0, 0, true),
  ('532333P', 'ÓLEO DO MOTOR 15W40 API CI4 1L LIUGONG', 'L', 0, 0, 0, true),
  ('SP212957', 'FILTRO SEP. AGUA', 'un', 0, 0, 0, true),
  ('537123', 'ÓLEO DA TRANSMISSÃO 10W30 CI4 20L LIUGONG', 'L', 0, 0, 0, true),
  ('868288', 'ÓLEO MOTOR ENGINE AI 15W40 4L', 'L', 0, 0, 0, true),
  ('604452T2', 'FILTRO DO AR CONDICIONADO CASE 1150L', 'un', 0, 0, 0, true),
  ('868035', 'ADITIVO PARA RADIADOR 1L CASE 1150L', 'L', 0, 0, 0, true),
  ('868222', 'ÓLEO AKCELA GEAR 85W140 20L CASE 1150L', 'L', 0, 0, 0, true),
  ('87397414', 'FILTRO DE AR CONDIONADO CASE 1150L', 'un', 0, 0, 0, true),
  ('87451034', 'CORREIA DO AR CONDICIONADO CASE 1150L', 'un', 0, 0, 0, true),
  ('90417529', 'CORREIRIA DO MOTOR CASE 1150L', 'un', 0, 0, 0, true),
  ('868296', 'ÓLEO DO ACIONAMENTO HIDRAULICO CASE 1150L', 'L', 0, 0, 0, true),
  ('11LG-70010', 'FILTRO DECOMBUSTIVEL HYUNDAI', 'un', 0, 0, 0, true),
  ('11N8-70110', 'FILTRO DE ÓLEO DO MOTOR HYUNDAI', 'un', 0, 0, 0, true),
  ('11Q6-28030BR', 'FILTRO DE AR EXTERNO HYUNDAI', 'un', 0, 0, 0, true),
  ('11Q6-90510-P', 'FILTRO DO AR CONDICIONADO EXTERNO HYUNDAI', 'un', 0, 0, 0, true),
  ('11QA-71040BR', 'FILTRO SEPARADO DE ÁGUA HYUNDAI', 'un', 0, 0, 0, true),
  ('11QG-70120BR', 'PREFILTRO MOTOR HYUNDAI', 'un', 0, 0, 0, true),
  ('11N6-91130', 'CORREIA DO AR CONDICIONADO HYUNDAI', 'un', 0, 0, 0, true),
  ('11Q6-28020BR', 'FILTRO DE AR INTERNO HYUNDAI', 'un', 0, 0, 0, true),
  ('31EE-02110-A', 'FILTRO RESPIRO DO TANQUE HYUNDAI', 'un', 0, 0, 0, true),
  ('31K6-01320ED', 'FILTRO DE DRENO HYUNDAI', 'un', 0, 0, 0, true),
  ('31Q6-20340-P', 'FILTRO DA LINHA PILOTO HYUNDAI', 'un', 0, 0, 0, true),
  ('31RF-10030', 'FILTRO DE RETORNO HYUNDAI', 'un', 0, 0, 0, true),
  ('3289930BR', 'CORREIA DO VENTILADOR HYUNDAI', 'un', 0, 0, 0, true),
  ('11E1-70010', 'FILTRO DE COMBUSTÍVEL HYUNDAI', 'un', 0, 0, 0, true),
  ('11E1-70140', 'FILTRO LUBRIFICANTE HYUNDAI', 'un', 0, 0, 0, true),
  ('11E1-70210', 'FILTRO SEPARADOR DE ÁGUA HYUNDAI', 'un', 0, 0, 0, true),
  ('11LB-20310', 'FILTRO SEPARADOR DE ÁGUA HYUNDAI', 'un', 0, 0, 0, true),
  ('11N6-24520-A', 'FILTRO DO AR EXTERNO HYUNDAI', 'un', 0, 0, 0, true),
  ('11N6-24530-A', 'FILTRO DE AR INTERNO HYUNDAI', 'un', 0, 0, 0, true),
  ('11N6-90760', 'FILTRO DO AR CONDICIONADO HYUNDAI', 'un', 0, 0, 0, true),
  ('31E3-0018-A', 'FILTRO PILOTO HYUNDAI', 'un', 0, 0, 0, true),
  ('31E9-0126-A', 'FILTRO DO DRENO HYUNDAI', 'un', 0, 0, 0, true),
  ('E131-0212-A', 'FILTRO DO HIDRÁULICO HYUNDAI', 'un', 0, 0, 0, true),
  ('3929330S', 'CORREIA DO MOTOR HYUNDAI', 'un', 0, 0, 0, true)
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  updated_at = now();

-- ------------------------------------------------------------
-- PARTE 2: 19 planos de manutenção + itens
-- Nomenclatura: Marca - Modelo - Intervaloh
-- Idempotente: ignora planos já existentes (mesmo model+interval+name)
-- ------------------------------------------------------------
do $$
declare
  plan_id uuid;
begin

  -- John Deere - 750J - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = 'a9f85a8c-94c9-4af1-8cc4-9e5c18053273' and interval_value = 500 and name = 'John Deere - 750J - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('a9f85a8c-94c9-4af1-8cc4-9e5c18053273', 500, 'John Deere - 750J - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT300487 - FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT314583 - FILTRO DE AR DO MOTOR INTERNO JOHN DEERE', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT365870 - FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20203 - PLUS 50 II 1LT', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20204 - PLUS 50 II 20LT', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE504836 - FILTRO DE ÓLEO DE MOTOR JOHN DEERE', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE522878 - FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE541922 - ELEMENTO DE FILTRO JOHN DEERE', 7);
  end if;


  -- John Deere - 210G - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '86d5d7b0-9fba-4370-aea8-b357cbcd8e50' and interval_value = 500 and name = 'John Deere - 210G - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('86d5d7b0-9fba-4370-aea8-b357cbcd8e50', 500, 'John Deere - 210G - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT300487 - FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT314583 - FILTRO DE AR DO MOTOR INTERNO JOHN DEERE', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT365870 - FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20203 - PLUS 50 II 1LT', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20204 - PLUS 50 II 20LT', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE522878 - FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE539279 - FILTRO DE ÓLEO DO MOTOR JOHN DEERE', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE541922 - ELEMENTO DE FILTRO JOHN DEERE', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE541925 - ELEMENTO DE FILTRO JOHN DEERE', 8);
  end if;


  -- Case - 580N4X4 - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '11b5aefd-c1c6-4ca9-9687-0eba66d63439' and interval_value = 500 and name = 'Case - 580N4X4 - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('11b5aefd-c1c6-4ca9-9687-0eba66d63439', 500, 'Case - 580N4X4 - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '74512R61BR - ÓLEO DE MOTOR AKCELA N1 CASE', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84217229 - FILTRO DE AR CASE', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84228488 - FILTRO DO ÓLEO DO MOTOR', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84526251 - FILTRO DO COMBUSTIVEL CASE', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682999 - FILTRO DE AR DO MOTOR', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 5);
  end if;


  -- John Deere - 310L - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '62b8886f-a208-4973-b8e9-0ffbac43635f' and interval_value = 500 and name = 'John Deere - 310L - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('62b8886f-a208-4973-b8e9-0ffbac43635f', 500, 'John Deere - 310L - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT332908 - FILTRO DE AR EXTERNO DO MOTOR', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT332909 - FILTRO DE AR INTERNO DO MOTOR', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT491450 - ELEMENTO DE FILTRO', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20204 - PLUS 50 II 20LT', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'R502513 - VEDAÇÃO DO FILTRO LUBRIFICANTE', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE504836 - FILTRO DE ÓLEO DE MOTOR JOHN DEERE', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE62419 - FILTRO DE COMBUSTIVEL', 6);
  end if;


  -- Case - 580N4X4 - 1000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '11b5aefd-c1c6-4ca9-9687-0eba66d63439' and interval_value = 1000 and name = 'Case - 580N4X4 - 1000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('11b5aefd-c1c6-4ca9-9687-0eba66d63439', 1000, 'Case - 580N4X4 - 1000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '360260A2 - FILTRO DO AR CONDICIONADO CASE 580N4X4', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '47833556 - FILTRO HIDRÁULICO CASE 580N4X4', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '504069558 - FILTRO RESPIRO CASE 580N4X4', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '74512R61BR - ÓLEO DE MOTOR AKCELA N1 CASE', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '74527R61BR - ÓLEO DE TRANSMISSÃO / HIDRÁULICO CASE 580N4X4', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '76061R61BR - ÓLEO DO EIXO TRASEIRO E DIFERENCIAL (80W140)', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '76265R61BR - ÓLEO DO EIXO DIANTEIRO (80W140)', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84217229 - FILTRO DE AR CASE', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84228488 - FILTRO DO ÓLEO DO MOTOR', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84278184 - CORREIA DO MOTOR CASE 580N4X4', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84475948 - FILTRO DE TRANSMISSÃO CASE 580N4X4', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84526251 - FILTRO DO COMBUSTIVEL CASE', 11);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87393292 - CORREIRA DO AR CONDICIONADO CASE 580N4X4', 12);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682999 - FILTRO DE AR DO MOTOR', 13);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 14);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CNH55001 - ADITIVO ACITIOL', 15);
  end if;


  -- Case - 580N4X4 - 2000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '11b5aefd-c1c6-4ca9-9687-0eba66d63439' and interval_value = 2000 and name = 'Case - 580N4X4 - 2000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('11b5aefd-c1c6-4ca9-9687-0eba66d63439', 2000, 'Case - 580N4X4 - 2000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '360260A2 - FILTRO DO AR CONDICIONADO CASE 580N4X4', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '47833556 - FILTRO HIDRÁULICO CASE 580N4X4', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '504069558 - FILTRO RESPIRO CASE 580N4X4', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '74512R61BR - ÓLEO DE MOTOR AKCELA N1 CASE', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '74527R61BR - ÓLEO DE TRANSMISSÃO / HIDRÁULICO CASE 580N4X4', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '76061R61BR - ÓLEO DO EIXO TRASEIRO E DIFERENCIAL (80W140)', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '76265R61BR - ÓLEO DO EIXO DIANTEIRO (80W140)', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84217229 - FILTRO DE AR CASE', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84228488 - FILTRO DO ÓLEO DO MOTOR', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84278184 - CORREIA DO MOTOR CASE 580N4X4', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84475948 - FILTRO DE TRANSMISSÃO CASE 580N4X4', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84526251 - FILTRO DO COMBUSTIVEL CASE', 11);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87393292 - CORREIRA DO AR CONDICIONADO CASE 580N4X4', 12);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682999 - FILTRO DE AR DO MOTOR', 13);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 14);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CNH55001 - ADITIVO ACITIOL', 15);
  end if;


  -- Liugong - 766A - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '610a20c3-180c-4a39-8f7d-af5cab2e03b2' and interval_value = 500 and name = 'Liugong - 766A - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('610a20c3-180c-4a39-8f7d-af5cab2e03b2', 500, 'Liugong - 766A - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '37C0655 - FILTRO AR CONDIC. EXTERNO LIUGONG', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '532333P - ÓLEO DO MOTOR 15W40 API CI4 1L LIUGONG', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0324 - FILTRO DO MOTOR LIUGONG', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0325 - FILTRO DE COMBUSTIVEL LIUGONG', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP133755 - FILTRO DE AR LIUGONG', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP212957 - FILTRO SEP. AGUA', 5);
  end if;


  -- Liugong - 766A - 1000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '610a20c3-180c-4a39-8f7d-af5cab2e03b2' and interval_value = 1000 and name = 'Liugong - 766A - 1000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('610a20c3-180c-4a39-8f7d-af5cab2e03b2', 1000, 'Liugong - 766A - 1000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '37C0655 - FILTRO AR CONDIC. EXTERNO LIUGONG', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '52C0121 - FILTRO DA TRANSMISSÃO LIUGONG', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '532333P - ÓLEO DO MOTOR 15W40 API CI4 1L LIUGONG', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '537123 - ÓLEO DA TRANSMISSÃO 10W30 CI4 20L LIUGONG', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0324 - FILTRO DO MOTOR LIUGONG', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0325 - FILTRO DE COMBUSTIVEL LIUGONG', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0703 - FILTRO RETORNO DO HIDRAULICO LIUGONG', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84A0221 - CORREIA DO AR COND LIUGONG', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP130334 - CORREIA DO MOTOR LIUGONG', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP133755 - FILTRO DE AR LIUGONG', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP212957 - FILTRO SEP. AGUA', 10);
  end if;


  -- Liugong - 766A - 1500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '610a20c3-180c-4a39-8f7d-af5cab2e03b2' and interval_value = 1500 and name = 'Liugong - 766A - 1500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('610a20c3-180c-4a39-8f7d-af5cab2e03b2', 1500, 'Liugong - 766A - 1500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '37C0655 - FILTRO AR CONDIC. EXTERNO LIUGONG', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '532333P - ÓLEO DO MOTOR 15W40 API CI4 1L LIUGONG', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0324 - FILTRO DO MOTOR LIUGONG', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0325 - FILTRO DE COMBUSTIVEL LIUGONG', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP133755 - FILTRO DE AR LIUGONG', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP212957 - FILTRO SEP. AGUA', 5);
  end if;


  -- Liugong - 766A - 2000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '610a20c3-180c-4a39-8f7d-af5cab2e03b2' and interval_value = 2000 and name = 'Liugong - 766A - 2000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('610a20c3-180c-4a39-8f7d-af5cab2e03b2', 2000, 'Liugong - 766A - 2000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '37C0655 - FILTRO AR CONDIC. EXTERNO LIUGONG', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '52C0121 - FILTRO DA TRANSMISSÃO LIUGONG', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '532333P - ÓLEO DO MOTOR 15W40 API CI4 1L LIUGONG', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '535123 - ÓLEO HIDRÁULICO 46 20L (140L) LIUGONG', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '537123 - ÓLEO DA TRANSMISSÃO 10W30 CI4 20L LIUGONG', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0324 - FILTRO DO MOTOR LIUGONG', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0325 - FILTRO DE COMBUSTIVEL LIUGONG', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0703 - FILTRO RETORNO DO HIDRAULICO LIUGONG', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C1253 - FILTRO DO TANQUE DE COMBUSTÍVEL LIUGONG', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84A0221 - CORREIA DO AR COND LIUGONG', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP106280 - FILTRO DO SISTEMA HIDRAULICO LIUGONG', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP130334 - CORREIA DO MOTOR LIUGONG', 11);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP133755 - FILTRO DE AR LIUGONG', 12);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP212957 - FILTRO SEP. AGUA', 13);
  end if;


  -- Liugong - 4180D - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '244b7c2d-202e-4f2f-8399-e937072ed564' and interval_value = 500 and name = 'Liugong - 4180D - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('244b7c2d-202e-4f2f-8399-e937072ed564', 500, 'Liugong - 4180D - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '40C2182 - FILTRO DE ÓLEO DO MOTOR LIUGONG 4180D', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '40C5010 - FILTRO DE AR LIUGONG 4180D', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '40C7018 - FILTRO PRIMARIO DE COMBUSTIVEL LIUGONG 4180D', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '532123 - ÓLEO DO MOTOR 15W40 CI4 20L', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '53C0575 - FILTRO SEPARADOR LIUGONG 4180D', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'SP133752 - FILTRO SECUNDARIO DE COMBUSTIVEL LIUGONG 4180D', 5);
  end if;


  -- Case - 1150L - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '27c5507a-40f2-4614-806d-f39cba10b676' and interval_value = 500 and name = 'Case - 1150L - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('27c5507a-40f2-4614-806d-f39cba10b676', 500, 'Case - 1150L - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84228488 - FILTRO DO ÓLEO DO MOTOR', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84412164 - FILTRO DE COMBUSTIVEL SEPARADOR CASE 1150L', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868288 - ÓLEO MOTOR ENGINE AI 15W40 4L', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682990 - FILTRO DE AR PRIMARIO CASE 1150L', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87683000 - FILTRO DE AR SECUNDARIO CASE 1150L', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 5);
  end if;


  -- Case - 1150L - 1000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '27c5507a-40f2-4614-806d-f39cba10b676' and interval_value = 1000 and name = 'Case - 1150L - 1000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('27c5507a-40f2-4614-806d-f39cba10b676', 1000, 'Case - 1150L - 1000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '604452T2 - FILTRO DO AR CONDICIONADO CASE 1150L', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84412164 - FILTRO DE COMBUSTIVEL SEPARADOR CASE 1150L', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868035 - ADITIVO PARA RADIADOR 1L CASE 1150L', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868222 - ÓLEO AKCELA GEAR 85W140 20L CASE 1150L', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868288 - ÓLEO MOTOR ENGINE AI 15W40 4L', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87397414 - FILTRO DE AR CONDIONADO CASE 1150L', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87451034 - CORREIA DO AR CONDICIONADO CASE 1150L', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682990 - FILTRO DE AR PRIMARIO CASE 1150L', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87683000 - FILTRO DE AR SECUNDARIO CASE 1150L', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '90417529 - CORREIRIA DO MOTOR CASE 1150L', 10);
  end if;


  -- Case - 1150L - 2000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '27c5507a-40f2-4614-806d-f39cba10b676' and interval_value = 2000 and name = 'Case - 1150L - 2000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('27c5507a-40f2-4614-806d-f39cba10b676', 2000, 'Case - 1150L - 2000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '604452T2 - FILTRO DO AR CONDICIONADO CASE 1150L', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84228488 - FILTRO DO ÓLEO DO MOTOR', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '84412164 - FILTRO DE COMBUSTIVEL SEPARADOR CASE 1150L', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868035 - ADITIVO PARA RADIADOR 1L CASE 1150L', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868222 - ÓLEO AKCELA GEAR 85W140 20L CASE 1150L', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868288 - ÓLEO MOTOR ENGINE AI 15W40 4L', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '868296 - ÓLEO DO ACIONAMENTO HIDRAULICO CASE 1150L', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87397414 - FILTRO DE AR CONDIONADO CASE 1150L', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87451034 - CORREIA DO AR CONDICIONADO CASE 1150L', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87682990 - FILTRO DE AR PRIMARIO CASE 1150L', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87683000 - FILTRO DE AR SECUNDARIO CASE 1150L', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '87803443 - FILTRO DE COMBUSTIVEL CASE', 11);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '90417529 - CORREIRIA DO MOTOR CASE 1150L', 12);
  end if;


  -- John Deere - 750J II - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '2b0ff719-0d27-4a47-ad5a-244d7c19ed38' and interval_value = 500 and name = 'John Deere - 750J II - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('2b0ff719-0d27-4a47-ad5a-244d7c19ed38', 500, 'John Deere - 750J II - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT300487 - FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT314583 - FILTRO DE AR DO MOTOR INTERNO JOHN DEERE', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT365870 - FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'AT433554 - FILTRO SEPARADOR DE COMBUSTIVEL JOHN DEERE', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20203 - PLUS 50 II 1LT', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'CQM20204 - PLUS 50 II 20LT', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE504836 - FILTRO DE ÓLEO DE MOTOR JOHN DEERE', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE522878 - FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'RE541922 - ELEMENTO DE FILTRO JOHN DEERE', 8);
  end if;


  -- Hyundai - R220LC-9SB - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = 'aa5014e8-23c5-4650-84a1-9cd6c1e7876e' and interval_value = 500 and name = 'Hyundai - R220LC-9SB - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('aa5014e8-23c5-4650-84a1-9cd6c1e7876e', 500, 'Hyundai - R220LC-9SB - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11LG-70010 - FILTRO DECOMBUSTIVEL HYUNDAI', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N8-70110 - FILTRO DE ÓLEO DO MOTOR HYUNDAI', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11Q6-28030BR - FILTRO DE AR EXTERNO HYUNDAI', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11Q6-90510-P - FILTRO DO AR CONDICIONADO EXTERNO HYUNDAI', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11QA-71040BR - FILTRO SEPARADO DE ÁGUA HYUNDAI', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11QG-70120BR - PREFILTRO MOTOR HYUNDAI', 5);
  end if;


  -- Hyundai - R220LC-9SB - 1000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = 'aa5014e8-23c5-4650-84a1-9cd6c1e7876e' and interval_value = 1000 and name = 'Hyundai - R220LC-9SB - 1000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('aa5014e8-23c5-4650-84a1-9cd6c1e7876e', 1000, 'Hyundai - R220LC-9SB - 1000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11LG-70010 - FILTRO DECOMBUSTIVEL HYUNDAI', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-91130 - CORREIA DO AR CONDICIONADO HYUNDAI', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N8-70110 - FILTRO DE ÓLEO DO MOTOR HYUNDAI', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11Q6-28020BR - FILTRO DE AR INTERNO HYUNDAI', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11Q6-28030BR - FILTRO DE AR EXTERNO HYUNDAI', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11Q6-90510-P - FILTRO DO AR CONDICIONADO EXTERNO HYUNDAI', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11QA-71040BR - FILTRO SEPARADO DE ÁGUA HYUNDAI', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11QG-70120BR - PREFILTRO MOTOR HYUNDAI', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31EE-02110-A - FILTRO RESPIRO DO TANQUE HYUNDAI', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31K6-01320ED - FILTRO DE DRENO HYUNDAI', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31Q6-20340-P - FILTRO DA LINHA PILOTO HYUNDAI', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31RF-10030 - FILTRO DE RETORNO HYUNDAI', 11);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '3289930BR - CORREIA DO VENTILADOR HYUNDAI', 12);
  end if;


  -- Hyundai - R210 LC-7 - 500h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '5227e3d1-666c-4387-beae-2cc1e8e0b01e' and interval_value = 500 and name = 'Hyundai - R210 LC-7 - 500h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('5227e3d1-666c-4387-beae-2cc1e8e0b01e', 500, 'Hyundai - R210 LC-7 - 500h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70010 - FILTRO DE COMBUSTÍVEL HYUNDAI', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70140 - FILTRO LUBRIFICANTE HYUNDAI', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70210 - FILTRO SEPARADOR DE ÁGUA HYUNDAI', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11LB-20310 - FILTRO SEPARADOR DE ÁGUA HYUNDAI', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-24520-A - FILTRO DO AR EXTERNO HYUNDAI', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-24530-A - FILTRO DE AR INTERNO HYUNDAI', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-90760 - FILTRO DO AR CONDICIONADO HYUNDAI', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31E3-0018-A - FILTRO PILOTO HYUNDAI', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31E9-0126-A - FILTRO DO DRENO HYUNDAI', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31EE-02110-A - FILTRO RESPIRO DO TANQUE HYUNDAI', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'E131-0212-A - FILTRO DO HIDRÁULICO HYUNDAI', 10);
  end if;


  -- Hyundai - R210 LC-7 - 1000h
  select id into plan_id
  from public.maintenance_plans
  where model_id = '5227e3d1-666c-4387-beae-2cc1e8e0b01e' and interval_value = 1000 and name = 'Hyundai - R210 LC-7 - 1000h';

  if plan_id is null then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values ('5227e3d1-666c-4387-beae-2cc1e8e0b01e', 1000, 'Hyundai - R210 LC-7 - 1000h')
    returning id into plan_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70010 - FILTRO DE COMBUSTÍVEL HYUNDAI', 0);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70140 - FILTRO LUBRIFICANTE HYUNDAI', 1);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11E1-70210 - FILTRO SEPARADOR DE ÁGUA HYUNDAI', 2);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11LB-20310 - FILTRO SEPARADOR DE ÁGUA HYUNDAI', 3);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-24520-A - FILTRO DO AR EXTERNO HYUNDAI', 4);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-24530-A - FILTRO DE AR INTERNO HYUNDAI', 5);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '11N6-90760 - FILTRO DO AR CONDICIONADO HYUNDAI', 6);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31E3-0018-A - FILTRO PILOTO HYUNDAI', 7);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31E9-0126-A - FILTRO DO DRENO HYUNDAI', 8);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '31EE-02110-A - FILTRO RESPIRO DO TANQUE HYUNDAI', 9);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, '3929330S - CORREIA DO MOTOR HYUNDAI', 10);
    insert into public.maintenance_plan_items (plan_id, description, order_index)
    values (plan_id, 'E131-0212-A - FILTRO DO HIDRÁULICO HYUNDAI', 11);
  end if;

end $$;
