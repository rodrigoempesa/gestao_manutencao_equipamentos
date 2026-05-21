export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus } from '@/lib/types'
import { AlertTriangle, CheckCircle, Clock, Activity, HelpCircle, Wrench } from 'lucide-react'
import EquipmentStatusTable from './components/EquipmentStatusTable'
import AlertsSection from './components/AlertsSection'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  let query = supabase
    .from('vw_equipment_status')
    .select('*')
    .eq('active', true)
    .order('code')

  if (profile.role !== 'admin_geral' && profile.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }

  const { data: equipments = [] } = await query as { data: EquipmentStatus[] | null }
  const list = equipments ?? []

  const total    = list.length
  const overdue  = list.filter(e => getMaintenanceStatus(e) === 'overdue').length
  const warning  = list.filter(e => getMaintenanceStatus(e) === 'warning').length
  const ok       = list.filter(e => getMaintenanceStatus(e) === 'ok').length
  const osAberta = list.filter(e => getMaintenanceStatus(e) === 'os_aberta').length
  const noData   = list.filter(e => getMaintenanceStatus(e) === 'no_data').length

  const alertItems = list
    .filter(e => getMaintenanceStatus(e) === 'overdue')
    .sort((a, b) => {
      const sa = getMaintenanceStatus(a)
      const sb = getMaintenanceStatus(b)
      if (sa === 'overdue' && sb !== 'overdue') return -1
      if (sa !== 'overdue' && sb === 'overdue') return 1
      return 0
    })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral dos equipamentos e manutenções</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-sm text-gray-500">Equipamentos</p>
        </div>
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{overdue}</p>
          <p className="text-sm text-gray-500">Vencidos</p>
        </div>
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{warning}</p>
          <p className="text-sm text-gray-500">Próximos 30 dias</p>
        </div>
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{ok}</p>
          <p className="text-sm text-gray-500">Em dia</p>
        </div>
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{osAberta}</p>
          <p className="text-sm text-gray-500">OS Aberta</p>
        </div>
        <div className="card flex flex-col items-center justify-center text-center gap-2">
          <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-500">{noData}</p>
          <p className="text-sm text-gray-500">Sem dados</p>
        </div>
      </div>

      {/* Alerts — collapsible after 6 items */}
      {alertItems.length > 0 && <AlertsSection items={alertItems} />}

      {/* Equipment Status Table with status filter tabs */}
      <EquipmentStatusTable list={list} isAdminGeral={profile.role === 'admin_geral'} />
    </div>
  )
}
