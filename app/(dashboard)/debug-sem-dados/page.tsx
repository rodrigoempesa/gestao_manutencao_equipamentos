export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function DebugSemDadosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list = [] } = await supabase
    .from('vw_equipment_status')
    .select('*')
    .eq('active', true)
    .order('code') as { data: EquipmentStatus[] | null }

  const noData = (list ?? []).filter(e => getMaintenanceStatus(e) === 'no_data')

  const ids = noData.map(e => e.id)
  const { data: equipData = [] } = await supabase
    .from('equipment')
    .select('id, initial_reading, initial_reading_date')
    .in('id', ids)

  const initialMap = Object.fromEntries((equipData ?? []).map(e => [e.id, e]))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-700">🔍 Debug — Sem Dados ({noData.length})</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Página temporária de diagnóstico</span>
      </div>

      <div className="space-y-4">
        {noData.map(eq => {
          const eqData = initialMap[eq.id] ?? {}
          const initialReading: number | null = eqData.initial_reading ?? null
          const initialDate: string | null = eqData.initial_reading_date ?? null

          const semLeitura = !eq.current_reading
          const semPlano = !eq.next_maintenance_threshold

          return (
            <div key={eq.id} className="border border-gray-300 rounded-xl bg-gray-50 p-4 space-y-3">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">{eq.code}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-700">{eq.name}</span>
                  <span className="text-gray-400 text-sm ml-3">{eq.branch_name} · {eq.brand_name} {eq.model_name}</span>
                </div>
                <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded font-semibold">SEM DADOS</span>
              </div>

              {/* Causas */}
              <div className="flex gap-2 flex-wrap">
                {semLeitura && (
                  <span className="text-xs bg-orange-100 border border-orange-300 text-orange-800 px-2 py-1 rounded font-medium">
                    ⚠ Sem leitura cadastrada
                  </span>
                )}
                {semPlano && (
                  <span className="text-xs bg-red-100 border border-red-300 text-red-800 px-2 py-1 rounded font-medium">
                    ⚠ Sem threshold de manutenção
                  </span>
                )}
              </div>

              {/* Grid de dados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className={`rounded-lg p-3 border ${semLeitura ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Leitura atual</p>
                  {eq.current_reading !== null
                    ? <><p className="font-mono font-bold text-gray-900">{formatReading(eq.current_reading, eq.tracking_type)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(eq.last_reading_date)}</p></>
                    : <p className="font-semibold text-orange-600">nenhuma leitura</p>
                  }
                </div>

                <div className={`rounded-lg p-3 border ${initialReading !== null ? 'bg-white border-gray-100' : 'bg-orange-50 border-orange-200'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Horímetro inicial</p>
                  {initialReading !== null
                    ? <><p className="font-mono font-bold text-gray-900">{formatReading(initialReading, eq.tracking_type)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(initialDate)}</p></>
                    : <p className="font-semibold text-orange-600">não definido</p>
                  }
                </div>

                <div className={`rounded-lg p-3 border ${semPlano ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Próximo plano</p>
                  {eq.next_maintenance_plan_name
                    ? <><p className="font-bold text-gray-900 text-xs">{eq.next_maintenance_plan_name}</p>
                        <p className="text-xs text-gray-500 mt-1">threshold: {formatReading(eq.next_maintenance_threshold, eq.tracking_type)}</p></>
                    : <p className="font-semibold text-red-600">nenhum plano encontrado</p>
                  }
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Última manutenção</p>
                  <p className="font-bold text-gray-900">{formatDate(eq.last_maintenance_date) || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{eq.last_maintenance_plan_name ?? '-'}</p>
                  {eq.last_maintenance_reading !== null && (
                    <p className="text-xs text-gray-400">leitura: {formatReading(eq.last_maintenance_reading, eq.tracking_type)}</p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Modelo</p>
                  <p className="font-bold text-gray-900 text-xs">{eq.model_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {eq.tracking_type === 'hours' ? 'Horímetro (horas)' : 'Odômetro (km)'}
                    {eq.cycle_duration ? ` · ciclo: ${eq.cycle_duration}h` : ' · sem ciclo definido'}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Intervalo último plano</p>
                  <p className="font-mono font-bold text-gray-900">
                    {eq.last_maintenance_interval ? `${eq.last_maintenance_interval}h` : '-'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {eq.cycle_duration && eq.last_maintenance_interval
                      ? eq.last_maintenance_interval >= eq.cycle_duration
                        ? '⚠ último plano do ciclo'
                        : 'dentro do ciclo'
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Diagnóstico */}
              <div className="rounded-lg p-3 border bg-gray-100 border-gray-300 text-sm text-gray-700 space-y-1">
                <p className="font-semibold">🔍 Diagnóstico:</p>
                {semLeitura && (
                  <p>• Cadastre pelo menos uma leitura de horímetro/odômetro para este equipamento.</p>
                )}
                {!semLeitura && semPlano && !eq.last_maintenance_plan_name && (
                  <p>• O modelo <strong>{eq.model_name}</strong> não tem planos de manutenção cadastrados.</p>
                )}
                {!semLeitura && semPlano && eq.last_maintenance_plan_name && !eq.cycle_duration && (
                  <p>• A última manutenção foi <strong>{eq.last_maintenance_plan_name}</strong> (o plano de maior intervalo) e o modelo não tem <strong>cycle_duration</strong> definido — o sistema não sabe quando reiniciar o ciclo.</p>
                )}
                {!semLeitura && semPlano && eq.last_maintenance_plan_name && eq.cycle_duration && (
                  <p>• Verifique os planos cadastrados para o modelo <strong>{eq.model_name}</strong> — nenhum plano válido foi encontrado para o próximo intervalo.</p>
                )}
              </div>
            </div>
          )
        })}

        {noData.length === 0 && (
          <p className="text-gray-400 text-center py-12">Nenhum equipamento "Sem dados" encontrado.</p>
        )}
      </div>
    </div>
  )
}
