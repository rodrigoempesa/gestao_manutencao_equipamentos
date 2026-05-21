export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { WorkOrder } from '@/lib/types'
import OsDetailClient from './OsDetailClient'

export default async function OsDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: os, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      equipment:equipment_id(
        id, code, name, serial_number, year,
        equipment_models(id, name, tracking_type, brands(id, name)),
        branches(id, name, city, state)
      ),
      maintenance_plans:plan_id(
        id, name, interval_value,
        maintenance_plan_items(id, description, order_index)
      )
    `)
    .eq('id', params.id)
    .single() as { data: WorkOrder | null; error: any }

  if (error || !os) notFound()

  // Busca perfis dos envolvidos (opened/started/finished)
  const userIds = [os.opened_by, os.started_by, os.finished_by].filter(Boolean) as string[]
  const { data: profiles = [] } = userIds.length > 0
    ? await supabase.from('profiles').select('id, name').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.name]))

  return (
    <OsDetailClient
      os={os}
      profileMap={profileMap}
      currentUserId={user.id}
    />
  )
}
