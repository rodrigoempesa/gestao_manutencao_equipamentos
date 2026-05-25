export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SuperadminClient from './SuperadminClient'

export default async function SuperadminPage() {
  // Verifica autenticação e flag superadmin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  if (!(profile as any)?.is_superadmin) redirect('/')

  // Busca todos os tenants com stats usando admin client (bypass RLS)
  const admin = createAdminClient()

  const { data: tenants } = await admin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  // Busca contagem de usuários e equipamentos por tenant
  const { data: userCounts } = await admin
    .from('profiles')
    .select('tenant_id')

  const { data: equipCounts } = await admin
    .from('equipment')
    .select('tenant_id')

  const userMap: Record<string, number> = {}
  const equipMap: Record<string, number> = {};
  (userCounts ?? []).forEach((r: any) => {
    userMap[r.tenant_id] = (userMap[r.tenant_id] ?? 0) + 1
  });
  (equipCounts ?? []).forEach((r: any) => {
    equipMap[r.tenant_id] = (equipMap[r.tenant_id] ?? 0) + 1
  })

  const enriched = (tenants ?? []).map((t: any) => ({
    ...t,
    user_count: userMap[t.id] ?? 0,
    equip_count: equipMap[t.id] ?? 0,
  }))

  return <SuperadminClient tenants={enriched} />
}
