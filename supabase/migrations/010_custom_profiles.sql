-- ============================================================
-- Migration 010 - Perfis de acesso personalizados
-- Execute no editor SQL do Supabase
-- ============================================================

-- Tabela de perfis de acesso customizados
create table if not exists public.access_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);

-- Módulos habilitados por perfil
create table if not exists public.access_profile_modules (
  profile_id  uuid    not null references public.access_profiles(id) on delete cascade,
  module_slug text    not null references public.modules(slug) on delete cascade,
  enabled     boolean not null default false,
  primary key (profile_id, module_slug)
);

-- Referência ao perfil customizado no usuário (opcional; sobrescreve role_module_permissions)
alter table public.profiles
  add column if not exists access_profile_id uuid references public.access_profiles(id) on delete set null;

-- RLS
alter table public.access_profiles enable row level security;
alter table public.access_profile_modules enable row level security;

-- Somente admin_geral pode gerenciar
create policy "access_profiles: admin_geral full" on public.access_profiles
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin_geral'
    )
  );

create policy "access_profile_modules: admin_geral full" on public.access_profile_modules
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin_geral'
    )
  );

-- Leitura para todos os autenticados (necessário para o layout buscar módulos do próprio perfil)
create policy "access_profiles: authenticated read" on public.access_profiles
  for select using (auth.role() = 'authenticated');

create policy "access_profile_modules: authenticated read" on public.access_profile_modules
  for select using (auth.role() = 'authenticated');
