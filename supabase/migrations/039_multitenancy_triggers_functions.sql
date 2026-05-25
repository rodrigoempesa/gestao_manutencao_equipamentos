-- Migration 039 - Multi-tenancy: triggers auto-fill, handle_new_user, set_work_order_number, RPC
-- Execute após 037 e 038

-- ============================================================
-- 1. Função auto_set_tenant_id()
--    Preenche tenant_id automaticamente em todos os INSERTs
--    com base no perfil do usuário autenticado.
-- ============================================================

create or replace function public.auto_set_tenant_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := (select tenant_id from public.profiles where id = auth.uid());
    if new.tenant_id is null then
      raise exception 'Não foi possível determinar tenant_id para o usuário atual (uid=%)', auth.uid();
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 2. Conectar trigger às tabelas de tenant
--    Nome: trg_auto_tenant_id  (vem antes de trg_work_order_number
--    alfabeticamente, garantindo que tenant_id esteja preenchido
--    quando set_work_order_number() executar em work_orders)
-- ============================================================

create trigger trg_auto_tenant_id
  before insert on public.branches
  for each row execute function public.auto_set_tenant_id();

-- Nota: profiles NÃO recebe esse trigger genérico porque
-- handle_new_user() já define tenant_id explicitamente a partir
-- de raw_user_meta_data (ver seção 3 abaixo). Se tenant_id vier
-- null no metadata, queremos falhar explicitamente, não silenciar.

create trigger trg_auto_tenant_id
  before insert on public.equipment
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.readings
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.maintenance_records
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.maintenance_record_items
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.purchase_requests
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.purchase_request_items
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.equipment_branch_transfers
  for each row execute function public.auto_set_tenant_id();

-- work_orders: trg_auto_tenant_id (A) executa ANTES de
-- trg_work_order_number (W) pela ordem alfabética dos nomes.
create trigger trg_auto_tenant_id
  before insert on public.work_orders
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.products
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.services
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.access_profiles
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.access_profile_modules
  for each row execute function public.auto_set_tenant_id();

create trigger trg_auto_tenant_id
  before insert on public.role_module_permissions
  for each row execute function public.auto_set_tenant_id();

-- ============================================================
-- 3. Atualizar handle_new_user para ler tenant_id do metadata
--    A API route de criação de usuário deve passar tenant_id
--    em user_metadata para que o perfil seja atribuído ao tenant
--    correto desde o momento da criação.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, branch_id, tenant_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'encarregado'),
    (new.raw_user_meta_data->>'branch_id')::uuid,
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  return new;
end;
$$;

-- ============================================================
-- 4. Atualizar set_work_order_number para sequência por tenant
--    Antes: contava todas as OS globalmente
--    Depois: conta apenas as OS do tenant do novo registro
-- ============================================================

create or replace function public.set_work_order_number()
returns trigger
language plpgsql
security definer
as $$
declare
  v_year      text;
  v_tenant_id uuid;
  v_next      int;
begin
  if new.number is not null and new.number <> '' then
    return new;
  end if;

  v_year      := to_char(now(), 'YYYY');
  v_tenant_id := new.tenant_id; -- já preenchido por trg_auto_tenant_id

  -- Lock por tenant + ano para evitar duplicatas em inserções concorrentes
  perform pg_advisory_xact_lock(
    hashtext('wo_seq_' || v_tenant_id::text || '_' || v_year)
  );

  select coalesce(
    max((regexp_match(number, '[0-9]+$'))[1]::int),
    0
  ) + 1
  into v_next
  from public.work_orders
  where tenant_id = v_tenant_id
    and number like 'OS-' || v_year || '-%';

  new.number := 'OS-' || v_year || '-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

-- ============================================================
-- 5. RPC upsert_role_permissions
--    Substitui o upsert direto do cliente (que usava
--    onConflict: 'role,module_slug' — PK antiga).
--    O código da app chama: supabase.rpc('upsert_role_permissions', { p_rows: rows })
-- ============================================================

create or replace function public.upsert_role_permissions(p_rows jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid() and role = 'admin_geral';

  if v_tenant_id is null then
    raise exception 'Permissão negada: apenas admin_geral pode alterar permissões de papel';
  end if;

  insert into public.role_module_permissions (tenant_id, role, module_slug, enabled)
  select
    v_tenant_id,
    (r->>'role')::text,
    (r->>'module_slug')::text,
    (r->>'enabled')::boolean
  from jsonb_array_elements(p_rows) r
  on conflict (tenant_id, role, module_slug) do update
    set enabled = excluded.enabled;
end;
$$;
