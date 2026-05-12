export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Clock, Wrench, Activity } from 'lucide-react'

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
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="section-title">Status dos Equipamentos</h2>
          <span className="text-sm text-gray-400">{total} equipamentos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Código / Nome</th>
                <th className="table-header">Filial</th>
                <th className="table-header">Leitura Atual</th>
                <th className="table-header">Última Leitura</th>
                <th className="table-header">Média/dia</th>
                <th className="table-header">Última Manut.</th>
                <th className="table-header">Próx. Manut.</th>
                <th className="table-header">Previsão</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="table-cell text-center text-gray-400 py-12">
                    Nenhum equipamento cadastrado
                  </td>
                </tr>
              )}
              {list.map(eq => {
                const status = getMaintenanceStatus(eq)
                const days = getDaysUntilMaintenance(eq)
                const statusMap = {
                  overdue: <span className="badge-red">Vencido</span>,
                  warning: <span className="badge-yellow">Atenção</span>,
                  ok: <span className="badge-green">OK</span>,
                  no_data: <span className="badge-gray">Sem dados</span>,
                }
                return (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900">{eq.code}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[140px]">{eq.name}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm">{eq.branch_name}</p>
                      <p className="text-xs text-gray-400">{eq.branch_city}/{eq.branch_state}</p>
                    </td>
                    <td className="table-cell font-mono font-semibold">
                      {formatReading(eq.current_reading, eq.tracking_type)}
                    </td>
                    <td className="table-cell text-gray-500">
                      {formatDate(eq.last_reading_date)}
                    </td>
                    <td className="table-cell text-gray-500">
                      {eq.daily_avg
                        ? formatReading(eq.daily_avg, eq.tracking_type)
                        : '-'}
                    </td>
                    <td className="table-cell">
                      {eq.last_maintenance_date ? (
                        <div>
                          <p className="text-sm">{formatDate(eq.last_maintenance_date)}</p>
                          <p className="text-xs text-gray-400">{eq.last_maintenance_plan_name}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {eq.next_maintenance_plan_name ? (
                        <div>
                          <p className="text-sm font-medium">{eq.next_maintenance_plan_name}</p>
                          <p className="text-xs text-gray-400">
                            em {formatReading(eq.next_maintenance_interval, eq.tracking_type)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {days !== null ? (
                        <span className={days < 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                          {days < 0 ? `${Math.abs(days)}d vencido` : `${days} dias`}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">{statusMap[status]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

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
