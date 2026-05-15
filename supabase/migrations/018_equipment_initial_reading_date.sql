-- Migration 018 - Adiciona data do horímetro inicial ao equipamento

alter table public.equipment
  add column if not exists initial_reading_date date default null;

comment on column public.equipment.initial_reading_date
  is 'Data correspondente ao horímetro/odômetro inicial cadastrado no equipamento.';
