-- ============================================================
-- Migration 004 - Serviço vinculado ao item do plano de manutenção
-- Execute no editor SQL do Supabase
-- ============================================================

-- Adiciona service_id ao item do plano (produto + quantidade + serviço juntos)
alter table public.maintenance_plan_items
  add column if not exists service_id uuid references public.services(id);
