-- ============================================================
-- Migration 007 - Anexo de nota fiscal nas solicitações de compra
-- Execute no editor SQL do Supabase
-- ============================================================

-- Coluna para armazenar o path do arquivo no Storage
alter table public.purchase_requests
  add column if not exists invoice_path text;

-- Bucket de armazenamento de notas fiscais
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
on conflict (id) do nothing;

-- Políticas de storage: apenas usuários autenticados
create policy "invoices_insert" on storage.objects
  for insert with check (
    bucket_id = 'invoices' and auth.role() = 'authenticated'
  );

create policy "invoices_select" on storage.objects
  for select using (
    bucket_id = 'invoices' and auth.role() = 'authenticated'
  );

create policy "invoices_update" on storage.objects
  for update using (
    bucket_id = 'invoices' and auth.role() = 'authenticated'
  );

create policy "invoices_delete" on storage.objects
  for delete using (
    bucket_id = 'invoices' and auth.role() = 'authenticated'
  );
