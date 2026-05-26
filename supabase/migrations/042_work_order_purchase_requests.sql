-- ============================================================
-- Migration 042 - Vincular Solicitação de Compra à Ordem de Serviço
-- ------------------------------------------------------------
-- Permite anexar materiais (purchase_requests) a uma OS. Ao finalizar
-- a OS, os produtos das solicitações vinculadas são consumidos do
-- estoque através de maintenance_record_items (gatilho já existente
-- em 003_products_services.sql baixa o current_stock).
--
-- Observação sobre semântica de estoque:
--   • aprovar solicitação (status -> 'aprovado')  => +estoque (compra)
--   • finalizar OS (cria maintenance_record_items) => -estoque (consumo)
-- Por isso a finalização marca as solicitações como 'concluido'
-- (estado terminal), sem passar por 'aprovado', evitando soma indevida.
-- ============================================================

-- 1. plan_id passa a ser opcional.
--    OS corretiva não possui plano; também habilita as solicitações
--    avulsas (sem plano) que a tela de Solicitações já tentava criar.
alter table public.purchase_requests
  alter column plan_id drop not null;

-- 2. Vínculo opcional da solicitação com a OS.
alter table public.purchase_requests
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;

create index if not exists idx_purchase_requests_work_order
  on public.purchase_requests(work_order_id);
