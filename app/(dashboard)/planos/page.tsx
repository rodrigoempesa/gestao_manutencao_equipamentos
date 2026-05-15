'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Brand, EquipmentModel, MaintenancePlan, MaintenancePlanItem } from '@/lib/types'
import { trackingLabel } from '@/lib/utils'
import { BookOpen, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Package, Hammer, ShoppingCart, Search, ListChecks } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Product { id: string; code: string; name: string; unit: string; unit_price: number }
interface Service { id: string; name: string; unit: string; unit_price: number }

interface PlanItem extends MaintenancePlanItem {
  product_id: string | null
  service_id: string | null
  quantity: number
  products?: Product
  services?: Service
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PlanosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<EquipmentModel[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [planItems, setPlanItems] = useState<Record<string, PlanItem[]>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  const [showBrandModal, setShowBrandModal] = useState(false)
  const [brandForm, setBrandForm] = useState({ id: '', name: '' })

  const [showModelModal, setShowModelModal] = useState(false)
  const [modelForm, setModelForm] = useState({ id: '', brand_id: '', name: '', tracking_type: 'hours' })

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [planForm, setPlanForm] = useState({ id: '', model_id: '', interval_value: '', name: '', description: '' })

  // Single-item edit (pencil button on existing items)
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState({
    id: '', plan_id: '',
    product_id: '', quantity: '1',
    service_id: '',
    description: '', order_index: '0',
  })

  // Batch items modal
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [itemsModalPlan, setItemsModalPlan] = useState<MaintenancePlan | null>(null)
  const [itemsSearch, setItemsSearch] = useState('')
  interface DraftItem { checked: boolean; quantity: string; service_id: string; existing_id?: string }
  const [draftItems, setDraftItems] = useState<Record<string, DraftItem>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: m }, { data: p }, { data: items }, { data: prods }, { data: svcs }] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('equipment_models').select('*, brands(*)').order('name'),
      supabase.from('maintenance_plans').select('*').order('interval_value'),
      supabase.from('maintenance_plan_items').select('*, products(id,code,name,unit,unit_price), services(id,name,unit,unit_price)').order('order_index'),
      supabase.from('products').select('id,code,name,unit,unit_price').eq('active', true).order('name'),
      supabase.from('services').select('id,name,unit,unit_price').eq('active', true).order('name'),
    ])
    setBrands(((b as Brand[]) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    const sortedModels = ((m as EquipmentModel[]) ?? []).sort((a, b) => {
      const brandA = (a as any).brands?.name ?? ''
      const brandB = (b as any).brands?.name ?? ''
      const brandCmp = brandA.localeCompare(brandB, 'pt-BR')
      return brandCmp !== 0 ? brandCmp : a.name.localeCompare(b.name, 'pt-BR')
    })
    setModels(sortedModels)
    setPlans((p as MaintenancePlan[]) ?? [])
    setProducts((prods as Product[]) ?? [])
    setServices((svcs as Service[]) ?? [])
    const itemMap: Record<string, PlanItem[]> = {}
    ;((items as PlanItem[]) ?? []).forEach(i => {
      if (!itemMap[i.plan_id]) itemMap[i.plan_id] = []
      itemMap[i.plan_id].push(i)
    })
    setPlanItems(itemMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // --- CRUD helpers ---
  async function saveBrand(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const { error: err } = brandForm.id
      ? await supabase.from('brands').update({ name: brandForm.name.trim() }).eq('id', brandForm.id)
      : await supabase.from('brands').insert({ name: brandForm.name.trim() })
    if (err) { setError(err.message); setSaving(false); return }
    setShowBrandModal(false); loadData(); setSaving(false)
  }

  async function deleteBrand(id: string) {
    if (!confirm('Excluir esta marca?')) return
    const { error: err } = await supabase.from('brands').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  async function saveModel(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { brand_id: modelForm.brand_id, name: modelForm.name.trim(), tracking_type: modelForm.tracking_type }
    const { error: err } = modelForm.id
      ? await supabase.from('equipment_models').update(payload).eq('id', modelForm.id)
      : await supabase.from('equipment_models').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowModelModal(false); loadData(); setSaving(false)
  }

  async function deleteModel(id: string) {
    if (!confirm('Excluir este modelo?')) return
    const { error: err } = await supabase.from('equipment_models').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      model_id: planForm.model_id,
      interval_value: parseInt(planForm.interval_value),
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
    }
    const { error: err } = planForm.id
      ? await supabase.from('maintenance_plans').update(payload).eq('id', planForm.id)
      : await supabase.from('maintenance_plans').insert(payload)
    if (err) {
      setError(err.message.includes('unique') ? 'Já existe plano com esse intervalo.' : err.message)
      setSaving(false); return
    }
    setShowPlanModal(false); loadData(); setSaving(false)
  }

  async function deletePlan(id: string) {
    if (!confirm('Excluir este plano?')) return
    const { error: err } = await supabase.from('maintenance_plans').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const selectedProduct = products.find(p => p.id === itemForm.product_id)
    const selectedService = services.find(s => s.id === itemForm.service_id)
    // auto-fill description if empty
    const autoDesc = [selectedProduct?.name, selectedService?.name].filter(Boolean).join(' + ')
    const payload = {
      plan_id: itemForm.plan_id,
      description: itemForm.description.trim() || autoDesc || '',
      order_index: parseInt(itemForm.order_index) || 0,
      product_id: itemForm.product_id || null,
      quantity: parseFloat(itemForm.quantity) || 1,
      service_id: itemForm.service_id || null,
    }
    const { error: err } = itemForm.id
      ? await supabase.from('maintenance_plan_items').update(payload).eq('id', itemForm.id)
      : await supabase.from('maintenance_plan_items').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowItemModal(false); loadData(); setSaving(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('Excluir este item?')) return
    await supabase.from('maintenance_plan_items').delete().eq('id', id)
    loadData()
  }

  function openItemsModal(plan: MaintenancePlan) {
    const existing = planItems[plan.id] ?? []
    const draft: Record<string, DraftItem> = {}
    products.forEach(p => { draft[p.id] = { checked: false, quantity: '1', service_id: '' } })
    existing.forEach(item => {
      if (item.product_id) {
        draft[item.product_id] = {
          checked: true,
          quantity: String(item.quantity),
          service_id: item.service_id ?? '',
          existing_id: item.id,
        }
      }
    })
    setDraftItems(draft)
    setItemsModalPlan(plan)
    setItemsSearch('')
    setError('')
    setShowItemsModal(true)
  }

  async function saveItemsBatch() {
    if (!itemsModalPlan) return
    setSaving(true); setError('')
    const existing = planItems[itemsModalPlan.id] ?? []

    const toDelete = existing
      .filter(item => item.product_id && !draftItems[item.product_id]?.checked)
      .map(item => item.id)

    const toInsert = Object.entries(draftItems)
      .filter(([, d]) => d.checked && !d.existing_id)
      .map(([productId, d], idx) => {
        const prod = products.find(p => p.id === productId)!
        const svc = services.find(s => s.id === d.service_id)
        return {
          plan_id: itemsModalPlan!.id,
          product_id: productId,
          quantity: parseFloat(d.quantity) || 1,
          service_id: d.service_id || null,
          description: [prod.name, svc?.name].filter(Boolean).join(' + '),
          order_index: existing.length + idx,
        }
      })

    const toUpdate = Object.entries(draftItems)
      .filter(([, d]) => d.checked && d.existing_id)
      .map(([productId, d]) => {
        const prod = products.find(p => p.id === productId)!
        const svc = services.find(s => s.id === d.service_id)
        return {
          id: d.existing_id!,
          quantity: parseFloat(d.quantity) || 1,
          service_id: d.service_id || null,
          description: [prod.name, svc?.name].filter(Boolean).join(' + '),
        }
      })

    const ops: Promise<any>[] = []
    if (toDelete.length) ops.push(supabase.from('maintenance_plan_items').delete().in('id', toDelete))
    if (toInsert.length) ops.push(supabase.from('maintenance_plan_items').insert(toInsert))
    for (const { id, ...data } of toUpdate) {
      ops.push(supabase.from('maintenance_plan_items').update(data).eq('id', id))
    }
    const results = await Promise.all(ops)
    const firstErr = results.find(r => r?.error)?.error
    if (firstErr) { setError(firstErr.message); setSaving(false); return }
    setShowItemsModal(false); setSaving(false); loadData()
  }

  // Item cost = product cost + service cost (both per unit, service is per "execução")
  function itemCost(item: PlanItem) {
    const matCost = (item.products?.unit_price ?? 0) * item.quantity
    const svcCost = item.services?.unit_price ?? 0
    return matCost + svcCost
  }

  function planCost(planId: string) {
    return (planItems[planId] ?? []).reduce((sum, item) => sum + itemCost(item), 0)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Planos de Manutenção
        </h1>
        <p className="text-gray-500 text-sm mt-1">Cada item define produto + quantidade + serviço associado</p>
      </div>

      {/* Brands */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Marcas</h2>
          <button className="btn-primary" onClick={() => { setBrandForm({ id: '', name: '' }); setError(''); setShowBrandModal(true) }}>
            <Plus className="w-4 h-4" /> Nova Marca
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {brands.map(b => (
            <div key={b.id} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-sm font-medium">{b.name}</span>
              <button className="text-gray-400 hover:text-blue-600" onClick={() => { setBrandForm({ id: b.id, name: b.name }); setError(''); setShowBrandModal(true) }}><Pencil className="w-3 h-3" /></button>
              <button className="text-gray-400 hover:text-red-600" onClick={() => deleteBrand(b.id)}><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          {brands.length === 0 && <p className="text-gray-400 text-sm">Nenhuma marca cadastrada</p>}
        </div>
      </div>

      {/* Models + Plans */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="section-title">Modelos e Planos</h2>
          <button className="btn-primary" onClick={() => { setModelForm({ id: '', brand_id: '', name: '', tracking_type: 'hours' }); setError(''); setShowModelModal(true) }}>
            <Plus className="w-4 h-4" /> Novo Modelo
          </button>
        </div>

        {models.length === 0 && <p className="text-gray-400 text-sm text-center py-12">Nenhum modelo cadastrado</p>}

        {models.map(model => {
          const modelPlans = plans.filter(p => p.model_id === model.id).sort((a, b) => a.interval_value - b.interval_value)
          const isExpanded = expandedModel === model.id
          return (
            <div key={model.id} className="border-b border-gray-100 last:border-0">
              <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedModel(isExpanded ? null : model.id)}>
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{(model as any).brands?.name}</span>
                      <span className="text-gray-400">–</span>
                      <span className="font-medium">{model.name}</span>
                      <span className="badge-blue">{trackingLabel(model.tracking_type)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{modelPlans.length} plano(s)</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button className="btn-secondary py-1 px-2" onClick={() => { setModelForm({ id: model.id, brand_id: model.brand_id, name: model.name, tracking_type: model.tracking_type }); setError(''); setShowModelModal(true) }}><Pencil className="w-4 h-4" /></button>
                  <button className="btn-secondary py-1 px-2 text-red-500" onClick={() => deleteModel(model.id)}><Trash2 className="w-4 h-4" /></button>
                  <button className="btn-primary py-1 px-2" onClick={() => { setPlanForm({ id: '', model_id: model.id, interval_value: '', name: '', description: '' }); setError(''); setShowPlanModal(true) }}>
                    <Plus className="w-4 h-4" /> Plano
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="pl-12 pr-6 pb-4 space-y-3">
                  {modelPlans.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">Clique em "+ Plano" para adicionar.</p>}
                  {modelPlans.map(plan => {
                    const isPlanExpanded = expandedPlan === plan.id
                    const items = planItems[plan.id] ?? []
                    const cost = planCost(plan.id)
                    return (
                      <div key={plan.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer" onClick={() => setExpandedPlan(isPlanExpanded ? null : plan.id)}>
                          <div className="flex items-center gap-3">
                            {isPlanExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            <div>
                              <p className="font-semibold text-sm">{plan.name}</p>
                              <p className="text-xs text-gray-400">
                                A cada {plan.interval_value.toLocaleString('pt-BR')} {model.tracking_type === 'hours' ? 'h' : 'km'}
                                {' · '}{items.length} item(ns)
                                {cost > 0 && <> · <span className="text-green-700 font-medium">Custo previsto: {formatBRL(cost)}</span></>}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <button className="btn-secondary py-1 px-2" onClick={() => { setPlanForm({ id: plan.id, model_id: plan.model_id, interval_value: String(plan.interval_value), name: plan.name, description: plan.description ?? '' }); setError(''); setShowPlanModal(true) }}><Pencil className="w-3 h-3" /></button>
                            <button className="btn-secondary py-1 px-2 text-red-500" onClick={() => deletePlan(plan.id)}><Trash2 className="w-3 h-3" /></button>
                            <button className="btn-secondary py-1 px-2 text-blue-600" onClick={() => openItemsModal(plan)}>
                              <ListChecks className="w-3 h-3" /> Itens
                            </button>
                            <button
                              className="btn-secondary py-1 px-2 text-green-600"
                              title="Solicitar compra dos materiais deste plano"
                              onClick={() => router.push(`/solicitacoes?plan=${plan.id}`)}
                            >
                              <ShoppingCart className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {isPlanExpanded && (
                          <div className="px-4 py-3">
                            {plan.description && <p className="text-sm text-gray-500 mb-3">{plan.description}</p>}
                            {items.length === 0 ? (
                              <p className="text-gray-400 text-sm text-center py-4">Clique em "+ Item" para adicionar.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-6">#</th>
                                    <th className="text-left pb-2 text-xs font-semibold text-gray-500">Descrição</th>
                                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-40">
                                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Produto</span>
                                    </th>
                                    <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-16">Qtd</th>
                                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-36">
                                      <span className="flex items-center gap-1"><Hammer className="w-3 h-3" /> Serviço</span>
                                    </th>
                                    <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-28">Custo prev.</th>
                                    <th className="w-16"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {items.map((item, idx) => (
                                    <tr key={item.id} className="group">
                                      <td className="py-2 text-gray-400">{idx + 1}</td>
                                      <td className="py-2 pr-4">
                                        <p className="text-sm">{item.description}</p>
                                      </td>
                                      <td className="py-2">
                                        {item.products ? (
                                          <div>
                                            <p className="text-xs font-medium text-blue-700">{item.products.code}</p>
                                            <p className="text-xs text-gray-400 leading-tight">{item.products.name}</p>
                                          </div>
                                        ) : <span className="text-gray-300 text-xs">—</span>}
                                      </td>
                                      <td className="py-2">
                                        {item.services ? (
                                          <span className="text-xs text-purple-700 font-medium">{item.services.name}</span>
                                        ) : <span className="text-gray-300 text-xs">—</span>}
                                      </td>
                                      <td className="py-2 text-right font-mono font-semibold text-green-700">
                                        {itemCost(item) > 0 ? formatBRL(itemCost(item)) : '—'}
                                      </td>
                                      <td className="py-2">
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                                          <button className="text-gray-400 hover:text-blue-600" onClick={() => { setItemForm({ id: item.id, plan_id: item.plan_id, product_id: item.product_id ?? '', quantity: String(item.quantity), service_id: item.service_id ?? '', description: item.description, order_index: String(item.order_index) }); setError(''); setShowItemModal(true) }}><Pencil className="w-3.5 h-3.5" /></button>
                                          <button className="text-gray-400 hover:text-red-600" onClick={() => deleteItem(item.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                {cost > 0 && (
                                  <tfoot>
                                    <tr className="border-t border-gray-200">
                                      <td colSpan={5} className="pt-2 text-right text-xs font-semibold text-gray-600">Custo total previsto:</td>
                                      <td className="pt-2 text-right font-bold text-green-700 font-mono">{formatBRL(cost)}</td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">{brandForm.id ? 'Editar' : 'Nova'} Marca</h3>
              <button onClick={() => setShowBrandModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveBrand} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={brandForm.name} onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: John Deere" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowBrandModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">{modelForm.id ? 'Editar' : 'Novo'} Modelo</h3>
              <button onClick={() => setShowModelModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveModel} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Marca *</label>
                <select className="input" value={modelForm.brand_id} onChange={e => setModelForm(f => ({ ...f, brand_id: e.target.value }))} required>
                  <option value="">Selecione...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nome do Modelo *</label>
                <input className="input" value={modelForm.name} onChange={e => setModelForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: 750J" />
              </div>
              <div>
                <label className="label">Tipo de Medição *</label>
                <select className="input" value={modelForm.tracking_type} onChange={e => setModelForm(f => ({ ...f, tracking_type: e.target.value }))}>
                  <option value="hours">Horímetro (horas)</option>
                  <option value="km">Odômetro (km)</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowModelModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">{planForm.id ? 'Editar' : 'Novo'} Plano</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={savePlan} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Intervalo *</label>
                <input type="number" min={1} className="input font-mono" value={planForm.interval_value} onChange={e => setPlanForm(f => ({ ...f, interval_value: e.target.value }))} required placeholder="Ex: 500" />
              </div>
              <div>
                <label className="label">Nome do Plano *</label>
                <input className="input" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Revisão 500h" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea className="input" rows={2} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowPlanModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal — produto + quantidade + serviço juntos */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-semibold">{itemForm.id ? 'Editar' : 'Novo'} Item do Plano</h3>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveItem} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

              {/* Produto */}
              <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-1">
                  <Package className="w-4 h-4" /> Produto utilizado
                </p>
                <div>
                  <label className="label">Produto</label>
                  <select
                    className="input"
                    value={itemForm.product_id}
                    onChange={e => {
                      const prod = products.find(p => p.id === e.target.value)
                      setItemForm(f => ({
                        ...f,
                        product_id: e.target.value,
                        description: f.description || prod?.name || '',
                      }))
                    }}
                  >
                    <option value="">Sem produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} – {p.name} ({p.unit}) — {formatBRL(p.unit_price)}/{p.unit}
                      </option>
                    ))}
                  </select>
                </div>
                {itemForm.product_id && (
                  <div>
                    <label className="label">Quantidade</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" step="0.001" min={0.001}
                        className="input font-mono w-32"
                        value={itemForm.quantity}
                        onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                      />
                      <span className="text-sm text-gray-500">
                        {products.find(p => p.id === itemForm.product_id)?.unit}
                      </span>
                      {(() => {
                        const prod = products.find(p => p.id === itemForm.product_id)
                        const qty = parseFloat(itemForm.quantity) || 0
                        const subtotal = (prod?.unit_price ?? 0) * qty
                        return subtotal > 0
                          ? <span className="text-xs text-green-700 font-semibold ml-2">= {formatBRL(subtotal)}</span>
                          : null
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Serviço */}
              <div className="border border-purple-100 rounded-xl p-4 space-y-3 bg-purple-50">
                <p className="text-sm font-semibold text-purple-800 flex items-center gap-1">
                  <Hammer className="w-4 h-4" /> Serviço associado
                </p>
                <div>
                  <label className="label">Serviço</label>
                  <select
                    className="input"
                    value={itemForm.service_id}
                    onChange={e => {
                      const svc = services.find(s => s.id === e.target.value)
                      setItemForm(f => ({
                        ...f,
                        service_id: e.target.value,
                        description: f.description || svc?.name || '',
                      }))
                    }}
                  >
                    <option value="">Sem serviço vinculado</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {formatBRL(s.unit_price)}/{s.unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custo previsto do item */}
              {(itemForm.product_id || itemForm.service_id) && (() => {
                const prod = products.find(p => p.id === itemForm.product_id)
                const svc = services.find(s => s.id === itemForm.service_id)
                const matCost = (prod?.unit_price ?? 0) * (parseFloat(itemForm.quantity) || 0)
                const svcCost = svc?.unit_price ?? 0
                const total = matCost + svcCost
                return total > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Material: {formatBRL(matCost)}</span>
                      <span>Serviço: {formatBRL(svcCost)}</span>
                      <span className="font-bold text-green-700">Total: {formatBRL(total)}</span>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Descrição */}
              <div>
                <label className="label">Descrição do item *</label>
                <input
                  className="input"
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  required
                  placeholder="Ex: Troca de óleo do motor"
                />
                <p className="text-xs text-gray-400 mt-1">Preenchida automaticamente ao selecionar produto/serviço</p>
              </div>

              <div>
                <label className="label">Ordem</label>
                <input type="number" min={0} className="input w-24" value={itemForm.order_index} onChange={e => setItemForm(f => ({ ...f, order_index: e.target.value }))} />
              </div>

            </div>
            <div className="px-6 py-4 border-t flex-shrink-0 bg-gray-50 space-y-3">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : 'Salvar Item'}</button>
              </div>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Batch Items Modal ── */}
      {showItemsModal && itemsModalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Itens do Plano</h3>
                <p className="text-xs text-gray-400 mt-0.5">{itemsModalPlan.name} · marque os produtos que fazem parte desta revisão</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Filtrar produtos..."
                  value={itemsSearch}
                  onChange={e => setItemsSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Product list */}
            <div className="overflow-y-auto flex-1">
              {(() => {
                const filtered = products.filter(p =>
                  p.name.toLowerCase().includes(itemsSearch.toLowerCase()) ||
                  p.code.toLowerCase().includes(itemsSearch.toLowerCase())
                )
                if (filtered.length === 0) return (
                  <p className="text-center text-gray-400 text-sm py-10">Nenhum produto encontrado</p>
                )
                return (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                      <tr>
                        <th className="w-10 px-4 py-2"></th>
                        <th className="text-left px-2 py-2 text-xs font-semibold text-gray-500">Produto</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-gray-500 w-28">Quantidade</th>
                        <th className="text-left px-2 py-2 text-xs font-semibold text-gray-500">Serviço</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-28">Custo prev.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(prod => {
                        const draft = draftItems[prod.id] ?? { checked: false, quantity: '1', service_id: '' }
                        const svc = services.find(s => s.id === draft.service_id)
                        const cost = draft.checked
                          ? (prod.unit_price * (parseFloat(draft.quantity) || 0)) + (svc?.unit_price ?? 0)
                          : 0
                        return (
                          <tr
                            key={prod.id}
                            className={`transition-colors ${draft.checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            onClick={() => setDraftItems(prev => ({
                              ...prev,
                              [prod.id]: { ...prev[prod.id], checked: !prev[prod.id]?.checked }
                            }))}
                          >
                            <td className="px-4 py-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draft.checked}
                                readOnly
                                className="w-4 h-4 accent-blue-600"
                              />
                            </td>
                            <td className="px-2 py-3">
                              <p className="font-medium text-gray-900">{prod.name}</p>
                              <p className="text-xs text-gray-400">{prod.code} · {prod.unit} · {formatBRL(prod.unit_price)}/{prod.unit}</p>
                            </td>
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.001"
                                  min={0.001}
                                  disabled={!draft.checked}
                                  className="input font-mono text-center w-16 py-1 text-sm disabled:opacity-40"
                                  value={draft.quantity}
                                  onChange={e => setDraftItems(prev => ({
                                    ...prev,
                                    [prod.id]: { ...prev[prod.id], quantity: e.target.value }
                                  }))}
                                />
                                <span className="text-xs text-gray-400">{prod.unit}</span>
                              </div>
                            </td>
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              <select
                                disabled={!draft.checked}
                                className="input py-1 text-sm disabled:opacity-40"
                                value={draft.service_id}
                                onChange={e => setDraftItems(prev => ({
                                  ...prev,
                                  [prod.id]: { ...prev[prod.id], service_id: e.target.value }
                                }))}
                              >
                                <option value="">— sem serviço —</option>
                                {services.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
                              {draft.checked && cost > 0 ? formatBRL(cost) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              })()}
            </div>

            {/* Footer: total + save */}
            <div className="px-6 py-4 border-t flex items-center justify-between gap-4 flex-shrink-0 bg-gray-50">
              <div className="text-sm text-gray-600">
                {(() => {
                  const checkedCount = Object.values(draftItems).filter(d => d.checked).length
                  const total = Object.entries(draftItems)
                    .filter(([, d]) => d.checked)
                    .reduce((sum, [productId, d]) => {
                      const prod = products.find(p => p.id === productId)
                      const svc = services.find(s => s.id === d.service_id)
                      return sum + (prod?.unit_price ?? 0) * (parseFloat(d.quantity) || 0) + (svc?.unit_price ?? 0)
                    }, 0)
                  return (
                    <span>
                      <strong>{checkedCount}</strong> produto{checkedCount !== 1 ? 's' : ''} selecionado{checkedCount !== 1 ? 's' : ''}
                      {total > 0 && <> · Custo previsto: <strong className="text-green-700">{formatBRL(total)}</strong></>}
                    </span>
                  )
                })()}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={() => setShowItemsModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={saveItemsBatch} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Itens'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
