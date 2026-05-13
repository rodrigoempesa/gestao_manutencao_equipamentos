'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, MaintenancePlan } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import {
  ShoppingCart, Plus, X, Printer, ChevronDown, ChevronRight,
  Package, CheckCircle, XCircle, Clock, Truck,
} from 'lucide-react'

interface Product { id: string; code: string; name: string; unit: string; unit_price: number }
interface PlanItem {
  id: string; plan_id: string; description: string
  product_id: string | null; quantity: number
  products?: Product
}

interface RequestItem {
  id: string; description: string; quantity: number; unit: string; unit_price: number
  product_id: string | null; products?: Product
}

interface PurchaseRequest {
  id: string; status: string; notes: string | null; created_at: string
  equipment?: any; maintenance_plans?: any
  purchase_request_items?: RequestItem[]
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente:  { label: 'Pendente',   badge: 'badge-yellow', icon: <Clock className="w-3 h-3" /> },
  aprovado:  { label: 'Aprovado',   badge: 'badge-blue',   icon: <CheckCircle className="w-3 h-3" /> },
  concluido: { label: 'Concluído',  badge: 'badge-green',  icon: <Truck className="w-3 h-3" /> },
  cancelado: { label: 'Cancelado',  badge: 'badge-gray',   icon: <XCircle className="w-3 h-3" /> },
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SolicitacoesPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [planItemsMap, setPlanItemsMap] = useState<Record<string, PlanItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [printRequest, setPrintRequest] = useState<PurchaseRequest | null>(null)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [selEquipment, setSelEquipment] = useState('')
  const [selPlan, setSelPlan] = useState('')
  const [notes, setNotes] = useState('')
  const [filteredPlans, setFilteredPlans] = useState<MaintenancePlan[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: reqs }, { data: equips }, { data: allPlans }, { data: allPlanItems }] = await Promise.all([
      supabase.from('purchase_requests')
        .select(`*, equipment:equipment_id(id,code,name,branches(name)), maintenance_plans:plan_id(id,name,interval_value,equipment_models(tracking_type)), purchase_request_items(*, products(id,code,name,unit,unit_price))`)
        .order('created_at', { ascending: false }),
      supabase.from('equipment').select('*, equipment_models(*, brands(*)), branches(*)').eq('active', true).order('code'),
      supabase.from('maintenance_plans').select('*, equipment_models(tracking_type)').order('interval_value'),
      supabase.from('maintenance_plan_items').select('*, products(id,code,name,unit,unit_price)').order('order_index'),
    ])
    setRequests((reqs as PurchaseRequest[]) ?? [])
    setEquipment((equips as Equipment[]) ?? [])
    setPlans((allPlans as MaintenancePlan[]) ?? [])
    const piMap: Record<string, PlanItem[]> = {}
    ;((allPlanItems as PlanItem[]) ?? []).forEach((i: any) => {
      if (!piMap[i.plan_id]) piMap[i.plan_id] = []
      piMap[i.plan_id].push(i)
    })
    setPlanItemsMap(piMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Auto-open create modal if ?plan= param is present
  useEffect(() => {
    const planId = searchParams.get('plan')
    if (planId && plans.length > 0) {
      setSelPlan(planId)
      setShowCreate(true)
    }
  }, [searchParams, plans])

  function handleEquipmentSelect(eqId: string) {
    setSelEquipment(eqId)
    setSelPlan('')
    const eq = equipment.find(e => e.id === eqId)
    setFilteredPlans(eq ? plans.filter(p => p.model_id === eq.model_id) : [])
  }

  // Preview items for selected plan (only those with a product)
  const previewItems = selPlan
    ? (planItemsMap[selPlan] ?? []).filter(i => i.product_id && i.products)
    : []

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selEquipment || !selPlan) { setError('Selecione o equipamento e o plano.'); return }
    if (previewItems.length === 0) { setError('Este plano não possui produtos cadastrados nos itens.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: req, error: reqErr } = await supabase
      .from('purchase_requests')
      .insert({ equipment_id: selEquipment, plan_id: selPlan, notes: notes.trim() || null, created_by: user?.id })
      .select().single()
    if (reqErr) { setError(reqErr.message); setSaving(false); return }
    const itemPayloads = previewItems.map(pi => ({
      request_id: req.id,
      product_id: pi.product_id,
      plan_item_id: pi.id,
      description: pi.description || pi.products?.name || '',
      quantity: pi.quantity,
      unit: pi.products?.unit ?? 'un',
      unit_price: pi.products?.unit_price ?? 0,
    }))
    const { error: itemErr } = await supabase.from('purchase_request_items').insert(itemPayloads)
    if (itemErr) { setError(itemErr.message); setSaving(false); return }
    setShowCreate(false); setSelEquipment(''); setSelPlan(''); setNotes(''); setFilteredPlans([])
    loadData(); setSaving(false)
  }

  async function updateStatus(id: string, newStatus: string, req: PurchaseRequest) {
    if (newStatus === req.status) return
    if (req.status === 'concluido') return // imutável após conclusão

    if (newStatus === 'aprovado') {
      const items = req.purchase_request_items ?? []
      const itemList = items.map(i => `• ${i.products?.code ?? '?'} — ${i.description}: ${i.quantity} ${i.unit}`).join('\n')
      const confirmed = confirm(
        `Aprovar esta solicitação irá atualizar o estoque dos seguintes produtos e marcar como Concluído:\n\n${itemList}\n\nDeseja continuar?`
      )
      if (!confirmed) return
    }

    await supabase.from('purchase_requests').update({ status: newStatus }).eq('id', id)
    loadData()
  }

  function requestTotal(req: PurchaseRequest) {
    return (req.purchase_request_items ?? []).reduce(
      (sum, i) => sum + i.quantity * i.unit_price, 0
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            Solicitações de Compra
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pedidos de material por plano de manutenção</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowCreate(true); setError('') }}>
          <Plus className="w-4 h-4" /> Nova Solicitação
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {requests.length === 0 && (
          <div className="card text-center py-16 text-gray-400">Nenhuma solicitação cadastrada</div>
        )}
        {requests.map(req => {
          const isOpen = expanded === req.id
          const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pendente
          const eq = req.equipment as any
          const plan = req.maintenance_plans as any
          const total = requestTotal(req)
          const trackingUnit = plan?.equipment_models?.tracking_type === 'hours' ? 'h' : 'km'

          return (
            <div key={req.id} className="card p-0 overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : req.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{eq?.code} — {eq?.name}</span>
                      <span className="text-gray-400 text-sm">·</span>
                      <span className="text-sm text-gray-600">{plan?.name} ({plan?.interval_value?.toLocaleString('pt-BR')}{trackingUnit})</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{eq?.branches?.name}</span>
                      <span>·</span>
                      <span>{formatDate(req.created_at)}</span>
                      <span>·</span>
                      <span>{(req.purchase_request_items ?? []).length} item(ns)</span>
                      {total > 0 && <><span>·</span><span className="text-green-700 font-semibold">{formatBRL(total)}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <span className={`${cfg.badge} flex items-center gap-1 text-xs`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  {req.status === 'concluido' ? (
                    <span className="text-xs text-gray-400 italic px-2">Estoque atualizado</span>
                  ) : req.status === 'cancelado' ? null : (
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
                      value={req.status}
                      onChange={e => updateStatus(req.id, e.target.value, req)}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aprovado">Aprovar (atualiza estoque)</option>
                      <option value="cancelado">Cancelar</option>
                    </select>
                  )}
                  <button
                    className="btn-secondary py-1 px-2"
                    title="Imprimir"
                    onClick={() => setPrintRequest(req)}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-4 border-t border-gray-100">
                  {req.notes && (
                    <p className="text-sm text-gray-500 italic mt-3 mb-2">{req.notes}</p>
                  )}
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2 text-xs font-semibold text-gray-500">#</th>
                        <th className="text-left pb-2 text-xs font-semibold text-gray-500">Ref.</th>
                        <th className="text-left pb-2 text-xs font-semibold text-gray-500">Descrição / Item</th>
                        <th className="text-right pb-2 text-xs font-semibold text-gray-500">Qtd</th>
                        <th className="text-right pb-2 text-xs font-semibold text-gray-500">Preço Unit.</th>
                        <th className="text-right pb-2 text-xs font-semibold text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(req.purchase_request_items ?? []).map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-2 text-gray-400">{idx + 1}</td>
                          <td className="py-2 font-mono text-xs text-blue-700 font-semibold">{item.products?.code ?? '—'}</td>
                          <td className="py-2">
                            <p className="font-medium">{item.description}</p>
                            {item.products?.name && item.products.name !== item.description && (
                              <p className="text-xs text-gray-400">{item.products.name}</p>
                            )}
                          </td>
                          <td className="py-2 text-right font-mono">{item.quantity} {item.unit}</td>
                          <td className="py-2 text-right font-mono text-gray-500">{item.unit_price > 0 ? formatBRL(item.unit_price) : '—'}</td>
                          <td className="py-2 text-right font-mono font-semibold text-green-700">
                            {item.unit_price > 0 ? formatBRL(item.quantity * item.unit_price) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {total > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-200">
                          <td colSpan={5} className="pt-2 text-right text-xs font-semibold text-gray-600">Total estimado:</td>
                          <td className="pt-2 text-right font-bold text-green-700 font-mono">{formatBRL(total)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">Nova Solicitação de Compra</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Equipamento *</label>
                <select className="input" value={selEquipment} onChange={e => handleEquipmentSelect(e.target.value)} required>
                  <option value="">Selecione o equipamento...</option>
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} — {eq.name} ({(eq as any).branches?.name ?? ''})
                    </option>
                  ))}
                </select>
              </div>

              {selEquipment && (
                <div>
                  <label className="label">Plano de Manutenção *</label>
                  {filteredPlans.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Nenhum plano cadastrado para o modelo deste equipamento.
                    </p>
                  ) : (
                    <select className="input" value={selPlan} onChange={e => setSelPlan(e.target.value)} required>
                      <option value="">Selecione o plano...</option>
                      {filteredPlans.map(p => {
                        const unit = (p as any).equipment_models?.tracking_type === 'hours' ? 'h' : 'km'
                        return <option key={p.id} value={p.id}>{p.name} — {p.interval_value.toLocaleString('pt-BR')}{unit}</option>
                      })}
                    </select>
                  )}
                </div>
              )}

              {/* Preview items */}
              {selPlan && (
                <div className="border border-blue-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-blue-50 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">
                      Itens do plano ({previewItems.length} produto(s))
                    </span>
                  </div>
                  {previewItems.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-3">Este plano não possui produtos cadastrados.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Ref.</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Item</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Qtd</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Preço Unit.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {previewItems.map(pi => (
                          <tr key={pi.id}>
                            <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{pi.products?.code}</td>
                            <td className="px-4 py-2">
                              <p className="font-medium text-xs">{pi.description || pi.products?.name}</p>
                              {pi.description && pi.products?.name !== pi.description && (
                                <p className="text-xs text-gray-400">{pi.products?.name}</p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">{pi.quantity} {pi.products?.unit}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                              {(pi.products?.unit_price ?? 0) > 0 ? formatBRL(pi.products!.unit_price) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {previewItems.reduce((s, i) => s + i.quantity * (i.products?.unit_price ?? 0), 0) > 0 && (
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-green-50">
                            <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Total estimado:</td>
                            <td className="px-4 py-2 text-right font-bold text-green-700 font-mono text-xs">
                              {formatBRL(previewItems.reduce((s, i) => s + i.quantity * (i.products?.unit_price ?? 0), 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
              )}

              <div>
                <label className="label">Observações</label>
                <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Urgência, fornecedor preferido, etc." />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving || previewItems.length === 0}>
                  {saving ? 'Salvando...' : 'Criar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printRequest && (() => {
        const eq = printRequest.equipment as any
        const plan = printRequest.maintenance_plans as any
        const trackingUnit = plan?.equipment_models?.tracking_type === 'hours' ? 'h' : 'km'
        const items = printRequest.purchase_request_items ?? []
        const total = requestTotal(printRequest)
        const cfg = STATUS_CONFIG[printRequest.status] ?? STATUS_CONFIG.pendente
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" id="print-area">
              {/* Print header */}
              <div className="flex items-center justify-between px-6 py-4 border-b print:hidden">
                <h3 className="font-semibold text-lg">Solicitação de Compra</h3>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button onClick={() => setPrintRequest(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="px-8 py-6 space-y-5">
                {/* Title */}
                <div className="text-center pb-4 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800">SOLICITAÇÃO DE COMPRA DE MATERIAL</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Emitida em {formatDate(printRequest.created_at)}
                  </p>
                </div>

                {/* Equipment + Plan info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-semibold">Equipamento</span>
                      <p className="font-semibold">{eq?.code} — {eq?.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-semibold">Filial</span>
                      <p>{eq?.branches?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-semibold">Plano de Manutenção</span>
                      <p className="font-semibold">{plan?.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase font-semibold">Intervalo</span>
                      <p>{plan?.interval_value?.toLocaleString('pt-BR')} {trackingUnit}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase font-semibold">Status</span>
                    <p className="font-medium">{cfg.label}</p>
                  </div>
                  {printRequest.notes && (
                    <div className="col-span-2">
                      <span className="text-gray-500 text-xs uppercase font-semibold">Observações</span>
                      <p className="italic text-gray-600">{printRequest.notes}</p>
                    </div>
                  )}
                </div>

                {/* Items table */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Itens Solicitados</h3>
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Ref.</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Descrição / Item</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Quantidade</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Preço Unit.</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 text-center text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs font-bold text-blue-700">{item.products?.code ?? '—'}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.description}</p>
                            {item.products?.name && item.products.name !== item.description && (
                              <p className="text-xs text-gray-400">{item.products.name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500 text-xs">{item.unit_price > 0 ? formatBRL(item.unit_price) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">{item.unit_price > 0 ? formatBRL(item.quantity * item.unit_price) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    {total > 0 && (
                      <tfoot>
                        <tr className="bg-green-50">
                          <td colSpan={5} className="px-3 py-2 text-right font-bold text-gray-700 text-sm">Total Estimado:</td>
                          <td className="px-3 py-2 text-right font-bold text-green-700 font-mono">{formatBRL(total)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Signature area */}
                <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8" />
                    <p className="text-xs text-gray-500">Solicitante</p>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8" />
                    <p className="text-xs text-gray-500">Aprovação</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
