-- ============================================================
-- Migration 006 - Trigger: aprovação de solicitação atualiza estoque
-- Execute no editor SQL do Supabase
-- ============================================================

create or replace function handle_purchase_request_approval()
returns trigger language plpgsql security definer as $$
begin
  -- Só age na transição para 'aprovado' a partir de um estado não-terminal
  if NEW.status = 'aprovado' and OLD.status not in ('aprovado', 'concluido') then

    -- Incrementa current_stock de cada produto solicitado
    update public.products p
    set current_stock = p.current_stock + pri.quantity
    from public.purchase_request_items pri
    where pri.request_id = NEW.id
      and pri.product_id = p.id
      and pri.product_id is not null;

    -- Avança status direto para concluido (atomicamente, sem segundo UPDATE)
    NEW.status := 'concluido';
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_purchase_request_approved on public.purchase_requests;

create trigger on_purchase_request_approved
  before update of status on public.purchase_requests
  for each row execute function handle_purchase_request_approval();
