-- Adiciona módulo 'relatorios' na tabela de módulos e libera para admin_geral e admin_local
insert into public.modules (slug, label)
values ('relatorios', 'Relatórios')
on conflict (slug) do nothing;

insert into public.role_module_permissions (role, module_slug, enabled)
values
  ('admin_geral', 'relatorios', true),
  ('admin_local', 'relatorios', true)
on conflict (role, module_slug) do update set enabled = true;
