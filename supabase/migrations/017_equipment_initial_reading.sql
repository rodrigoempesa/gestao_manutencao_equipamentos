-- Migration 017 - Adiciona horímetro/odômetro inicial ao equipamento
-- Usado como base de referência para o cálculo das próximas revisões preventivas

alter table public.equipment
  add column if not exists initial_reading numeric default null;

comment on column public.equipment.initial_reading
  is 'Leitura (horas/km) no momento do cadastro do equipamento. Base para cálculo das revisões preventivas.';
