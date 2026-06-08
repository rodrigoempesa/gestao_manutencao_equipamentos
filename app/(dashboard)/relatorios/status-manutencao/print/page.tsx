export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import PrintTrigger from '@/app/(dashboard)/os/[id]/print/PrintTrigger'

export default async function StatusManutencaoPrintPage({
  searchParams,
}: {
  searchParams: { incluirInativos?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const incluirInativos = searchParams.incluirInativos === '1'
  const isAdminGeral = profile.role === 'admin_geral'

  let query = supabase
    .from('vw_equipment_status')
    .select('id, code, name, active, branch_id, branch_name, tracking_type, current_reading, last_reading_date, last_maintenance_date, last_maintenance_plan_name, next_maintenance_plan_name, next_maintenance_threshold')
    .order('code')

  if (!incluirInativos) query = query.eq('active', true)
  if (!isAdminGeral && profile.branch_id) query = query.eq('branch_id', profile.branch_id)

  const { data: list = [] } = await query
  const rows = list ?? []

  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          body { background: white !important; }
          @page { size: A4 landscape; margin: 1.2cm; }
          .print-page { padding: 0 !important; max-width: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
        @media screen {
          .print-page { max-width: 1100px; margin: 0 auto; padding: 2rem; }
        }
      `}</style>

      <div className="print-page font-sans text-gray-900 text-sm">
        <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold">RELATÓRIO — STATUS DE MANUTENÇÃO</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gestão de Manutenção de Equipamentos</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Emitido em {generatedAt}</p>
            <p>{rows.length} equipamento{rows.length !== 1 ? 's' : ''}{incluirInativos ? ' (incluindo inativos)' : ' ativos'}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-300 px-2 py-1.5">Código</th>
              <th className="border border-gray-300 px-2 py-1.5">Equipamento</th>
              <th className="border border-gray-300 px-2 py-1.5">Filial</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Horímetro atual</th>
              <th className="border border-gray-300 px-2 py-1.5">Última revisão</th>
              <th className="border border-gray-300 px-2 py-1.5">Próxima manutenção</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-gray-300 px-2 py-6 text-center text-gray-400">
                  Nenhum equipamento.
                </td>
              </tr>
            )}
            {rows.map((eq: any) => (
              <tr key={eq.id} className={!eq.active ? 'text-gray-400' : ''}>
                <td className="border border-gray-300 px-2 py-1.5 font-mono font-bold whitespace-nowrap">{eq.code}</td>
                <td className="border border-gray-300 px-2 py-1.5">{eq.name}</td>
                <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{eq.branch_name ?? '-'}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono whitespace-nowrap">
                  {eq.current_reading != null ? (
                    <>
                      <div className="font-semibold">{formatReading(eq.current_reading, eq.tracking_type)}</div>
                      <div className="text-[10px] text-gray-500 font-sans">{formatDate(eq.last_reading_date)}</div>
                    </>
                  ) : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {eq.last_maintenance_plan_name ? (
                    <>
                      <div>{eq.last_maintenance_plan_name}</div>
                      <div className="text-[10px] text-gray-500">{formatDate(eq.last_maintenance_date)}</div>
                    </>
                  ) : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {eq.next_maintenance_plan_name ? (
                    <>
                      <div>{eq.next_maintenance_plan_name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">limite: {formatReading(eq.next_maintenance_threshold, eq.tracking_type)}</div>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
