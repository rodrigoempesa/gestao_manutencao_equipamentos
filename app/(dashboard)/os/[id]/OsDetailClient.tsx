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
  ShoppingCart, Package, Plus, Trash2,
} from 'lucide-react'

const STATUS_COLORS = {
  aberta:     'bg-blue-100 text-blue-700 border-blue-200',
  iniciada:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  finalizada: 'bg-green-100 text-green-700 border-green-200',
  cancelada:  'bg-gray-100 text-gray-500 border-gray-200',
}

interface Product { id: string; code: string; name: string; unit: string; unit_price: number }
interface RequestItem {
  id: string; description: string; quantity: number; unit: string; unit_price: number
  product_id: string | null; products?: Product
}
interface PurchaseRequest {
  id: string; status: string; notes: string | null; created_at: string
  plan_id?: string | null
  maintenance_plans?: { id: string; name: string; interval_value: number } | null
  purchase_request_items?: RequestItem[]
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function requestTotal(req: PurchaseRequest): number {
  return (req.purchase_request_items ?? []).reduce((s, it) => s + it.quantity * it.unit_price, 0)
}

export default function OsDetailClient({
  os,
  profileMap,
  currentUserId,
  role,
  products,
  purchaseRequests,
  availableRequests,
}: {
  os: WorkOrder
  profileMap: Record<string, string>
  currentUserId: string
  role: string
  products: Product[]
  purchaseRequests: PurchaseRequest[]
  availableRequests: PurchaseRequest[]
}) {
  const router = useRouter()
  const eq = os.equipment as any
  const plan = os.maintenance_plans as any
  const trackingType = eq?.equipment_models?.tracking_type ?? 'hours'

  const isAdmin = role === 'admin_geral' || role === 'admin_local'
  const canEditMaterials = isAdmin && (os.status === 'aberta' || os.status === 'iniciada')

  // Materiais (solicitação de compra) vinculados à OS
  const activeRequests = purchaseRequests.filter(r => r.status !== 'cancelado')
  const materialItems = activeRequests.flatMap(r => r.purchase_request_items ?? [])
  const materialsTotal = materialItems.reduce((s, it) => s + it.quantity * it.unit_price, 0)

  // Modal de materiais
  interface DraftItem { _key: string; product_id: string; quantity: string }
  const newDraft = (): DraftItem => ({ _key: Math.random().toString(36).slice(2), product_id: '', quantity: '1' })
  const [showMaterials, setShowMaterials] = useState(false)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([newDraft()])
  const [materialNotes, setMaterialNotes] = useState('')
  const [materialSaving, setMaterialSaving] = useState(false)
  const [materialError, setMaterialError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Associar solicitação existente
  const [showAssociate, setShowAssociate] = useState(false)
  const [associatingId, setAssociatingId] = useState<string | null>(null)

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

    // Consome os materiais das solicitações vinculadas: cria os itens da
    // manutenção (o gatilho maintenance_record_item_stock baixa o estoque).
    // Só ocorre quando o registro de manutenção foi criado (perfis admin).
    if (maintenanceRecordId && materialItems.length > 0) {
      const itemPayloads = materialItems
        .filter(it => it.product_id)
        .map(it => ({
          record_id: maintenanceRecordId,
          product_id: it.product_id,
          description: it.description || it.products?.name || 'Material',
          quantity: it.quantity,
          unit: it.unit ?? 'un',
          unit_price: it.unit_price ?? 0,
        }))

      if (itemPayloads.length > 0) {
        const { error: itemsErr } = await supabase.from('maintenance_record_items').insert(itemPayloads)
        if (itemsErr) {
          // Desfaz o registro recém-criado para não deixar OS meio-finalizada
          await supabase.from('maintenance_records').delete().eq('id', maintenanceRecordId)
          setSaving(false)
          setError('Erro ao baixar os materiais do estoque. A OS não foi finalizada.')
          return
        }
      }
    }

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

    if (err) { setSaving(false); setError('Erro ao finalizar OS.'); return }

    // Marca as solicitações vinculadas como concluídas (estado terminal,
    // sem passar por 'aprovado' — não dispara entrada de estoque).
    const reqIds = activeRequests.filter(r => r.status === 'pendente').map(r => r.id)
    if (reqIds.length > 0) {
      await supabase.from('purchase_requests').update({ status: 'concluido' }).in('id', reqIds)
    }

    setSaving(false)
    setModal(null)
    router.refresh()
  }

  async function handleCreateMaterials() {
    const valid = draftItems.filter(d => d.product_id && parseFloat(d.quantity) > 0)
    if (valid.length === 0) { setMaterialError('Adicione pelo menos um produto com quantidade.'); return }

    setMaterialSaving(true); setMaterialError('')
    const supabase = createClient()

    const { data: req, error: reqErr } = await supabase
      .from('purchase_requests')
      .insert({
        equipment_id: os.equipment_id,
        plan_id: os.plan_id,
        work_order_id: os.id,
        notes: materialNotes.trim() || null,
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (reqErr || !req) { setMaterialSaving(false); setMaterialError('Erro ao criar a solicitação.'); return }

    const itemPayloads = valid.map(d => {
      const prod = products.find(p => p.id === d.product_id)!
      return {
        request_id: req.id,
        product_id: prod.id,
        description: prod.name,
        quantity: parseFloat(d.quantity),
        unit: prod.unit,
        unit_price: prod.unit_price,
      }
    })

    const { error: itemsErr } = await supabase.from('purchase_request_items').insert(itemPayloads)
    if (itemsErr) {
      await supabase.from('purchase_requests').delete().eq('id', req.id)
      setMaterialSaving(false); setMaterialError('Erro ao salvar os itens.'); return
    }

    setMaterialSaving(false)
    setShowMaterials(false)
    setDraftItems([newDraft()])
    setMaterialNotes('')
    router.refresh()
  }

  async function handleDeleteRequest(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    // Apenas desvincula da OS (não apaga a solicitação que foi criada à parte)
    await supabase.from('purchase_requests').update({ work_order_id: null }).eq('id', id)
    setDeletingId(null)
    router.refresh()
  }

  async function handleAssociate(id: string) {
    setAssociatingId(id)
    const supabase = createClient()
    await supabase.from('purchase_requests').update({ work_order_id: os.id }).eq('id', id)
    setAssociatingId(null)
    setShowAssociate(false)
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

      {/* Materiais / Solicitação de Compra */}
      {(canEditMaterials || activeRequests.length > 0) && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              Materiais
              {materialItems.length > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  ({materialItems.length} {materialItems.length === 1 ? 'item' : 'itens'})
                </span>
              )}
            </h2>
            {canEditMaterials && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAssociate(true)}
                  className="btn-secondary text-sm"
                >
                  <ShoppingCart className="w-4 h-4" /> Associar existente
                  {availableRequests.length > 0 && (
                    <span className="badge-blue ml-1">{availableRequests.length}</span>
                  )}
                </button>
                <button
                  onClick={() => { setShowMaterials(true); setDraftItems([newDraft()]); setMaterialNotes(''); setMaterialError('') }}
                  className="btn-primary text-sm"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
            )}
          </div>

          {activeRequests.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              Nenhum material vinculado a esta OS.
              {canEditMaterials && ' Clique em "Adicionar" para registrar a solicitação de compra de materiais.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeRequests.map(req => {
                const items = req.purchase_request_items ?? []
                return (
                  <div key={req.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-400">
                        Solicitação de {formatDate(req.created_at)}{req.notes ? ` · ${req.notes}` : ''}
                      </p>
                      {canEditMaterials && (
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          disabled={deletingId === req.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                          title="Remover desta OS"
                        >
                          {deletingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400">
                            <th className="text-left font-medium py-1">Produto</th>
                            <th className="text-right font-medium py-1 w-24">Qtd</th>
                            <th className="text-right font-medium py-1 w-28">Vlr Unit.</th>
                            <th className="text-right font-medium py-1 w-28">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(it => (
                            <tr key={it.id} className="border-t border-gray-50">
                              <td className="py-1.5 text-gray-700">
                                <span className="flex items-center gap-2">
                                  <Package className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                  {it.products?.name ?? it.description}
                                </span>
                              </td>
                              <td className="py-1.5 text-right font-mono whitespace-nowrap">
                                {it.quantity.toLocaleString('pt-BR')} {it.unit}
                              </td>
                              <td className="py-1.5 text-right font-mono text-gray-500">{formatBRL(it.unit_price)}</td>
                              <td className="py-1.5 text-right font-mono font-semibold">{formatBRL(it.quantity * it.unit_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {materialItems.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">
                {os.status === 'finalizada'
                  ? 'Materiais consumidos do estoque na finalização.'
                  : 'O estoque será baixado ao finalizar a OS.'}
              </span>
              <span className="text-sm font-semibold text-gray-900">Total: {formatBRL(materialsTotal)}</span>
            </div>
          )}
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

      {/* Modal: Materiais */}
      {showMaterials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-400" /> Adicionar Materiais — {os.number}
              </h2>
              <button onClick={() => setShowMaterials(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
              {products.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum produto ativo cadastrado. Cadastre produtos no estoque primeiro.</p>
              )}
              {draftItems.map((d, i) => {
                const prod = products.find(p => p.id === d.product_id)
                return (
                  <div key={d._key} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      {i === 0 && <label className="label">Produto</label>}
                      <select
                        className="input"
                        value={d.product_id}
                        onChange={e => setDraftItems(prev => prev.map(x => x._key === d._key ? { ...x, product_id: e.target.value } : x))}
                      >
                        <option value="">Selecione...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                      </select>
                    </div>
                    <div className="w-28">
                      {i === 0 && <label className="label">Qtd ({prod?.unit ?? 'un'})</label>}
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="input"
                        value={d.quantity}
                        onChange={e => setDraftItems(prev => prev.map(x => x._key === d._key ? { ...x, quantity: e.target.value } : x))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftItems(prev => prev.length > 1 ? prev.filter(x => x._key !== d._key) : prev)}
                      className="mb-1.5 p-2 text-gray-400 hover:text-red-600"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => setDraftItems(prev => [...prev, newDraft()])}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar produto
              </button>
              <div>
                <label className="label">Observações <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea className="input h-16 resize-none" value={materialNotes} onChange={e => setMaterialNotes(e.target.value)} />
              </div>
              {materialError && <p className="text-sm text-red-600">{materialError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowMaterials(false)} className="btn-secondary" disabled={materialSaving}>Cancelar</button>
              <button onClick={handleCreateMaterials} disabled={materialSaving || products.length === 0} className="btn-primary">
                {materialSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Associar solicitação existente */}
      {showAssociate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-gray-400" /> Associar Solicitação de Compra
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {eq?.code} — {eq?.name}
                  {os.type === 'preventive' && plan?.name ? ` · ${plan.name}` : ''}
                </p>
              </div>
              <button onClick={() => setShowAssociate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
              {availableRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Nenhuma solicitação de compra disponível para este equipamento
                  {os.type === 'preventive' ? ' e revisão' : ''}.
                  <br />
                  <span className="text-gray-400">
                    Só aparecem solicitações ainda não vinculadas a nenhuma OS.
                  </span>
                </p>
              ) : (
                availableRequests.map(req => {
                  const items = req.purchase_request_items ?? []
                  return (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {req.maintenance_plans?.name ?? 'Solicitação avulsa'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(req.created_at)}
                            {req.notes ? ` · ${req.notes}` : ''}
                            {` · ${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssociate(req.id)}
                          disabled={associatingId === req.id}
                          className="btn-primary text-sm flex-shrink-0"
                        >
                          {associatingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Associar
                        </button>
                      </div>
                      {items.length > 0 && (
                        <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                          {items.map(it => (
                            <li key={it.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{it.products?.name ?? it.description}</span>
                              <span className="font-mono whitespace-nowrap">
                                {it.quantity.toLocaleString('pt-BR')} {it.unit} · {formatBRL(it.quantity * it.unit_price)}
                              </span>
                            </li>
                          ))}
                          <li className="flex items-center justify-end pt-1 border-t border-gray-100 font-semibold text-gray-700">
                            Total: {formatBRL(requestTotal(req))}
                          </li>
                        </ul>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button onClick={() => setShowAssociate(false)} className="btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
