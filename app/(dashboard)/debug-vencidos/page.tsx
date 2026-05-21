export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default async function DebugVencidosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list = [] } = await supabase
    .from('vw_equipment_status')
    .select('*')
    .eq('active', true)
    .order('code') as { data: EquipmentStatus[] | null }

  const overdue = (list ?? []).filter(e => getMaintenanceStatus(e) === 'overdue')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-red-600">🔍 Debug — Equipamentos Vencidos ({overdue.length})</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Página temporária de diagnóstico</span>
      </div>

      <div className="space-y-4">
        {overdue.map(eq => {
          const accumulated = eq.accumulated_since_maintenance
          const threshold = eq.next_maintenance_threshold
          const lastMaintReading = eq.last_maintenance_reading
          const lastMaintInterval = eq.last_maintenance_interval
          const initial = (eq as any).initial_reading

          // Dias vencido via daily_avg
          const daysOverdue = eq.daily_avg && threshold && eq.current_reading
            ? Math.round((eq.current_reading - threshold) / eq.daily_avg)
            : null

          return (
            <div key={eq.id} className="border border-red-200 rounded-xl bg-red-50 p-4 space-y-3">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">{eq.code}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-700">{eq.name}</span>
                  <span className="text-gray-400 text-sm ml-3">{eq.branch_name} · {eq.brand_name} {eq.model_name}</span>
                </div>
                <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold">
                  {daysOverdue !== null ? `${daysOverdue}d vencido` : 'VENCIDO'}
                </span>
              </div>

              {/* Grid de dados brutos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura atual</p>
                  <p className="font-mono font-bold text-gray-900">{formatReading(eq.current_reading, eq.tracking_type)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Horímetro inicial</p>
                  <p className="font-mono font-bold text-gray-900">
                    {initial !== undefined && initial !== null ? formatReading(initial, eq.tracking_type) : <span className="text-orange-500">não definido</span>}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Média/dia</p>
                  <p className="font-mono font-bold text-gray-900">{eq.daily_avg ? formatReading(eq.daily_avg, eq.tracking_type) : '-'}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Última leitura</p>
                  <p className="font-bold text-gray-900">{formatDate(eq.last_reading_date)}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Última manutenção</p>
                  <p className="font-bold text-gray-900">{formatDate(eq.last_maintenance_date) || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{eq.last_maintenance_plan_name ?? '-'}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura na última manut.</p>
                  <p className="font-mono font-bold text-gray-900">{lastMaintReading !== null && lastMaintReading !== undefined ? formatReading(lastMaintReading, eq.tracking_type) : '-'}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Intervalo última manut.</p>
                  <p className="font-mono font-bold text-gray-900">{lastMaintInterval ? `${lastMaintInterval}h` : '-'}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Acumulado desde manut.</p>
                  <p className={`font-mono font-bold ${accumulated !== null && threshold && accumulated >= threshold ? 'text-red-600' : 'text-gray-900'}`}>
                    {accumulated !== null && accumulated !== undefined ? formatReading(accumulated, eq.tracking_type) : '-'}
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 col-span-2">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Próximo plano</p>
                  <p className="font-bold text-gray-900">{eq.next_maintenance_plan_name ?? '-'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Intervalo: {eq.next_maintenance_interval ? `${eq.next_maintenance_interval}h` : '-'}
                    &nbsp;·&nbsp;
                    Threshold calculado: <span className="font-mono font-semibold">{formatReading(threshold, eq.tracking_type)}</span>
                  </p>
                </div>

                <div className={`rounded-lg p-3 border col-span-2 ${threshold && eq.current_reading && eq.current_reading >= threshold ? 'bg-red-100 border-red-300' : 'bg-green-50 border-green-200'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Diagnóstico</p>
                  {threshold && eq.current_reading ? (
                    <p className="text-sm font-semibold">
                      Leitura atual ({formatReading(eq.current_reading, eq.tracking_type)})
                      {eq.current_reading >= threshold
                        ? <span className="text-red-700"> ≥ threshold ({formatReading(threshold, eq.tracking_type)}) → VENCIDO por leitura</span>
                        : <span className="text-green-700"> &lt; threshold → VENCIDO por previsão (≤15 dias)</span>
                      }
                    </p>
                  ) : (
                    <p className="text-sm text-orange-600 font-semibold">Sem leitura ou sem threshold</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
