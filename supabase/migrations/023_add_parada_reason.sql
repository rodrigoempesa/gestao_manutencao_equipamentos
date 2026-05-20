-- Adiciona 'parada' como valor válido para inactive_reason
alter table public.equipment
  drop constraint if exists equipment_inactive_reason_check;

alter table public.equipment
  add constraint equipment_inactive_reason_check
    check (inactive_reason in ('manutencao', 'vendido', 'parada'));

comment on column public.equipment.inactive_reason
  is 'Motivo da inativação: manutencao, vendido ou parada. Nulo quando o equipamento está ativo.';
