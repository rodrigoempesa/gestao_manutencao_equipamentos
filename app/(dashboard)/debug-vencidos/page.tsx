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

  // Busca initial_reading direto da tabela equipment para todos os vencidos
  const overdueIds = overdue.map(e => e.id)
  const { data: equipData = [] } = await supabase
    .from('equipment')
    .select('id, initial_reading, initial_reading_date')
    .in('id', overdueIds)

  const initialMap = Object.fromEntries((equipData ?? []).map(e => [e.id, e]))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-red-600">🔍 Debug — Equipamentos Vencidos ({overdue.length})</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Página temporária de diagnóstico</span>
      </div>

      <div className="space-y-4">
        {overdue.map(eq => {
          const raw = eq as any
          const eqData = initialMap[eq.id] ?? {}
          const initialReading: number | null = eqData.initial_reading ?? null
          const initialDate: string | null = eqData.initial_reading_date ?? null

          // base_reading é a coluna calculada pela view
          const baseReading: number | null = raw.base_reading ?? null
          const threshold = eq.next_maintenance_threshold
          const accumulated = eq.accumulated_since_maintenance

          const daysOverdue = eq.daily_avg && threshold && eq.current_reading && eq.current_reading >= threshold
            ? Math.round((eq.current_reading - threshold) / eq.daily_avg)
            : null
          const daysLeft = eq.daily_avg && threshold && eq.current_reading && eq.current_reading < threshold
            ? Math.round((threshold - eq.current_reading) / eq.daily_avg)
            : null

          const isOverdueByReading = threshold !== null && eq.current_reading !== null && eq.current_reading >= threshold

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
                  {daysOverdue !== null ? `${daysOverdue}d vencido` : daysLeft !== null ? `${daysLeft}d restantes` : 'VENCIDO'}
                </span>
              </div>

              {/* Grid de dados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura atual</p>
                  <p className="font-mono font-bold text-gray-900">{formatReading(eq.current_reading, eq.tracking_type)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(eq.last_reading_date)}</p>
                </div>

                <div className={`rounded-lg p-3 border ${initialReading !== null ? 'bg-white border-gray-100' : 'bg-orange-50 border-orange-200'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Horímetro inicial (BD)</p>
                  {initialReading !== null ? (
                    <>
                      <p className="font-mono font-bold text-gray-900">{formatReading(initialReading, eq.tracking_type)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(initialDate)}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-orange-600">não definido</p>
                  )}
                </div>

                <div className={`rounded-lg p-3 border ${baseReading !== null && baseReading > 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Base usada p/ threshold</p>
                  <p className="font-mono font-bold text-blue-800">{baseReading !== null ? formatReading(baseReading, eq.tracking_type) : '0h (fallback)'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {eq.last_maintenance_reading !== null ? 'última manutenção' : initialReading !== null ? 'horímetro inicial' : '⚠ sem base definida'}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Média/dia</p>
                  <p className="font-mono font-bold text-gray-900">{eq.daily_avg ? formatReading(eq.daily_avg, eq.tracking_type) : '-'}</p>
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    intervalo: {eq.last_maintenance_interval ? `${eq.last_maintenance_interval}h` : '-'}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Acumulado desde base</p>
                  <p className="font-mono font-bold text-gray-900">
                    {accumulated !== null ? formatReading(accumulated, eq.tracking_type) : '-'}
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Próximo plano</p>
                  <p className="font-bold text-gray-900 text-xs">{eq.next_maintenance_plan_name ?? '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    intervalo: {eq.next_maintenance_interval ?? '-'}h<br />
                    threshold: <span className="font-mono font-semibold">{formatReading(threshold, eq.tracking_type)}</span>
                  </p>
                </div>
              </div>

              {/* Diagnóstico */}
              <div className={`rounded-lg p-3 border text-sm font-semibold ${isOverdueByReading ? 'bg-red-100 border-red-300 text-red-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                🔍 {isOverdueByReading
                  ? `Leitura atual (${formatReading(eq.current_reading, eq.tracking_type)}) ≥ threshold (${formatReading(threshold, eq.tracking_type)}) → VENCIDO por leitura`
                  : `Leitura atual (${formatReading(eq.current_reading, eq.tracking_type)}) < threshold (${formatReading(threshold, eq.tracking_type)}) → VENCIDO por previsão (≤15 dias)`
                }
                {baseReading === 0 && initialReading === null && (
                  <p className="text-orange-700 font-normal text-xs mt-1">
                    ⚠ Base = 0 porque não há horímetro inicial nem manutenção registrada. Cadastre o horímetro inicial para corrigir o cálculo.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
