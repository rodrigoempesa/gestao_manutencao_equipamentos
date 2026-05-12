-- ============================================================
-- SEED DE DADOS DE EXEMPLO
-- Execute APÓS a migração 001_initial.sql
-- Dados fictícios para demonstração
-- ============================================================

-- Filiais
insert into public.branches (id, name, city, state) values
  ('a1000000-0000-0000-0000-000000000001', 'Matriz', 'Cuiabá', 'MT'),
  ('a1000000-0000-0000-0000-000000000002', 'Filial Goiás', 'Goiânia', 'GO'),
  ('a1000000-0000-0000-0000-000000000003', 'Filial Pará', 'Belém', 'PA');

-- Marcas
insert into public.brands (id, name) values
  ('b1000000-0000-0000-0000-000000000001', 'John Deere'),
  ('b1000000-0000-0000-0000-000000000002', 'Caterpillar'),
  ('b1000000-0000-0000-0000-000000000003', 'Volkswagen'),
  ('b1000000-0000-0000-0000-000000000004', 'Mercedes-Benz');

-- Modelos de equipamento
insert into public.equipment_models (id, brand_id, name, tracking_type) values
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '750J', 'hours'),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', '620E', 'hours'),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'D6T', 'hours'),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', '336', 'hours'),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003', 'Constellation 17.260', 'km'),
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000004', 'Actros 2646', 'km');

-- Planos de manutenção – John Deere 750J (trator de esteira)
insert into public.maintenance_plans (id, model_id, interval_value, name, description) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 500,  'Revisão 500h',  'Manutenção preventiva a cada 500 horas'),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 1000, 'Revisão 1000h', 'Manutenção preventiva a cada 1000 horas'),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 1500, 'Revisão 1500h', 'Manutenção preventiva a cada 1500 horas'),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 2000, 'Revisão 2000h', 'Manutenção preventiva a cada 2000 horas');

-- Itens – Revisão 500h John Deere 750J
insert into public.maintenance_plan_items (plan_id, description, order_index) values
  ('d1000000-0000-0000-0000-000000000001', 'Troca de óleo do motor (15W40)', 1),
  ('d1000000-0000-0000-0000-000000000001', 'Troca dos filtros de óleo', 2),
  ('d1000000-0000-0000-0000-000000000001', 'Troca do filtro de combustível primário e secundário', 3),
  ('d1000000-0000-0000-0000-000000000001', 'Verificar tensão e desgaste das lagartas', 4),
  ('d1000000-0000-0000-0000-000000000001', 'Lubrificar pontos de graxo conforme manual', 5),
  ('d1000000-0000-0000-0000-000000000001', 'Verificar nível do fluido de arrefecimento', 6),
  ('d1000000-0000-0000-0000-000000000001', 'Inspecionar filtro de ar (limpar ou substituir se necessário)', 7);

-- Itens – Revisão 1000h John Deere 750J
insert into public.maintenance_plan_items (plan_id, description, order_index) values
  ('d1000000-0000-0000-0000-000000000002', 'Todos os itens da revisão de 500h', 1),
  ('d1000000-0000-0000-0000-000000000002', 'Troca do óleo do diferencial final', 2),
  ('d1000000-0000-0000-0000-000000000002', 'Troca do óleo do sistema hidráulico', 3),
  ('d1000000-0000-0000-0000-000000000002', 'Troca dos filtros hidráulicos', 4),
  ('d1000000-0000-0000-0000-000000000002', 'Inspecionar e regular folga das válvulas', 5),
  ('d1000000-0000-0000-0000-000000000002', 'Inspecionar correia do alternador', 6);

-- Planos – Caterpillar 336 (escavadeira)
insert into public.maintenance_plans (id, model_id, interval_value, name) values
  ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 250,  'Revisão 250h'),
  ('d2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004', 500,  'Revisão 500h'),
  ('d2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004', 1000, 'Revisão 1000h'),
  ('d2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 2000, 'Revisão 2000h');

-- Planos – VW Constellation (caminhão)
insert into public.maintenance_plans (id, model_id, interval_value, name) values
  ('d3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 10000, 'Revisão 10.000 km'),
  ('d3000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005', 30000, 'Revisão 30.000 km'),
  ('d3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005', 60000, 'Revisão 60.000 km'),
  ('d3000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005', 120000,'Revisão 120.000 km');

-- Equipamentos
insert into public.equipment (id, code, name, model_id, branch_id, year) values
  -- Matriz (Cuiabá)
  ('e1000000-0000-0000-0000-000000000001', 'JD750J-001', 'Trator de Esteira 1',   'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2019),
  ('e1000000-0000-0000-0000-000000000002', 'JD750J-002', 'Trator de Esteira 2',   'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2020),
  ('e1000000-0000-0000-0000-000000000003', 'CAT336-001', 'Escavadeira Hidráulica', 'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 2021),
  ('e1000000-0000-0000-0000-000000000004', 'VW-001',     'Caminhão Basculante 1',  'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 2018),
  -- Filial Goiás
  ('e1000000-0000-0000-0000-000000000005', 'JD620E-001', 'Motoniveladora',         'c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 2022),
  ('e1000000-0000-0000-0000-000000000006', 'CAT-D6T-001','Trator de Esteira Cat',  'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 2020),
  ('e1000000-0000-0000-0000-000000000007', 'MB-001',     'Caminhão Actros',        'c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 2021),
  -- Filial Pará
  ('e1000000-0000-0000-0000-000000000008', 'JD750J-003', 'Trator de Esteira 3',   'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 2018),
  ('e1000000-0000-0000-0000-000000000009', 'CAT336-002', 'Escavadeira 2',          'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 2019),
  ('e1000000-0000-0000-0000-000000000010', 'VW-002',     'Caminhão Basculante 2',  'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 2020);
