'use client'

import { useState } from 'react'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, getUpcomingWarning, formatReading } from '@/lib/types'
import { AlertTriangle, Wrench, ChevronDown, ChevronUp } from 'lucide-react'

const INITIAL_LIMIT = 6

export default function AlertsSection({ items }: { items: EquipmentStatus[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, INITIAL_LIMIT)
  const hidden = items.length - INITIAL_LIMIT

  return (
    <div className="space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        Manutenções Vencidas
        <span className="ml-1 text-sm font-normal text-gray-400">({items.length})</span>
      </h2>

      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map(eq => {
          const status = getMaintenanceStatus(eq)
          const days = getDaysUntilMaintenance(eq)
          const upcoming = getUpcomingWarning(eq)
          const overage = status === 'overdue' && eq.current_reading !== null && eq.next_maintenance_threshold !== null
            ? eq.current_reading - eq.next_maintenance_threshold
            : null
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
                    {overage !== null ? `+${formatReading(overage, eq.tracking_type)} vencidas` : `${days} dias`}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{eq.branch_name} · {eq.brand_name} {eq.model_name}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {eq.next_maintenance_plan_name && `Revisão vencida: ${eq.next_maintenance_plan_name} · `}
                  Leitura atual: {formatReading(eq.current_reading, eq.tracking_type)}
                </p>
                {upcoming && (
                  <div className="mt-2 flex items-start gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-800">
                      <strong>Atenção:</strong> faltam apenas{' '}
                      <strong>{formatReading(upcoming.remaining, eq.tracking_type)}</strong>{' '}
                      para a <strong>{upcoming.planName}</strong>{' '}
                      (em {formatReading(upcoming.threshold, eq.tracking_type)}).
                      Considere antecipar o pedido de materiais desta revisão.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {items.length > INITIAL_LIMIT && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium mx-auto"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> Ver mais {hidden} equipamento{hidden !== 1 ? 's' : ''}</>
          )}
        </button>
      )}
    </div>
  )
}
