export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RelatoriosClient from './RelatoriosClient'

export default async function RelatoriosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const isAdminGeral = profile.role === 'admin_geral'

  // Equipment with last reading date (from vw_equipment_status) — all statuses
  let statusQuery = supabase
    .from('vw_equipment_status')
    .select('id, code, name, active, branch_id, branch_name, branch_city, branch_state, tracking_type, current_reading, last_reading_date, last_maintenance_date, last_maintenance_reading, last_maintenance_plan_name, next_maintenance_plan_name, next_maintenance_threshold, next_maintenance_interval')
    .order('code')

  if (!isAdminGeral && profile.branch_id) {
    statusQuery = statusQuery.eq('branch_id', profile.branch_id)
  }

  const { data: statusList } = await statusQuery

  // Equipment without initial_reading — all statuses
  let noInitialQuery = supabase
    .from('equipment')
    .select('id, code, name, active, branch_id, branches(name, city, state), equipment_models(name, brands(name))')
    .is('initial_reading', null)
    .order('code')

  if (!isAdminGeral && profile.branch_id) {
    noInitialQuery = noInitialQuery.eq('branch_id', profile.branch_id)
  }

  const { data: noInitialList } = await noInitialQuery

  // Models without plans (admin_geral only)
  let noPlansModels: any[] = []
  if (isAdminGeral) {
    const { data: models } = await supabase
      .from('equipment_models')
      .select('id, name, brands(name), maintenance_plans(id)')
      .order('name')

    noPlansModels = (models ?? []).filter(
      (m: any) => !m.maintenance_plans || m.maintenance_plans.length === 0
    )
  }

  return (
    <RelatoriosClient
      statusList={statusList ?? []}
      noInitialList={noInitialList ?? []}
      noPlansModels={noPlansModels}
      isAdminGeral={isAdminGeral}
    />
  )
}
