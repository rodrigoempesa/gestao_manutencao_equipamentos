-- ============================================================
-- Migration 011 - Valor final da compra na solicitação
-- Execute no editor SQL do Supabase
-- ============================================================

alter table public.purchase_requests
  add column if not exists final_amount numeric;
