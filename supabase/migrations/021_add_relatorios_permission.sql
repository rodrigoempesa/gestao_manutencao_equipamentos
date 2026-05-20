-- Adiciona módulo 'relatorios' nas permissões de role para admin_geral e admin_local
insert into public.role_module_permissions (role, module_slug, enabled)
values
  ('admin_geral', 'relatorios', true),
  ('admin_local', 'relatorios', true)
on conflict (role, module_slug) do update set enabled = true;
