-- Migration 040 - Flag de superadmin e bloqueio de tenant inativo

-- Flag superadmin na tabela de perfis
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Após criar sua conta em /signup, rode este comando para se tornar superadmin:
-- UPDATE public.profiles SET is_superadmin = true WHERE email = 'admin@integertecnologia.com.br';

-- Comentário: a coluna active já existe em public.tenants (migration 037).
-- O bloqueio de tenant inativo é tratado no layout do dashboard (código Next.js).
