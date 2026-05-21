export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { WorkOrder } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import PrintTrigger from './PrintTrigger'

export default async function OsPrintPage({ params }: { params: { id: string } }) {
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
        maintenance_plan_items(id, description, order_index)
      )
    `)
    .eq('id', params.id)
    .single() as { data: WorkOrder | null; error: any }

  if (error || !os) notFound()

  const eq = os.equipment as any
  const plan = os.maintenance_plans as any
  const trackingType = eq?.equipment_models?.tracking_type ?? 'hours'
  const planItems = (plan?.maintenance_plan_items ?? [])
    .slice()
    .sort((a: any, b: any) => a.order_index - b.order_index)

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          body { background: white !important; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 0 auto; padding: 2rem; }
        }
      `}</style>

      <div className="print-page font-sans text-gray-900">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold">ORDEM DE SERVIÇO</h1>
            <p className="text-sm text-gray-500 mt-1">Gestão de Manutenção de Equipamentos</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-blue-700">{os.number}</p>
            <p className="text-sm text-gray-500">{formatDate(os.opened_at)}</p>
            <span className={`inline-block mt-1 text-xs px-3 py-1 rounded-full font-semibold uppercase ${
              os.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {os.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
            </span>
          </div>
        </div>

        {/* Dados do equipamento */}
        <div className="mb-5">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide">Equipamento</h2>
          <div className="grid grid-cols-3 gap-3 text-sm border border-gray-200 rounded-lg p-4">
            <div>
              <p className="text-xs text-gray-400 uppercase">Código</p>
              <p className="font-bold text-lg">{eq?.code}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 uppercase">Nome</p>
              <p className="font-semibold">{eq?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Marca</p>
              <p>{eq?.equipment_models?.brands?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Modelo</p>
              <p>{eq?.equipment_models?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Filial</p>
              <p>{eq?.branches?.name} — {eq?.branches?.city}/{eq?.branches?.state}</p>
            </div>
            {eq?.serial_number && (
              <div>
                <p className="text-xs text-gray-400 uppercase">Nº de Série</p>
                <p className="font-mono">{eq.serial_number}</p>
              </div>
            )}
          </div>
        </div>

        {/* Plano / Descrição */}
        <div className="mb-5">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide">
            {os.type === 'preventive' ? 'Plano de Manutenção' : 'Descrição do Serviço'}
          </h2>
          <div className="border border-gray-200 rounded-lg p-4 text-sm">
            {os.type === 'preventive' ? (
              <p className="font-semibold">{plan?.name} — a cada {plan?.interval_value}h</p>
            ) : (
              <p>{os.description}</p>
            )}
            {os.notes && <p className="text-gray-500 mt-1 text-xs">{os.notes}</p>}
          </div>
        </div>

        {/* Itens do plano */}
        {planItems.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide">
              Itens a Verificar / Substituir ({planItems.length})
            </h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {planItems.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="w-5 h-5 border-2 border-gray-300 rounded flex-shrink-0" />
                  <span className="text-gray-400 w-6 flex-shrink-0">{i + 1}.</span>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campos de execução */}
        <div className="mb-5">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide">Execução</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="font-semibold text-gray-700">Início</p>
              <div>
                <p className="text-xs text-gray-400">Data / Hora</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px]">
                  {os.started_at ? formatDate(os.started_at) : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Horímetro ({trackingType === 'hours' ? 'h' : 'km'})</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px]">
                  {os.started_reading !== null ? formatReading(os.started_reading, trackingType) : ''}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="font-semibold text-gray-700">Conclusão</p>
              <div>
                <p className="text-xs text-gray-400">Data / Hora</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px]">
                  {os.finished_at ? formatDate(os.finished_at) : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Horímetro ({trackingType === 'hours' ? 'h' : 'km'})</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px]">
                  {os.finished_reading !== null ? formatReading(os.finished_reading, trackingType) : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-3 gap-6 mt-10">
          {['Técnico Responsável', 'Supervisor', 'Operador / Solicitante'].map(label => (
            <div key={label} className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12" />
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
