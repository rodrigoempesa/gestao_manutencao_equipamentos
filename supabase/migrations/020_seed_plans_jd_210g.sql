-- ============================================================
-- Migration 020 - Planos de manutenção John Deere 210G
-- Modelo: John Deere 210G (86d5d7b0-9fba-4370-aea8-b357cbcd8e50)
-- 11 planos: 1000h a 6000h (500h já foi criado manualmente)
-- ============================================================

-- ── Parte 1: Novos produtos ──────────────────────────────────
insert into public.products (code, name, unit, unit_price, active)
values
  ('RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                             'un', 0, true),
  ('RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                                  'un', 0, true),
  ('4S00686R',     'FILTRO AR FRESCO DA CABINE',                                     'un', 0, true),
  ('FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                         'un', 0, true),
  ('FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                                      'un', 0, true),
  ('4630525',      'FILTRO DO ÓLEO PILOTO',                                          'un', 0, true),
  ('M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                                  'un', 0, true),
  ('R524469',      'JUNTA DO BALANCIM DO MOTOR',                                     'un', 0, true),
  ('RE505939',     'AMORTECEDOR DO VIRABREQUIM MOTOR',                               'un', 0, true),
  ('CQM20067',     'DRENAR E REABASTEÇA O ÓLEO DO TANQUE HIDRÁULICO - EX46HN',      'un', 0, true),
  ('4437838',      'SUBSTITUIR O FILTRO DA TAMPA DE RESPIRO DO TANQUE HIDRÁULICO',   'un', 0, true),
  ('CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',            'un', 0, true)
on conflict (code) do nothing;

-- ── Parte 2: Planos e itens ──────────────────────────────────
do $$
declare
  m_id uuid := '86d5d7b0-9fba-4370-aea8-b357cbcd8e50'; -- John Deere 210G
  p_id uuid;
begin

  -- ─── 1000h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 1000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 1000, 'John Deere - 210G - 1000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 1500h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 1500) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 1500, 'John Deere - 210G - 1500h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      (1, 'AT300487', 'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',         1),
      (2, 'AT314583', 'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',         1),
      (3, 'AT365870', 'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 1),
      (4, 'CQM20203', 'PLUS 50 II 1LT',                                   3),
      (5, 'CQM20204', 'PLUS 50 II 20LT',                                 20),
      (6, 'RE522878', 'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',      1),
      (7, 'RE539279', 'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',               1),
      (8, 'RE541922', 'ELEMENTO DE FILTRO JOHN DEERE',                    1),
      (9, 'RE541925', 'ELEMENTO DE FILTRO JOHN DEERE',                    1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 2000h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 2000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 2000, 'John Deere - 210G - 2000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1),
      (18, 'R524469',      'JUNTA DO BALANCIM DO MOTOR',                            1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 2500h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 2500) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 2500, 'John Deere - 210G - 2500h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      (1, 'AT300487', 'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',         1),
      (2, 'AT314583', 'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',         1),
      (3, 'AT365870', 'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 1),
      (4, 'CQM20203', 'PLUS 50 II 1LT',                                   3),
      (5, 'CQM20204', 'PLUS 50 II 20LT',                                 20),
      (6, 'RE522878', 'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',      1),
      (7, 'RE539279', 'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',               1),
      (8, 'RE541922', 'ELEMENTO DE FILTRO JOHN DEERE',                    1),
      (9, 'RE541925', 'ELEMENTO DE FILTRO JOHN DEERE',                    1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 3000h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 3000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 3000, 'John Deere - 210G - 3000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 3500h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 3500) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 3500, 'John Deere - 210G - 3500h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      (1, 'AT300487', 'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',         1),
      (2, 'AT314583', 'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',         1),
      (3, 'AT365870', 'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 1),
      (4, 'CQM20203', 'PLUS 50 II 1LT',                                   3),
      (5, 'CQM20204', 'PLUS 50 II 20LT',                                 20),
      (6, 'RE522878', 'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',      1),
      (7, 'RE539279', 'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',               1),
      (8, 'RE541922', 'ELEMENTO DE FILTRO JOHN DEERE',                    1),
      (9, 'RE541925', 'ELEMENTO DE FILTRO JOHN DEERE',                    1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 4000h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 4000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 4000, 'John Deere - 210G - 4000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1),
      (18, 'R524469',      'JUNTA DO BALANCIM DO MOTOR',                            1),
      (19, 'RE505939',     'AMORTECEDOR DO VIRABREQUIM MOTOR',                      1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 4500h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 4500) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 4500, 'John Deere - 210G - 4500h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      (1, 'AT300487', 'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',         1),
      (2, 'AT314583', 'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',         1),
      (3, 'AT365870', 'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 1),
      (4, 'CQM20203', 'PLUS 50 II 1LT',                                   3),
      (5, 'CQM20204', 'PLUS 50 II 20LT',                                 20),
      (6, 'RE522878', 'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',      1),
      (7, 'RE539279', 'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',               1),
      (8, 'RE541922', 'ELEMENTO DE FILTRO JOHN DEERE',                    1),
      (9, 'RE541925', 'ELEMENTO DE FILTRO JOHN DEERE',                    1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 5000h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 5000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 5000, 'John Deere - 210G - 5000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1),
      (18, 'CQM20067',     'DRENAR E REABASTEÇA O ÓLEO DO TANQUE HIDRÁULICO - EX46HN',    1),
      (19, '4437838',      'SUBSTITUIR O FILTRO DA TAMPA DE RESPIRO DO TANQUE HIDRÁULICO', 1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 5500h ─────────────────────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 5500) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 5500, 'John Deere - 210G - 5500h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      (1, 'AT300487', 'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',         1),
      (2, 'AT314583', 'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',         1),
      (3, 'AT365870', 'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE', 1),
      (4, 'CQM20203', 'PLUS 50 II 1LT',                                   3),
      (5, 'CQM20204', 'PLUS 50 II 20LT',                                 20),
      (6, 'RE522878', 'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',      1),
      (7, 'RE539279', 'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',               1),
      (8, 'RE541922', 'ELEMENTO DE FILTRO JOHN DEERE',                    1),
      (9, 'RE541925', 'ELEMENTO DE FILTRO JOHN DEERE',                    1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

  -- ─── 6000h (igual ao 1000h) ────────────────────────────────
  if not exists (select 1 from public.maintenance_plans where model_id = m_id and interval_value = 6000) then
    insert into public.maintenance_plans (model_id, interval_value, name)
    values (m_id, 6000, 'John Deere - 210G - 6000h') returning id into p_id;

    insert into public.maintenance_plan_items (plan_id, description, order_index, product_id, quantity)
    select p_id, q.descr, q.idx, pr.id, q.qty
    from (values
      ( 1, 'AT300487',     'FILTRO DE AR DO MOTOR EXTERNO JOHN DEERE',              1),
      ( 2, 'AT314583',     'FILTRO DE AR DO MOTOR INTERNO JOHN DEERE',              1),
      ( 3, 'AT365870',     'FILTRO SEPARADOR DE COMBUSTIVEL RACOR JOHN DEERE',      1),
      ( 4, 'CQM20203',     'PLUS 50 II 1LT',                                        3),
      ( 5, 'CQM20204',     'PLUS 50 II 20LT',                                      20),
      ( 6, 'RE522878',     'FILTRO SECUNDARIO DE COMBUSTIVEL JOHN DEERE',           1),
      ( 7, 'RE539279',     'FILTRO DE ÓLEO DO MOTOR JOHN DEERE',                    1),
      ( 8, 'RE541922',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      ( 9, 'RE541925',     'ELEMENTO DE FILTRO JOHN DEERE',                         1),
      (10, 'CQM13598',     'ÓLEO DA CAIXA DE ENGRENAGENS DE GIRO - 85W140 - GL5',   1),
      (11, '4S00686R',     'FILTRO AR FRESCO DA CABINE',                            1),
      (12, 'FYA00001490R', 'FILTRO DE AR DE RECIRCULAÇÃO DA CABINE',                1),
      (13, 'AT300487',     'FILTRO DE AR - PRIMÁRIO',                               1),
      (14, 'AT314583',     'FILTRO DE AR - SECUNDÁRIO',                             1),
      (15, 'FYA00033065',  'FILTRO DE ÓLEO HIDRÁULICO',                             1),
      (16, '4630525',      'FILTRO DO ÓLEO PILOTO',                                 1),
      (17, 'M89679',       'VÁLVULA DE DESCARGA DE POEIRA',                         1)
    ) as q(idx, code, descr, qty)
    join public.products pr on pr.code = q.code;
  end if;

end;
$$;
