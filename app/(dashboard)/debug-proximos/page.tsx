export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function DebugProximosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list = [] } = await supabase
    .from('vw_equipment_status')
    .select('*')
    .eq('active', true)
    .order('code') as { data: EquipmentStatus[] | null }

  const warning = (list ?? [])
    .filter(e => getMaintenanceStatus(e) === 'warning')
    .sort((a, b) => {
      const da = getDaysUntilMaintenance(a) ?? 999
      const db = getDaysUntilMaintenance(b) ?? 999
      return da - db
    })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-yellow-600">⏰ Próximos 30 dias ({warning.length})</h1>
      </div>

      <div className="space-y-3">
        {warning.map(eq => {
          const days = getDaysUntilMaintenance(eq)
          const threshold = eq.next_maintenance_threshold
          return (
            <div key={eq.id} className="border border-yellow-200 rounded-xl bg-yellow-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">{eq.code}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-700">{eq.name}</span>
                  <span className="text-gray-400 text-sm ml-3">{eq.branch_name} · {eq.brand_name} {eq.model_name}</span>
                </div>
                <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded font-semibold whitespace-nowrap">
                  {days !== null ? `${days} dias` : 'Atenção'}
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

                <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-200">
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

              <div className="rounded-lg p-3 border bg-yellow-100 border-yellow-300 text-sm text-yellow-800 font-semibold">
                ⏰ Faltam {days !== null ? `${days} dias` : '–'} · leitura atual {formatReading(eq.current_reading, eq.tracking_type)} de {formatReading(threshold, eq.tracking_type)}
              </div>
            </div>
          )
        })}

        {warning.length === 0 && (
          <p className="text-gray-400 text-center py-12">Nenhum equipamento com manutenção nos próximos 30 dias.</p>
        )}
      </div>
    </div>
  )
}
