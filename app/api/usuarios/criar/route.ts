import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin_geral') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, name, role, branch_id, access_profile_id } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: newUserData, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, branch_id: branch_id ?? null, tenant_id: profile.tenant_id },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (access_profile_id && newUserData.user) {
    // Give the trigger time to create the profile row
    await new Promise(r => setTimeout(r, 600))
    await admin.from('profiles').update({ access_profile_id }).eq('id', newUserData.user.id)
  }

  return NextResponse.json({ success: true })
}
