'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { WorkOrder } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Printer, CheckCircle, Play, XCircle,
  Loader2, X, Clock, Wrench, MapPin, Tag,
} from 'lucide-react'

const STATUS_COLORS = {
  aberta:     'bg-blue-100 text-blue-700 border-blue-200',
  iniciada:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  finalizada: 'bg-green-100 text-green-700 border-green-200',
  cancelada:  'bg-gray-100 text-gray-500 border-gray-200',
}

export default function OsDetailClient({
  os,
  profileMap,
  currentUserId,
}: {
  os: WorkOrder
  profileMap: Record<string, string>
  currentUserId: string
}) {
  const router = useRouter()
  const eq = os.equipment as any
  const plan = os.maintenance_plans as any
  const trackingType = eq?.equipment_models?.tracking_type ?? 'hours'

  // Modals
  const [modal, setModal] = useState<'start' | 'finish' | 'cancel' | null>(null)
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16))
  const [startedReading, setStartedReading] = useState('')
  const [finishedAt, setFinishedAt] = useState(new Date().toISOString().slice(0, 16))
  const [finishedReading, setFinishedReading] = useState('')
  const [modalNotes, setModalNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    if (!startedReading) { setError('Informe o horímetro.'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('work_orders')
      .update({
        status: 'iniciada',
        started_at: new Date(startedAt).toISOString(),
        started_reading: parseFloat(startedReading),
        started_by: currentUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', os.id)
    setSaving(false)
    if (err) { setError('Erro ao iniciar OS.'); return }
    setModal(null)
    router.refresh()
  }

  async function handleFinish() {
    if (!finishedReading) { setError('Informe o horímetro.'); return }
    setSaving(true); setError('')
    const supabase = createClient()

    const finishedDate = new Date(finishedAt)
    const reading = parseFloat(finishedReading)

    // Cria maintenance_record
    let maintenanceRecordId: string | null = null
    const { data: mr, error: mrErr } = await supabase
      .from('maintenance_records')
      .insert({
        equipment_id: os.equipment_id,
        plan_id: os.plan_id,
        reading_at_maintenance: reading,
        maintenance_date: finishedDate.toISOString().split('T')[0],
        notes: [os.notes, modalNotes].filter(Boolean).join(' | ') || null,
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (!mrErr && mr) maintenanceRecordId = mr.id

    const { error: err } = await supabase
      .from('work_orders')
      .update({
        status: 'finalizada',
        finished_at: finishedDate.toISOString(),
        finished_reading: reading,
        finished_by: currentUserId,
        maintenance_record_id: maintenanceRecordId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', os.id)

    setSaving(false)
    if (err) { setError('Erro ao finalizar OS.'); return }
    setModal(null)
    router.refresh()
  }

  async function handleCancel() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('work_orders')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', os.id)
    setSaving(false)
    setModal(null)
    router.refresh()
  }

  const planItems = (plan?.maintenance_plan_items ?? [])
    .slice()
    .sort((a: any, b: any) => a.order_index - b.order_index)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/os" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{os.number}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[os.status]}`}>
                {os.status.charAt(0).toUpperCase() + os.status.slice(1)}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                os.type === 'preventive' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
              }`}>
                {os.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Aberta em {formatDate(os.opened_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/os/${os.id}/print`}
            target="_blank"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Link>

          {os.status === 'aberta' && (
            <>
              <button
                onClick={() => { setModal('cancel'); setError('') }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Cancelar OS
              </button>
              <button
                onClick={() => { setModal('start'); setError(''); setStartedAt(new Date().toISOString().slice(0, 16)) }}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Play className="w-4 h-4" /> Iniciar OS
              </button>
            </>
          )}

          {os.status === 'iniciada' && (
            <button
              onClick={() => { setModal('finish'); setError(''); setFinishedAt(new Date().toISOString().slice(0, 16)) }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Finalizar OS
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equipamento */}
        <div className="card lg:col-span-2 space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-400" /> Equipamento
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Código</p>
              <p className="font-bold text-gray-900">{eq?.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Nome</p>
              <p className="font-semibold text-gray-900">{eq?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Marca / Modelo</p>
              <p className="text-gray-700">{eq?.equipment_models?.brands?.name} {eq?.equipment_models?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Filial</p>
              <p className="text-gray-700 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {eq?.branches?.name}
              </p>
            </div>
            {eq?.serial_number && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Número de Série</p>
                <p className="text-gray-700 font-mono">{eq.serial_number}</p>
              </div>
            )}
          </div>
        </div>

        {/* Plano / Descrição */}
        <div className="card space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            {os.type === 'preventive' ? 'Plano' : 'Problema'}
          </h2>
          {os.type === 'preventive' ? (
            <>
              <p className="font-semibold text-gray-900 text-sm">{plan?.name ?? '-'}</p>
              <p className="text-xs text-gray-500">A cada {plan?.interval_value}h</p>
            </>
          ) : (
            <p className="text-sm text-gray-700">{os.description}</p>
          )}
          {os.notes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Observações</p>
              <p className="text-sm text-gray-600">{os.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" /> Histórico
        </h2>
        <div className="space-y-4">
          {/* Abertura */}
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">OS Aberta</p>
              <p className="text-xs text-gray-500">{formatDate(os.opened_at)}</p>
              {os.opened_by && profileMap[os.opened_by] && (
                <p className="text-xs text-gray-400">por {profileMap[os.opened_by]}</p>
              )}
            </div>
          </div>

          {/* Início */}
          <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              os.started_at ? 'bg-yellow-100' : 'bg-gray-100'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${os.started_at ? 'bg-yellow-500' : 'bg-gray-300'}`} />
            </div>
            <div>
              <p className={`font-medium text-sm ${os.started_at ? 'text-gray-900' : 'text-gray-400'}`}>
                OS Iniciada
              </p>
              {os.started_at ? (
                <>
                  <p className="text-xs text-gray-500">{formatDate(os.started_at)}</p>
                  <p className="text-xs text-gray-500">
                    Horímetro: {formatReading(os.started_reading, trackingType)}
                  </p>
                  {os.started_by && profileMap[os.started_by] && (
                    <p className="text-xs text-gray-400">por {profileMap[os.started_by]}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">Aguardando início</p>
              )}
            </div>
          </div>

          {/* Finalização */}
          <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              os.finished_at ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${os.finished_at ? 'bg-green-600' : 'bg-gray-300'}`} />
            </div>
            <div>
              <p className={`font-medium text-sm ${os.finished_at ? 'text-gray-900' : 'text-gray-400'}`}>
                OS Finalizada
              </p>
              {os.finished_at ? (
                <>
                  <p className="text-xs text-gray-500">{formatDate(os.finished_at)}</p>
                  <p className="text-xs text-gray-500">
                    Horímetro: {formatReading(os.finished_reading, trackingType)}
                  </p>
                  {os.finished_by && profileMap[os.finished_by] && (
                    <p className="text-xs text-gray-400">por {profileMap[os.finished_by]}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">Aguardando finalização</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Itens do plano */}
      {os.type === 'preventive' && planItems.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="section-title">Itens do Plano ({planItems.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {planItems.map((item: any, i: number) => (
              <div key={item.id} className="px-6 py-3 flex items-center gap-4">
                <div className="w-6 h-6 rounded border-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
                  {os.status === 'finalizada' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                <p className="text-sm text-gray-700">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Iniciar */}
      {modal === 'start' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Iniciar OS — {os.number}</h2>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora de início</label>
                <input type="datetime-local" className="input w-full" value={startedAt} onChange={e => setStartedAt(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horímetro no início ({trackingType === 'hours' ? 'h' : 'km'})
                </label>
                <input type="number" min="0" step="0.1" className="input w-full" placeholder="Ex: 1.123"
                  value={startedReading} onChange={e => setStartedReading(e.target.value)} autoFocus />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary" disabled={saving}>Cancelar</button>
              <button onClick={handleStart} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Finalizar */}
      {modal === 'finish' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Finalizar OS — {os.number}</h2>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora de finalização</label>
                <input type="datetime-local" className="input w-full" value={finishedAt} onChange={e => setFinishedAt(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horímetro na finalização ({trackingType === 'hours' ? 'h' : 'km'})
                </label>
                <input type="number" min="0" step="0.1" className="input w-full" placeholder="Ex: 1.125"
                  value={finishedReading} onChange={e => setFinishedReading(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações finais <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea className="input w-full h-16 resize-none" value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)} placeholder="Ex: peças trocadas, observações técnicas..." />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary" disabled={saving}>Cancelar</button>
              <button onClick={handleFinish} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar */}
      {modal === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5 text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h2 className="font-semibold text-gray-900">Cancelar OS?</h2>
              <p className="text-sm text-gray-500">A OS {os.number} será cancelada. Esta ação não pode ser desfeita.</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary" disabled={saving}>Voltar</button>
              <button onClick={handleCancel} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Cancelar OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
