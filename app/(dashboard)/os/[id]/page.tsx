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
        maintenance_plan_items(id, description, order_index, product_id, quantity,
          products(id, code, name, unit, unit_price))
      )
    `)
    .eq('id', params.id)
    .single() as { data: WorkOrder | null; error: any }

  if (error || !os) notFound()

  // Busca perfis dos envolvidos (opened/started/finished)
  const userIds = [os.opened_by, os.started_by, os.finished_by].filter(Boolean) as string[]

  const [
    { data: profiles = [] },
    { data: myProfile },
    { data: purchaseRequests = [] },
    { data: products = [] },
  ] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, name').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('purchase_requests')
      .select('*, maintenance_plans:plan_id(id, name, interval_value), purchase_request_items(*, products(id, code, name, unit, unit_price))')
      .eq('work_order_id', params.id)
      .order('created_at', { ascending: true }),
    supabase.from('products').select('id, code, name, unit, unit_price').eq('active', true).order('name'),
  ])

  // Solicitações de compra existentes, ainda não vinculadas a nenhuma OS,
  // do mesmo equipamento (e mesma revisão, quando a OS for preventiva).
  let availableQuery = supabase
    .from('purchase_requests')
    .select('*, maintenance_plans:plan_id(id, name, interval_value), purchase_request_items(*, products(id, code, name, unit, unit_price))')
    .eq('equipment_id', os.equipment_id)
    .is('work_order_id', null)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })
  if (os.plan_id) availableQuery = availableQuery.eq('plan_id', os.plan_id)
  const { data: availableRequests = [] } = await availableQuery

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.name]))

  return (
    <OsDetailClient
      os={os}
      profileMap={profileMap}
      currentUserId={user.id}
      role={myProfile?.role ?? 'encarregado'}
      products={(products as any[]) ?? []}
      purchaseRequests={(purchaseRequests as any[]) ?? []}
      availableRequests={(availableRequests as any[]) ?? []}
    />
  )
}
