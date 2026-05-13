'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, MaintenancePlan } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import {
  ShoppingCart, Plus, X, Printer, ChevronDown, ChevronRight,
  Package, CheckCircle, XCircle, Clock, Truck, Paperclip,
  FileText, Eye, Upload, Loader2,
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
  invoice_path?: string | null
  final_amount?: number | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const didAutoOpen = useRef(false)

  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [planItemsMap, setPlanItemsMap] = useState<Record<string, PlanItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [printRequest, setPrintRequest] = useState<PurchaseRequest | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // signed URLs cache: requestId → url
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  // Products for avulsa items
  const [products, setProducts] = useState<Product[]>([])

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [selEquipment, setSelEquipment] = useState('')
  const [selPlan, setSelPlan] = useState('')
  const [notes, setNotes] = useState('')
  const [filteredPlans, setFilteredPlans] = useState<MaintenancePlan[]>([])
  // checked state for plan items (id → checked); undefined = checked by default
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  // avulsa items added manually
  interface AvulsaItem { _key: string; product_id: string; quantity: string }
  const [avulsaItems, setAvulsaItems] = useState<AvulsaItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Approval modal state
  const [showApproval, setShowApproval] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState<PurchaseRequest | null>(null)
  const [finalAmount, setFinalAmount] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: reqs }, { data: equips }, { data: allPlans }, { data: allPlanItems }, { data: prods }] = await Promise.all([
      supabase.from('purchase_requests')
        .select(`*, equipment:equipment_id(id,code,name,branches(name)), maintenance_plans:plan_id(id,name,interval_value,equipment_models(tracking_type)), purchase_request_items(*, products(id,code,name,unit,unit_price))`)
        .order('created_at', { ascending: false }),
      supabase.from('equipment').select('*, equipment_models(*, brands(*)), branches(*)').eq('active', true).order('code'),
      supabase.from('maintenance_plans').select('*, equipment_models(tracking_type)').order('interval_value'),
      supabase.from('maintenance_plan_items').select('*, products(id,code,name,unit,unit_price)').order('order_index'),
      supabase.from('products').select('id,code,name,unit,unit_price').eq('active', true).order('name'),
    ])
    setRequests((reqs as PurchaseRequest[]) ?? [])
    setEquipment((equips as Equipment[]) ?? [])
    setPlans((allPlans as MaintenancePlan[]) ?? [])
    setProducts((prods as Product[]) ?? [])
    const piMap: Record<string, PlanItem[]> = {}
    ;((allPlanItems as PlanItem[]) ?? []).forEach((i: any) => {
      if (!piMap[i.plan_id]) piMap[i.plan_id] = []
      piMap[i.plan_id].push(i)
    })
    setPlanItemsMap(piMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Auto-open create modal if ?plan= param is present (only once)
  useEffect(() => {
    if (didAutoOpen.current) return
    const planId = searchParams.get('plan')
    if (planId && plans.length > 0) {
      setSelPlan(planId)
      setShowCreate(true)
      didAutoOpen.current = true
    }
  }, [searchParams, plans])

  // Generate signed URLs for all concluded requests that have an invoice
  useEffect(() => {
    const concluded = requests.filter(r => r.status === 'concluido' && r.invoice_path)
    if (concluded.length === 0) return
    concluded.forEach(async (r) => {
      if (signedUrls[r.id] || !r.invoice_path) return
      const { data } = await supabase.storage.from('invoices').createSignedUrl(r.invoice_path, 3600)
      if (data?.signedUrl) {
        setSignedUrls(prev => ({ ...prev, [r.id]: data.signedUrl }))
      }
    })
  }, [requests]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEquipmentSelect(eqId: string) {
    setSelEquipment(eqId)
    setSelPlan('')
    setCheckedItems({})
    setAvulsaItems([])
    const eq = equipment.find(e => e.id === eqId)
    setFilteredPlans(eq ? plans.filter(p => p.model_id === eq.model_id) : [])
  }

  function handlePlanSelect(planId: string) {
    setSelPlan(planId)
    // Reset checked state so all new plan items default to checked
    setCheckedItems({})
  }

  const previewItems = selPlan
    ? (planItemsMap[selPlan] ?? []).filter(i => i.product_id && i.products)
    : []

  const selectedPlanItems = previewItems.filter(pi => checkedItems[pi.id] !== false)

  function addAvulsaItem() {
    setAvulsaItems(prev => [...prev, { _key: Math.random().toString(36).slice(2), product_id: '', quantity: '1' }])
  }

  function removeAvulsaItem(key: string) {
    setAvulsaItems(prev => prev.filter(i => i._key !== key))
  }

  function resetCreateModal() {
    setShowCreate(false)
    setSelEquipment(''); setSelPlan(''); setNotes('')
    setFilteredPlans([]); setCheckedItems({}); setAvulsaItems([])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selEquipment) { setError('Selecione o equipamento.'); return }

    const validAvulsa = avulsaItems.filter(i => i.product_id && parseFloat(i.quantity) > 0)
    if (selPlan && selectedPlanItems.length === 0 && validAvulsa.length === 0) {
      setError('Selecione pelo menos um item do plano ou adicione um produto avulso.'); return
    }
    if (!selPlan && validAvulsa.length === 0) {
      setError('Adicione pelo menos um produto à solicitação avulsa.'); return
    }

    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: req, error: reqErr } = await supabase
      .from('purchase_requests')
      .insert({ equipment_id: selEquipment, plan_id: selPlan || null, notes: notes.trim() || null, created_by: user?.id })
      .select().single()
    if (reqErr) { setError(reqErr.message); setSaving(false); return }

    const itemPayloads: any[] = [
      ...selectedPlanItems.map(pi => ({
        request_id: req.id,
        product_id: pi.product_id,
        plan_item_id: pi.id,
        description: pi.description || pi.products?.name || '',
        quantity: pi.quantity,
        unit: pi.products?.unit ?? 'un',
        unit_price: pi.products?.unit_price ?? 0,
      })),
      ...validAvulsa.map(ai => {
        const prod = products.find(p => p.id === ai.product_id)!
        return {
          request_id: req.id,
          product_id: ai.product_id,
          plan_item_id: null,
          description: prod.name,
          quantity: parseFloat(ai.quantity),
          unit: prod.unit,
          unit_price: prod.unit_price,
        }
      }),
    ]

    if (itemPayloads.length > 0) {
      const { error: itemErr } = await supabase.from('purchase_request_items').insert(itemPayloads)
      if (itemErr) { setError(itemErr.message); setSaving(false); return }
    }

    resetCreateModal(); loadData(); setSaving(false)
  }

  function openApproval(req: PurchaseRequest) {
    const estimated = requestTotal(req)
    setApprovalTarget(req)
    setFinalAmount(estimated > 0 ? estimated.toFixed(2).replace('.', ',') : '')
    setShowApproval(true)
  }

  async function confirmApproval() {
    if (!approvalTarget) return
    const raw = finalAmount.replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(raw)
    setSaving(true)
    await supabase.from('purchase_requests').update({
      status: 'aprovado',
      final_amount: isNaN(amount) ? null : amount,
    }).eq('id', approvalTarget.id)
    setShowApproval(false)
    setApprovalTarget(null)
    setSaving(false)
    loadData()
  }

  async function updateStatus(id: string, newStatus: string, req: PurchaseRequest) {
    if (newStatus === req.status) return
    if (req.status === 'concluido') return
    if (newStatus === 'aprovado') { openApproval(req); return }
    await supabase.from('purchase_requests').update({ status: newStatus }).eq('id', id)
    loadData()
  }

  function triggerUpload(reqId: string) {
    setUploadTargetId(reqId)
    setUploadError(null)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetId) return
    e.target.value = ''

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      setUploadError('Formato inválido. Use PDF, JPEG ou PNG.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. Máximo 10 MB.')
      return
    }

    setUploadingId(uploadTargetId)
    setUploadError(null)
    const ext = file.name.split('.').pop()
    const path = `${uploadTargetId}/nota_fiscal.${ext}`

    const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, { upsert: true })
    if (upErr) { setUploadError(upErr.message); setUploadingId(null); return }

    await supabase.from('purchase_requests').update({ invoice_path: path }).eq('id', uploadTargetId)

    // Refresh signed URL for this request
    const { data: signed } = await supabase.storage.from('invoices').createSignedUrl(path, 3600)
    if (signed?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [uploadTargetId]: signed.signedUrl }))
    }

    setUploadingId(null)
    setUploadTargetId(null)
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

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
          const isUploading = uploadingId === req.id
          const signedUrl = signedUrls[req.id]

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
                      {req.invoice_path && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <Paperclip className="w-3 h-3" /> NF anexada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{eq?.branches?.name}</span>
                      <span>·</span>
                      <span>{formatDate(req.created_at)}</span>
                      <span>·</span>
                      <span>{(req.purchase_request_items ?? []).length} item(ns)</span>
                      {total > 0 && <><span>·</span><span className="text-gray-500">Estimado: {formatBRL(total)}</span></>}
                      {req.final_amount != null && <><span>·</span><span className="text-green-700 font-semibold">Final: {formatBRL(req.final_amount)}</span></>}
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
                <div className="px-5 pb-5 border-t border-gray-100">
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
                    {(total > 0 || req.final_amount != null) && (
                      <tfoot>
                        {total > 0 && (
                          <tr className="border-t border-gray-100">
                            <td colSpan={5} className="pt-2 text-right text-xs font-semibold text-gray-500">Total estimado:</td>
                            <td className="pt-2 text-right font-semibold text-gray-500 font-mono">{formatBRL(total)}</td>
                          </tr>
                        )}
                        {req.final_amount != null && (
                          <tr className="border-t border-gray-200">
                            <td colSpan={5} className="pt-2 text-right text-xs font-semibold text-gray-700">Valor final da compra:</td>
                            <td className="pt-2 text-right font-bold text-green-700 font-mono">{formatBRL(req.final_amount)}</td>
                          </tr>
                        )}
                        {req.final_amount != null && total > 0 && (() => {
                          const diff = req.final_amount - total
                          if (diff === 0) return null
                          return (
                            <tr>
                              <td colSpan={5} className="pb-1 text-right text-xs text-gray-400">
                                {diff < 0 ? `Desconto: ${formatBRL(Math.abs(diff))}` : `Acréscimo: ${formatBRL(diff)}`}
                              </td>
                              <td className={`pb-1 text-right text-xs font-semibold font-mono ${diff < 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
                                ({diff < 0 ? '-' : '+'}{formatBRL(Math.abs(diff))})
                              </td>
                            </tr>
                          )
                        })()}
                      </tfoot>
                    )}
                  </table>

                  {/* Invoice attachment — only for concluded requests */}
                  {req.status === 'concluido' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Nota Fiscal
                      </p>

                      {uploadError && uploadTargetId === req.id && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{uploadError}</p>
                      )}

                      {req.invoice_path ? (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                          <Paperclip className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-800 truncate">
                              {req.invoice_path.split('/').pop()}
                            </p>
                            <p className="text-xs text-emerald-600">Nota fiscal anexada</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {signedUrl ? (
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary py-1 px-2 text-emerald-700"
                                title="Visualizar nota fiscal"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            ) : (
                              <button className="btn-secondary py-1 px-2 text-gray-400" disabled>
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </button>
                            )}
                            <button
                              className="btn-secondary py-1 px-2"
                              title="Substituir arquivo"
                              onClick={() => triggerUpload(req.id)}
                              disabled={isUploading}
                            >
                              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-2 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl px-4 py-3 text-sm text-gray-500 hover:text-blue-600 transition-colors w-full"
                          onClick={() => triggerUpload(req.id)}
                          disabled={isUploading}
                        >
                          {isUploading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                            : <><Paperclip className="w-4 h-4" /> Anexar nota fiscal (PDF, JPEG ou PNG — máx. 10 MB)</>
                          }
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-semibold text-lg">Nova Solicitação de Compra</h3>
              <button onClick={resetCreateModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
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
                  <label className="label">Plano de Manutenção <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <select className="input" value={selPlan} onChange={e => handlePlanSelect(e.target.value)}>
                    <option value="">— Solicitação avulsa (sem plano) —</option>
                    {filteredPlans.map(p => {
                      const unit = (p as any).equipment_models?.tracking_type === 'hours' ? 'h' : 'km'
                      return <option key={p.id} value={p.id}>{p.name} — {p.interval_value.toLocaleString('pt-BR')}{unit}</option>
                    })}
                  </select>
                  {filteredPlans.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Nenhum plano cadastrado para este modelo. Use a solicitação avulsa.</p>
                  )}
                </div>
              )}

              {/* Plan items with checkboxes */}
              {selPlan && (
                <div className="border border-blue-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-blue-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">
                        Itens do plano — {selectedPlanItems.length}/{previewItems.length} selecionados
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        const allChecked = previewItems.every(pi => checkedItems[pi.id] !== false)
                        const newState: Record<string, boolean> = {}
                        previewItems.forEach(pi => { newState[pi.id] = !allChecked })
                        setCheckedItems(newState)
                      }}
                    >
                      {previewItems.every(pi => checkedItems[pi.id] !== false) ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>
                  {previewItems.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-3">Este plano não possui produtos cadastrados.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {previewItems.map(pi => {
                        const isChecked = checkedItems[pi.id] !== false
                        return (
                          <label
                            key={pi.id}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => setCheckedItems(prev => ({ ...prev, [pi.id]: e.target.checked }))}
                              className="w-4 h-4 accent-blue-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-blue-700 font-semibold flex-shrink-0">{pi.products?.code}</span>
                                <span className="text-xs font-medium text-gray-800 truncate">{pi.description || pi.products?.name}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 text-xs text-gray-500">
                              <p className="font-mono">{pi.quantity} {pi.products?.unit}</p>
                              {(pi.products?.unit_price ?? 0) > 0 && <p>{formatBRL(pi.products!.unit_price)}</p>}
                            </div>
                          </label>
                        )
                      })}
                      {(() => {
                        const selTotal = selectedPlanItems.reduce((s, i) => s + i.quantity * (i.products?.unit_price ?? 0), 0)
                        return selTotal > 0 ? (
                          <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-t border-green-100">
                            <span className="text-xs font-semibold text-gray-600">Total estimado selecionado:</span>
                            <span className="font-bold text-green-700 font-mono text-xs">{formatBRL(selTotal)}</span>
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Avulsa items — always shown when equipment is selected */}
              {selEquipment && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">
                        {selPlan ? 'Produtos adicionais' : 'Produtos avulsos'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      onClick={addAvulsaItem}
                    >
                      <Plus className="w-3 h-3" /> Adicionar produto
                    </button>
                  </div>
                  {avulsaItems.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-3">Nenhum produto avulso adicionado.</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {avulsaItems.map(ai => {
                        const prod = products.find(p => p.id === ai.product_id)
                        return (
                          <div key={ai._key} className="flex items-center gap-2 px-4 py-2.5">
                            <select
                              className="input flex-1 text-xs py-1"
                              value={ai.product_id}
                              onChange={e => setAvulsaItems(prev => prev.map(x => x._key === ai._key ? { ...x, product_id: e.target.value } : x))}
                            >
                              <option value="">Selecione o produto...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="input w-20 text-xs py-1"
                              placeholder="Qtd"
                              min="0.01"
                              step="0.01"
                              value={ai.quantity}
                              onChange={e => setAvulsaItems(prev => prev.map(x => x._key === ai._key ? { ...x, quantity: e.target.value } : x))}
                            />
                            {prod && <span className="text-xs text-gray-400 w-8 flex-shrink-0">{prod.unit}</span>}
                            <button type="button" onClick={() => removeAvulsaItem(ai._key)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="label">Observações</label>
                <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Urgência, fornecedor preferido, etc." />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={resetCreateModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="text-center pb-4 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800">SOLICITAÇÃO DE COMPRA DE MATERIAL</h2>
                  <p className="text-sm text-gray-500 mt-1">Emitida em {formatDate(printRequest.created_at)}</p>
                </div>

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

      {/* ── Approval Modal ── */}
      {showApproval && approvalTarget && (() => {
        const estimated = requestTotal(approvalTarget)
        const raw = finalAmount.replace(/\./g, '').replace(',', '.')
        const final = parseFloat(raw)
        const diff = !isNaN(final) && estimated > 0 ? final - estimated : null
        const items = approvalTarget.purchase_request_items ?? []
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-lg">Confirmar Aprovação</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Informe o valor final — o estoque será atualizado automaticamente</p>
                </div>
                <button onClick={() => setShowApproval(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Items summary */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-100">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Itens que terão estoque atualizado</span>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-blue-700 font-semibold flex-shrink-0">{item.products?.code ?? '—'}</span>
                          <span className="text-gray-700 truncate">{item.description}</span>
                        </div>
                        <span className="font-mono text-xs text-gray-500 flex-shrink-0 ml-2">+{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                  {estimated > 0 && (
                    <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-between text-sm">
                      <span className="text-gray-500">Total estimado</span>
                      <span className="font-semibold font-mono text-gray-700">{formatBRL(estimated)}</span>
                    </div>
                  )}
                </div>

                {/* Final amount input */}
                <div>
                  <label className="label">Valor Final da Compra *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input
                      className="input pl-9 font-mono text-lg"
                      placeholder="0,00"
                      value={finalAmount}
                      onChange={e => setFinalAmount(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Informe o valor real pago. Você pode inserir um valor diferente do estimado para registrar desconto ou acréscimo.
                  </p>
                </div>

                {/* Diff indicator */}
                {diff !== null && diff !== 0 && (
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm border ${
                    diff < 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-orange-50 border-orange-200 text-orange-800'
                  }`}>
                    <span>{diff < 0 ? '🏷 Desconto aplicado' : '📈 Acréscimo'}</span>
                    <span className="font-bold font-mono">{diff < 0 ? '-' : '+'}{formatBRL(Math.abs(diff))}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t flex gap-3 justify-end flex-shrink-0 bg-gray-50">
                <button className="btn-secondary" onClick={() => setShowApproval(false)}>Cancelar</button>
                <button
                  className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                  onClick={confirmApproval}
                  disabled={saving}
                >
                  {saving ? 'Aprovando...' : 'Confirmar Aprovação'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
