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
          @page { size: A4 portrait; margin: 0.8cm; }
          .print-page { padding: 0 !important; max-width: none !important; font-size: 10pt; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 0 auto; padding: 2rem; }
        }
      `}</style>

      <div className="print-page font-sans text-gray-900">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-800 print:mb-3 print:pb-2 avoid-break">
          <div>
            <h1 className="text-2xl font-bold print:text-lg">ORDEM DE SERVIÇO</h1>
            <p className="text-sm text-gray-500 mt-1 print:text-[10px] print:mt-0">Gestão de Manutenção de Equipamentos</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-blue-700 print:text-xl">{os.number}</p>
            <p className="text-sm text-gray-500 print:text-[10px]">{formatDate(os.opened_at)}</p>
            <span className={`inline-block mt-1 text-xs px-3 py-1 rounded-full font-semibold uppercase print:mt-0.5 print:px-2 print:py-0 print:text-[9px] ${
              os.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {os.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
            </span>
          </div>
        </div>

        {/* Dados do equipamento */}
        <div className="mb-5 print:mb-2 avoid-break">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide print:text-[10px] print:mb-1">Equipamento</h2>
          <div className="grid grid-cols-3 gap-3 text-sm border border-gray-200 rounded-lg p-4 print:gap-1 print:p-2 print:text-xs">
            <div>
              <p className="text-xs text-gray-400 uppercase print:text-[8px]">Código</p>
              <p className="font-bold text-lg print:text-sm">{eq?.code}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 uppercase print:text-[8px]">Nome</p>
              <p className="font-semibold">{eq?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase print:text-[8px]">Marca</p>
              <p>{eq?.equipment_models?.brands?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase print:text-[8px]">Modelo</p>
              <p>{eq?.equipment_models?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase print:text-[8px]">Filial</p>
              <p>{eq?.branches?.name} — {eq?.branches?.city}/{eq?.branches?.state}</p>
            </div>
            {eq?.serial_number && (
              <div>
                <p className="text-xs text-gray-400 uppercase print:text-[8px]">Nº de Série</p>
                <p className="font-mono">{eq.serial_number}</p>
              </div>
            )}
          </div>
        </div>

        {/* Plano / Descrição */}
        <div className="mb-5 print:mb-2 avoid-break">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide print:text-[10px] print:mb-1">
            {os.type === 'preventive' ? 'Plano de Manutenção' : 'Descrição do Serviço'}
          </h2>
          <div className="border border-gray-200 rounded-lg p-4 text-sm print:p-2 print:text-xs">
            {os.type === 'preventive' ? (
              <p className="font-semibold">{plan?.name} — a cada {plan?.interval_value}h</p>
            ) : (
              <p>{os.description}</p>
            )}
            {os.notes && <p className="text-gray-500 mt-1 text-xs print:text-[10px]">{os.notes}</p>}
          </div>
        </div>

        {/* Itens do plano */}
        {planItems.length > 0 && (
          <div className="mb-5 print:mb-2">
            <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide print:text-[10px] print:mb-1">
              Itens a Verificar / Substituir ({planItems.length})
            </h2>
            <div className={`border border-gray-200 rounded-lg overflow-hidden ${planItems.length > 8 ? 'print:grid print:grid-cols-2' : ''}`}>
              {planItems.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm print:px-2 print:py-1 print:text-[10px] print:gap-2 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="w-5 h-5 border-2 border-gray-300 rounded flex-shrink-0 print:w-3 print:h-3 print:border" />
                  <span className="text-gray-400 w-6 flex-shrink-0 print:w-4">{i + 1}.</span>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campos de execução */}
        <div className="mb-5 print:mb-2 avoid-break">
          <h2 className="text-sm font-bold uppercase text-gray-500 mb-2 tracking-wide print:text-[10px] print:mb-1">Execução</h2>
          <div className="grid grid-cols-2 gap-3 text-sm print:gap-2 print:text-xs">
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 print:p-2 print:space-y-1">
              <p className="font-semibold text-gray-700">Início</p>
              <div>
                <p className="text-xs text-gray-400 print:text-[9px]">Data / Hora</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px] print:min-h-[16px] print:pb-0">
                  {os.started_at ? formatDate(os.started_at) : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 print:text-[9px]">Horímetro ({trackingType === 'hours' ? 'h' : 'km'})</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px] print:min-h-[16px] print:pb-0">
                  {os.started_reading !== null ? formatReading(os.started_reading, trackingType) : ''}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 print:p-2 print:space-y-1">
              <p className="font-semibold text-gray-700">Conclusão</p>
              <div>
                <p className="text-xs text-gray-400 print:text-[9px]">Data / Hora</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px] print:min-h-[16px] print:pb-0">
                  {os.finished_at ? formatDate(os.finished_at) : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 print:text-[9px]">Horímetro ({trackingType === 'hours' ? 'h' : 'km'})</p>
                <p className="border-b border-gray-300 pb-1 min-h-[24px] print:min-h-[16px] print:pb-0">
                  {os.finished_reading !== null ? formatReading(os.finished_reading, trackingType) : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-3 gap-6 mt-10 print:mt-4 print:gap-3 avoid-break">
          {['Técnico Responsável', 'Supervisor', 'Operador / Solicitante'].map(label => (
            <div key={label} className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12 print:h-6 print:mb-1" />
              <p className="text-xs text-gray-500 print:text-[9px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
