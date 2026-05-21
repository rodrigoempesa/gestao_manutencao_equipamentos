insert into public.modules (slug, label)
  values ('os', 'Ordens de Serviço')
  on conflict (slug) do nothing;

insert into public.role_module_permissions (role, module_slug, enabled) values
  ('admin_geral',  'os', true),
  ('admin_local',  'os', true),
  ('encarregado',  'os', true)
on conflict (role, module_slug) do update set enabled = true;
