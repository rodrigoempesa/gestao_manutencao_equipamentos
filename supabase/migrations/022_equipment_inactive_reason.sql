alter table public.equipment
  add column if not exists inactive_reason text default null
    check (inactive_reason in ('manutencao', 'vendido'));

comment on column public.equipment.inactive_reason
  is 'Motivo da inativação: manutencao ou vendido. Nulo quando o equipamento está ativo.';
