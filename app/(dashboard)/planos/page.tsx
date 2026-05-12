'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Brand, EquipmentModel, MaintenancePlan, MaintenancePlanItem } from '@/lib/types'
import { trackingLabel } from '@/lib/utils'
import { BookOpen, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'

export default function PlanosPage() {
  const supabase = createClient()
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<EquipmentModel[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  // Brand modal
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [brandForm, setBrandForm] = useState({ id: '', name: '' })

  // Model modal
  const [showModelModal, setShowModelModal] = useState(false)
  const [modelForm, setModelForm] = useState({ id: '', brand_id: '', name: '', tracking_type: 'hours' })

  // Plan modal
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [planForm, setPlanForm] = useState({ id: '', model_id: '', interval_value: '', name: '', description: '' })

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState({ id: '', plan_id: '', description: '', order_index: '0' })
  const [planItems, setPlanItems] = useState<Record<string, MaintenancePlanItem[]>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: m }, { data: p }, { data: items }] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('equipment_models').select('*, brands(*)').order('name'),
      supabase.from('maintenance_plans').select('*').order('interval_value'),
      supabase.from('maintenance_plan_items').select('*').order('order_index'),
    ])
    setBrands((b as Brand[]) ?? [])
    setModels((m as EquipmentModel[]) ?? [])
    setPlans((p as MaintenancePlan[]) ?? [])
    const itemMap: Record<string, MaintenancePlanItem[]> = {}
    ;((items as MaintenancePlanItem[]) ?? []).forEach(i => {
      if (!itemMap[i.plan_id]) itemMap[i.plan_id] = []
      itemMap[i.plan_id].push(i)
    })
    setPlanItems(itemMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Brand CRUD
  async function saveBrand(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { name: brandForm.name.trim() }
    const { error: err } = brandForm.id
      ? await supabase.from('brands').update(payload).eq('id', brandForm.id)
      : await supabase.from('brands').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowBrandModal(false); loadData(); setSaving(false)
  }

  async function deleteBrand(id: string) {
    if (!confirm('Excluir esta marca? Modelos vinculados não poderão ser excluídos separadamente.')) return
    const { error: err } = await supabase.from('brands').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  // Model CRUD
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
    if (!confirm('Excluir este modelo? Os planos vinculados também serão removidos.')) return
    const { error: err } = await supabase.from('equipment_models').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  // Plan CRUD
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
      setError(err.message.includes('unique') ? 'Já existe um plano com esse intervalo para este modelo.' : err.message)
      setSaving(false); return
    }
    setShowPlanModal(false); loadData(); setSaving(false)
  }

  async function deletePlan(id: string) {
    if (!confirm('Excluir este plano de manutenção?')) return
    const { error: err } = await supabase.from('maintenance_plans').delete().eq('id', id)
    if (err) alert(err.message); else loadData()
  }

  // Item CRUD
  async function saveItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      plan_id: itemForm.plan_id,
      description: itemForm.description.trim(),
      order_index: parseInt(itemForm.order_index) || 0,
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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Planos de Manutenção
        </h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie marcas, modelos e planos de manutenção preventiva</p>
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
              <button className="text-gray-400 hover:text-blue-600" onClick={() => { setBrandForm({ id: b.id, name: b.name }); setError(''); setShowBrandModal(true) }}>
                <Pencil className="w-3 h-3" />
              </button>
              <button className="text-gray-400 hover:text-red-600" onClick={() => deleteBrand(b.id)}>
                <Trash2 className="w-3 h-3" />
              </button>
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

        {models.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-12">Nenhum modelo cadastrado</p>
        )}

        {models.map(model => {
          const modelPlans = plans.filter(p => p.model_id === model.id).sort((a, b) => a.interval_value - b.interval_value)
          const isExpanded = expandedModel === model.id
          return (
            <div key={model.id} className="border-b border-gray-100 last:border-0">
              {/* Model header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedModel(isExpanded ? null : model.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{(model as any).brands?.name}</span>
                      <span className="text-gray-400">–</span>
                      <span className="font-medium">{model.name}</span>
                      <span className="badge-blue">{trackingLabel(model.tracking_type)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{modelPlans.length} plano(s) de manutenção</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button className="btn-secondary py-1 px-2" onClick={() => { setModelForm({ id: model.id, brand_id: model.brand_id, name: model.name, tracking_type: model.tracking_type }); setError(''); setShowModelModal(true) }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="btn-secondary py-1 px-2 text-red-500" onClick={() => deleteModel(model.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="btn-primary py-1 px-2" onClick={() => { setPlanForm({ id: '', model_id: model.id, interval_value: '', name: '', description: '' }); setError(''); setShowPlanModal(true) }}>
                    <Plus className="w-4 h-4" /> Plano
                  </button>
                </div>
              </div>

              {/* Plans for this model */}
              {isExpanded && (
                <div className="pl-12 pr-6 pb-4 space-y-3">
                  {modelPlans.length === 0 && (
                    <p className="text-gray-400 text-sm py-4 text-center">Nenhum plano cadastrado. Clique em "+ Plano" para adicionar.</p>
                  )}
                  {modelPlans.map(plan => {
                    const isPlanExpanded = expandedPlan === plan.id
                    const items = planItems[plan.id] ?? []
                    return (
                      <div key={plan.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedPlan(isPlanExpanded ? null : plan.id)}
                        >
                          <div className="flex items-center gap-3">
                            {isPlanExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            <div>
                              <p className="font-semibold text-sm">{plan.name}</p>
                              <p className="text-xs text-gray-400">A cada {plan.interval_value.toLocaleString('pt-BR')} {model.tracking_type === 'hours' ? 'horas' : 'km'} · {items.length} itens</p>
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <button className="btn-secondary py-1 px-2" onClick={() => { setPlanForm({ id: plan.id, model_id: plan.model_id, interval_value: String(plan.interval_value), name: plan.name, description: plan.description ?? '' }); setError(''); setShowPlanModal(true) }}>
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button className="btn-secondary py-1 px-2 text-red-500" onClick={() => deletePlan(plan.id)}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button className="btn-secondary py-1 px-2 text-blue-600" onClick={() => { setItemForm({ id: '', plan_id: plan.id, description: '', order_index: String(items.length) }); setError(''); setShowItemModal(true) }}>
                              <Plus className="w-3 h-3" /> Item
                            </button>
                          </div>
                        </div>

                        {isPlanExpanded && (
                          <div className="px-4 py-3">
                            {plan.description && <p className="text-sm text-gray-500 mb-3">{plan.description}</p>}
                            {items.length === 0 ? (
                              <p className="text-gray-400 text-sm text-center py-4">Nenhum item. Clique em "+ Item" para adicionar.</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {items.map((item, idx) => (
                                  <li key={item.id} className="flex items-center gap-3 group">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center flex-shrink-0 font-medium">{idx + 1}</span>
                                    <span className="text-sm flex-1">{item.description}</span>
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                      <button className="text-gray-400 hover:text-blue-600" onClick={() => { setItemForm({ id: item.id, plan_id: item.plan_id, description: item.description, order_index: String(item.order_index) }); setError(''); setShowItemModal(true) }}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button className="text-gray-400 hover:text-red-600" onClick={() => deleteItem(item.id)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
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
                <label className="label">Nome da Marca *</label>
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
                <label className="label">Intervalo (horas ou km) *</label>
                <input type="number" min={1} className="input font-mono" value={planForm.interval_value} onChange={e => setPlanForm(f => ({ ...f, interval_value: e.target.value }))} required placeholder="Ex: 500" />
              </div>
              <div>
                <label className="label">Nome do Plano *</label>
                <input className="input" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Revisão 500h" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea className="input" rows={2} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
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

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">{itemForm.id ? 'Editar' : 'Novo'} Item do Plano</h3>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveItem} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Descrição do Item *</label>
                <textarea className="input" rows={3} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} required placeholder="Ex: Troca de óleo do motor – 10W40" />
              </div>
              <div>
                <label className="label">Ordem</label>
                <input type="number" min={0} className="input" value={itemForm.order_index} onChange={e => setItemForm(f => ({ ...f, order_index: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
