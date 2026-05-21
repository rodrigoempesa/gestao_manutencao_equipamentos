export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WorkOrder } from '@/lib/types'
import OsClient from './OsClient'

export default async function OsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Work orders com equipamento e plano
  let osQuery = supabase
    .from('work_orders')
    .select(`
      *,
      equipment:equipment_id(id, code, name, branch_id,
        equipment_models(id, name, brands(name)),
        branches(id, name, city, state)
      ),
      maintenance_plans:plan_id(id, name, interval_value)
    `)
    .order('created_at', { ascending: false })

  if (profile.role !== 'admin_geral' && profile.branch_id) {
    // Filtra por filial via equipamento (usando subquery não é direto, filtramos no client)
  }

  const { data: orders = [] } = await osQuery as { data: WorkOrder[] | null }

  // Equipment para o modal de criação
  let eqQuery = supabase
    .from('equipment')
    .select('id, code, name, model_id, branch_id, equipment_models(id, name, brands(name))')
    .eq('active', true)
    .order('code')

  if (profile.role !== 'admin_geral' && profile.branch_id) {
    eqQuery = eqQuery.eq('branch_id', profile.branch_id)
  }

  const { data: equipmentList = [] } = await eqQuery

  // Planos agrupados por model_id
  const { data: allPlans = [] } = await supabase
    .from('maintenance_plans')
    .select('id, name, interval_value, model_id')
    .order('interval_value')

  const plansByModel: Record<string, { id: string; name: string; interval_value: number }[]> = {}
  ;(allPlans ?? []).forEach((p: any) => {
    if (!plansByModel[p.model_id]) plansByModel[p.model_id] = []
    plansByModel[p.model_id].push(p)
  })

  // Filtra OS por filial se não admin_geral
  const filteredOrders = profile.role !== 'admin_geral' && profile.branch_id
    ? (orders ?? []).filter((o: any) => o.equipment?.branch_id === profile.branch_id)
    : (orders ?? [])

  return (
    <OsClient
      orders={filteredOrders}
      equipmentList={equipmentList ?? []}
      plansByModel={plansByModel}
      currentUserId={user.id}
      isAdminGeral={profile.role === 'admin_geral'}
    />
  )
}
