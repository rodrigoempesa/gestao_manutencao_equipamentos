-- ============================================================
-- Migration 016 - Remove o código do produto da descrição dos
-- itens de plano importados pela migration 014.
-- Só atualiza itens cuja descrição segue exatamente o padrão
-- "CODE - NAME" gerado na importação (preserva edições manuais).
-- ============================================================

update public.maintenance_plan_items pli
set description = p.name
from public.products p
where pli.product_id = p.id
  and pli.description = p.code || ' - ' || p.name;
