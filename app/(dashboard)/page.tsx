export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Clock, Wrench, Activity } from 'lucide-react'

import EquipmentStatusTable from './components/EquipmentStatusTable'

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

  const total = list.length
  const overdue = list.filter(e => getMaintenanceStatus(e) === 'overdue').length
  const warning = list.filter(e => getMaintenanceStatus(e) === 'warning').length
  const ok = list.filter(e => getMaintenanceStatus(e) === 'ok').length
  const noData = list.filter(e => getMaintenanceStatus(e) === 'no_data').length

  const { data: recentReadings } = await supabase
    .from('readings')
    .select('*, equipment:equipment_id(code, name, equipment_models(tracking_type, brands(name)))')
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral dos equipamentos e manutenções</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-sm text-gray-500">Equipamentos</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{overdue}</p>
            <p className="text-sm text-gray-500">Vencidos</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{warning}</p>
            <p className="text-sm text-gray-500">Próximos 30 dias</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{ok}</p>
            <p className="text-sm text-gray-500">Em dia</p>
          </div>
        </div>
      </div>

      {/* Alerts for overdue/warning */}
      {(overdue > 0 || warning > 0) && (
        <div className="space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Atenção Necessária
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {list
              .filter(e => ['overdue', 'warning'].includes(getMaintenanceStatus(e)))
              .sort((a, b) => {
                const sa = getMaintenanceStatus(a)
                const sb = getMaintenanceStatus(b)
                if (sa === 'overdue' && sb !== 'overdue') return -1
                if (sa !== 'overdue' && sb === 'overdue') return 1
                return 0
              })
              .map(eq => {
                const status = getMaintenanceStatus(eq)
                const days = getDaysUntilMaintenance(eq)
                return (
                  <div
                    key={eq.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border ${
                      status === 'overdue'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <Wrench className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      status === 'overdue' ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {eq.code} – {eq.name}
                        </p>
                        <span className={status === 'overdue' ? 'badge-red' : 'badge-yellow'}>
                          {status === 'overdue' ? 'VENCIDO' : `${days} dias`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{eq.branch_name} · {eq.brand_name} {eq.model_name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {eq.next_maintenance_plan_name && `Próx: ${eq.next_maintenance_plan_name} · `}
                        Leitura atual: {formatReading(eq.current_reading, eq.tracking_type)}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Equipment Status Table */}
      <EquipmentStatusTable list={list} isAdminGeral={profile.role === 'admin_geral'} />

      {/* Recent Readings */}
      {recentReadings && recentReadings.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="section-title">Leituras Recentes</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentReadings.map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{r.equipment?.code}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-sm text-gray-600">{r.equipment?.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-semibold text-sm">
                    {formatReading(r.reading_value, r.equipment?.equipment_models?.tracking_type ?? 'hours')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(r.reading_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
