import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_superadmin').eq('id', user.id).single()
  if (!(profile as any)?.is_superadmin) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { tenant_id, paid } = await request.json()
  const admin = createAdminClient()
  const { error } = await admin.from('tenants').update({ paid }).eq('id', tenant_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
