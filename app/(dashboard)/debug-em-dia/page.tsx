export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default async function DebugEmDiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list = [] } = await supabase
    .from('vw_equipment_status')
    .select('*')
    .eq('active', true)
    .order('code') as { data: EquipmentStatus[] | null }

  const ok = (list ?? [])
    .filter(e => getMaintenanceStatus(e) === 'ok')
    .sort((a, b) => {
      const da = getDaysUntilMaintenance(a) ?? 999
      const db = getDaysUntilMaintenance(b) ?? 999
      return da - db
    })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-green-600">✅ Em dia ({ok.length})</h1>
      </div>

      <div className="space-y-3">
        {ok.map(eq => {
          const days = getDaysUntilMaintenance(eq)
          const threshold = eq.next_maintenance_threshold
          return (
            <div key={eq.id} className="border border-green-200 rounded-xl bg-green-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">{eq.code}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-700">{eq.name}</span>
                  <span className="text-gray-400 text-sm ml-3">{eq.branch_name} · {eq.brand_name} {eq.model_name}</span>
                </div>
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-semibold whitespace-nowrap">
                  {days !== null ? `${days} dias` : 'OK'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura atual</p>
                  <p className="font-mono font-bold text-gray-900">{formatReading(eq.current_reading, eq.tracking_type)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(eq.last_reading_date)}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Média/dia</p>
                  <p className="font-mono font-bold text-gray-900">{eq.daily_avg ? formatReading(eq.daily_avg, eq.tracking_type) : '-'}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Acumulado desde revisão</p>
                  <p className="font-mono font-bold text-gray-900">{formatReading(eq.accumulated_since_maintenance, eq.tracking_type)}</p>
                </div>

                <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Próximo plano</p>
                  <p className="font-bold text-gray-900 text-xs">{eq.next_maintenance_plan_name ?? '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    threshold: <span className="font-mono font-semibold">{formatReading(threshold, eq.tracking_type)}</span>
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Última manutenção</p>
                  <p className="font-bold text-gray-900">{formatDate(eq.last_maintenance_date) || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{eq.last_maintenance_plan_name ?? '-'}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura na última manut.</p>
                  <p className="font-mono font-bold text-gray-900">
                    {eq.last_maintenance_reading !== null ? formatReading(eq.last_maintenance_reading, eq.tracking_type) : '-'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3 border bg-green-100 border-green-300 text-sm text-green-800 font-semibold">
                ✅ Próxima manutenção em {days !== null ? `${days} dias` : '–'} · faltam {formatReading(threshold !== null && eq.current_reading !== null ? threshold - eq.current_reading : null, eq.tracking_type)} para {formatReading(threshold, eq.tracking_type)}
              </div>
            </div>
          )
        })}

        {ok.length === 0 && (
          <p className="text-gray-400 text-center py-12">Nenhum equipamento em dia.</p>
        )}
      </div>
    </div>
  )
}
