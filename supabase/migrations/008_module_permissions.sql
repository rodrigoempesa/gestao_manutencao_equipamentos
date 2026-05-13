-- ============================================================
-- Migration 008 - Módulos e permissões por perfil de acesso
-- Execute no editor SQL do Supabase
-- ============================================================

-- Definição dos módulos (espelha os itens da sidebar)
create table if not exists public.modules (
  slug        text primary key,
  label       text not null,
  order_index int  not null default 0
);

insert into public.modules (slug, label, order_index) values
  ('dashboard',    'Dashboard',              1),
  ('leituras',     'Leituras',               2),
  ('manutencoes',  'Manutenções',            3),
  ('equipamentos', 'Equipamentos',           4),
  ('produtos',     'Produtos (Estoque)',     5),
  ('servicos',     'Serviços',              6),
  ('planos',       'Planos de Manutenção',  7),
  ('solicitacoes', 'Solicitações de Compra', 8),
  ('filiais',      'Filiais',               9),
  ('usuarios',     'Usuários',             10)
on conflict (slug) do nothing;

-- Permissões por perfil (configurável via UI)
create table if not exists public.role_module_permissions (
  role        text not null,
  module_slug text not null references public.modules(slug) on delete cascade,
  enabled     boolean not null default true,
  primary key (role, module_slug)
);

-- Defaults: admin_geral → tudo
insert into public.role_module_permissions (role, module_slug, enabled)
select 'admin_geral', slug, true from public.modules
on conflict do nothing;

-- Defaults: admin_local → operacional da filial
insert into public.role_module_permissions (role, module_slug, enabled) values
  ('admin_local', 'dashboard',    true),
  ('admin_local', 'leituras',     true),
  ('admin_local', 'manutencoes',  true),
  ('admin_local', 'equipamentos', true),
  ('admin_local', 'produtos',     true),
  ('admin_local', 'servicos',     true),
  ('admin_local', 'solicitacoes', true),
  ('admin_local', 'usuarios',     true)
on conflict do nothing;

-- Defaults: encarregado/operador → apenas leituras
insert into public.role_module_permissions (role, module_slug, enabled) values
  ('encarregado', 'dashboard', true),
  ('encarregado', 'leituras',  true)
on conflict do nothing;

-- RLS
alter table public.modules enable row level security;
alter table public.role_module_permissions enable row level security;

create policy "modules_read_all"   on public.modules               for select using (true);
create policy "rmp_read_all"       on public.role_module_permissions for select using (true);
create policy "rmp_admin_write"    on public.role_module_permissions
  for all using (get_my_role() = 'admin_geral')
  with check (get_my_role() = 'admin_geral');
