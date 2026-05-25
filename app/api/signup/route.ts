import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { company_name, name, email, password } = body

  if (!company_name?.trim() || !name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Gerar slug único
  let slug = slugify(company_name.trim()) || 'empresa'
  const { data: existing } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  // Criar tenant
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: company_name.trim(), slug })
    .select('id')
    .single()

  if (tenantError) {
    if (tenantError.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma empresa com esse nome. Tente um nome diferente.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar empresa.' }, { status: 500 })
  }

  // Criar usuário admin já confirmado
  const { error: userError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      name: name.trim(),
      role: 'admin_geral',
      branch_id: null,
      tenant_id: tenant.id,
    },
  })

  if (userError) {
    // Rollback: remove o tenant criado
    await admin.from('tenants').delete().eq('id', tenant.id)
    if (userError.message.includes('already registered')) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: userError.message }, { status: 400 })
  }

  // Seed permissões padrão para os papéis do novo tenant
  const { data: modules } = await admin.from('modules').select('slug')
  if (modules && modules.length > 0) {
    const defaultEnabled: Record<string, string[]> = {
      admin_local: ['dashboard', 'leituras', 'manutencoes', 'os', 'equipamentos', 'produtos', 'servicos', 'solicitacoes', 'relatorios', 'usuarios'],
      encarregado: ['dashboard', 'leituras', 'os'],
    }
    const perms = ['admin_local', 'encarregado'].flatMap(role =>
      modules.map((m: { slug: string }) => ({
        tenant_id: tenant.id,
        role,
        module_slug: m.slug,
        enabled: (defaultEnabled[role] ?? []).includes(m.slug),
      }))
    )
    await admin.from('role_module_permissions').upsert(perms, { onConflict: 'tenant_id,role,module_slug' })
  }

  return NextResponse.json({ success: true })
}
