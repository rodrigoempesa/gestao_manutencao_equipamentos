-- ============================================================
-- Migration 050 - Permite o papel "visualizador" em profiles.role
-- ------------------------------------------------------------
-- A CHECK original criada em 001_initial.sql limitava a coluna a
-- ('admin_geral', 'admin_local', 'encarregado'). Como agora o sistema
-- também aceita 'visualizador' (somente leitura), atualizamos a
-- constraint.
-- ============================================================

-- Remove qualquer CHECK constraint existente em profiles que referencie a coluna role
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute 'alter table public.profiles drop constraint ' || quote_ident(c);
  end loop;
end $$;

-- Recria a CHECK com o novo papel incluído
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin_geral', 'admin_local', 'encarregado', 'visualizador'));
