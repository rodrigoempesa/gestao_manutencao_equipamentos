-- ============================================================
-- Migration 032 - Correção de dados do RC-02
-- O horímetro inicial foi preenchido errado (510h no lugar de 0).
-- Corrige para initial_reading = 0 em 01/01/2024 e registra
-- a revisão de 500h que ocorreu em 10/09/2024 com leitura 510h.
-- ============================================================

do $$
declare
  v_equip_id uuid;
  v_plan_id  uuid;
begin
  -- Busca o equipamento RC-02
  select id into v_equip_id
  from public.equipment
  where code = 'RC-02'
  limit 1;

  if v_equip_id is null then
    raise exception 'Equipamento RC-02 não encontrado';
  end if;

  -- Corrige horímetro inicial
  update public.equipment
  set
    initial_reading      = 0,
    initial_reading_date = '2024-01-01'
  where id = v_equip_id;

  -- Busca o plano de 500h do modelo do RC-02
  select mp.id into v_plan_id
  from public.maintenance_plans mp
  join public.equipment e on e.model_id = mp.model_id
  where e.id = v_equip_id
    and mp.interval_value = 500
  order by mp.created_at asc
  limit 1;

  if v_plan_id is null then
    raise exception 'Plano de 500h não encontrado para o modelo do RC-02';
  end if;

  -- Registra a manutenção de 500h (se ainda não existir)
  insert into public.maintenance_records
    (equipment_id, plan_id, reading_at_maintenance, maintenance_date, notes)
  select
    v_equip_id,
    v_plan_id,
    510,
    '2024-09-10',
    'Registro corretivo — revisão de 500h realizada em 10/09/2024 (horímetro inicial estava preenchido incorretamente)'
  where not exists (
    select 1 from public.maintenance_records
    where equipment_id = v_equip_id
      and plan_id = v_plan_id
      and reading_at_maintenance = 510
  );

end $$;
