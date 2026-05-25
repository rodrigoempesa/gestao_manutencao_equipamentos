-- Migration 036 - Campos de inativação no equipamento
-- Registra quando o equipamento foi inativado e qual era o horímetro no momento

alter table public.equipment
  add column if not exists inactive_at timestamptz default null,
  add column if not exists inactive_reading numeric(10,1) default null;

comment on column public.equipment.inactive_at is 'Data/hora em que o equipamento foi inativado';
comment on column public.equipment.inactive_reading is 'Horímetro/odômetro no momento da inativação';
