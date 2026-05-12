'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, MaintenancePlan } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { formatDate, todayISO } from '@/lib/utils'
import { Wrench, Plus, X, Filter, ChevronDown, ChevronRight, Clock, Package, DollarSign, AlertCircle } from 'lucide-react'

interface Product { id: string; code: string; name: string; unit: string; unit_price: number }
interface Service { id: string; name: string; unit: string; unit_price: number }
interface PlanItem { id: string; description: string; product_id: string | null; quantity: number; products?: Product }

interface RecordItem {
  _key: string
  product_id: string
  service_id: string
  plan_item_id: string
  description: string
  quantity: string
  unit: string
  unit_price: string
}

interface MaintenanceRecord {
  id: string
  equipment_id: string
  plan_id: string | null
  type: string
  reading_at_maintenance: number
  maintenance_date: string
  stopped_at: string | null
  resumed_at: string | null
  labor_cost: number
  performed_by: string | null
  notes: string | null
  created_at: string
  equipment?: any
  maintenance_plans?: any
  maintenance_record_items?: any[]
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDatetime(dt: string | null) {
  if (!dt) return '-'
  return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function downtimeMinutes(stopped: string | null, resumed: string | null): number | null {
  if (!stopped || !resumed) return null
  return Math.round((new Date(resumed).getTime() - new Date(stopped).getTime()) / 60000)
}

function formatDowntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function newItem(): RecordItem {
  return { _key: Math.random().toString(36).slice(2), product_id: '', service_id: '', plan_item_id: '', description: '', quantity: '1', unit: 'un', unit_price: '0' }
}

const emptyForm = () => ({
  equipment_id: '', plan_id: '', type: 'preventive',
  reading_at_maintenance: '', maintenance_date: todayISO(),
  stopped_at: '', resumed_at: '', labor_cost: '0',
  performed_by: '', notes: '',
})

export default function ManutencoesPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [filteredPlans, setFilteredPlans] = useState<MaintenancePlan[]>([])
  const [planItemsMap, setPlanItemsMap] = useState<Record<string, PlanItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [items, setItems] = useState<RecordItem[]>([newItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterEq, setFilterEq] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ role: string; branch_id: string | null } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('role, branch_id').eq('id', user.id).single()
    if (!prof) return
    setProfile(prof)

    let rQuery = supabase.from('maintenance_records')
      .select(`*, equipment:equipment_id(id, code, name, model_id, branch_id, equipment_models(tracking_type, brands(name))), maintenance_plans:plan_id(name, interval_value), maintenance_record_items(*, products(id,code,name,unit,unit_price), services(id,name,unit))`)
      .order('maintenance_date', { ascending: false })
      .limit(100)

    let eQuery = supabase.from('equipment').select('*, equipment_models(*, brands(*)), branches(*)').eq('active', true).order('code')

    if (prof.role !== 'admin_geral' && prof.branch_id) {
      eQuery = eQuery.eq('branch_id', prof.branch_id)
    }

    const [{ data: recs }, { data: equips }, { data: allPlans }, { data: allPlanItems }, { data: prods }, { data: svcs }] = await Promise.all([
      rQuery,
      eQuery,
      supabase.from('maintenance_plans').select('*, equipment_models(tracking_type)').order('interval_value'),
      supabase.from('maintenance_plan_items').select('*, products(id,code,name,unit,unit_price)').order('order_index'),
      supabase.from('products').select('id,code,name,unit,unit_price').eq('active', true).order('name'),
      supabase.from('services').select('id,name,unit,unit_price').eq('active', true).order('name'),
    ])

    setRecords((recs as any[]) ?? [])
    setEquipment((equips as Equipment[]) ?? [])
    setPlans((allPlans as MaintenancePlan[]) ?? [])
    setProducts((prods as Product[]) ?? [])
    setServices((svcs as Service[]) ?? [])

    const piMap: Record<string, PlanItem[]> = {}
    ;((allPlanItems as PlanItem[]) ?? []).forEach((i: any) => {
      if (!piMap[i.plan_id]) piMap[i.plan_id] = []
      piMap[i.plan_id].push(i)
    })
    setPlanItemsMap(piMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function handleEquipmentChange(equipId: string) {
    const eq = equipment.find(e => e.id === equipId)
    const modelPlans = eq ? plans.filter(p => p.model_id === eq.model_id) : []
    setFilteredPlans(modelPlans)
    setForm(f => ({ ...f, equipment_id: equipId, plan_id: '' }))
    setItems([newItem()])
  }

  function handlePlanChange(planId: string) {
    setForm(f => ({ ...f, plan_id: planId }))
    if (!planId) { setItems([newItem()]); return }
    const planItems = planItemsMap[planId] ?? []
    if (planItems.length > 0) {
      const prefilledItems: RecordItem[] = planItems.map(pi => ({
        _key: Math.random().toString(36).slice(2),
        product_id: pi.product_id ?? '',
        service_id: '',
        plan_item_id: pi.id,
        description: pi.description,
        quantity: String(pi.quantity),
        unit: pi.products?.unit ?? 'un',
        unit_price: String(pi.products?.unit_price ?? 0),
      }))
      setItems([...prefilledItems, newItem()])
    } else {
      setItems([newItem()])
    }
  }

  function updateItem(key: string, patch: Partial<RecordItem>) {
    setItems(items => items.map(i => i._key === key ? { ...i, ...patch } : i))
  }

  function removeItem(key: string) {
    setItems(items => items.filter(i => i._key !== key))
  }

  function addItem() {
    setItems(items => [...items, newItem()])
  }

  function itemsTotal() {
    return items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  }

  function grandTotal() {
    return itemsTotal() + (parseFloat(form.labor_cost) || 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      equipment_id: form.equipment_id,
      plan_id: form.plan_id || null,
      type: form.type,
      reading_at_maintenance: parseFloat(form.reading_at_maintenance),
      maintenance_date: form.maintenance_date,
      stopped_at: form.stopped_at || null,
      resumed_at: form.resumed_at || null,
      labor_cost: parseFloat(form.labor_cost) || 0,
      performed_by: form.performed_by.trim() || null,
      notes: form.notes.trim() || null,
      created_by: user.id,
    }

    const { data: rec, error: recErr } = await supabase.from('maintenance_records').insert(payload).select().single()
    if (recErr) { setError(recErr.message); setSaving(false); return }

    const validItems = items.filter(i => i.description.trim() || i.product_id || i.service_id)
    if (validItems.length > 0) {
      const itemPayloads = validItems.map(i => ({
        record_id: rec.id,
        product_id: i.product_id || null,
        service_id: i.service_id || null,
        plan_item_id: i.plan_item_id || null,
        description: i.description.trim() || products.find(p => p.id === i.product_id)?.name || services.find(s => s.id === i.service_id)?.name || '',
        quantity: parseFloat(i.quantity) || 1,
        unit: i.unit,
        unit_price: parseFloat(i.unit_price) || 0,
      }))
      const { error: itemErr } = await supabase.from('maintenance_record_items').insert(itemPayloads)
      if (itemErr) { setError(itemErr.message); setSaving(false); return }
    }

    setShowForm(false)
    setForm(emptyForm())
    setItems([newItem()])
    loadData()
    setSaving(false)
  }

  async function deleteRecord(id: string) {
    if (!confirm('Excluir este registro de manutenção? O estoque dos produtos será restaurado.')) return
    await supabase.from('maintenance_records').delete().eq('id', id)
    loadData()
  }

  const filteredRecords = records.filter(r =>
    !filterEq ||
    (r.equipment as any)?.code?.toLowerCase().includes(filterEq.toLowerCase()) ||
    (r.equipment as any)?.name?.toLowerCase().includes(filterEq.toLowerCase())
  )

  const isAdmin = profile?.role === 'admin_geral' || profile?.role === 'admin_local'
  const todayDatetime = new Date().toISOString().slice(0, 16)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            Manutenções
          </h1>
          <p className="text-gray-500 text-sm mt-1">Histórico de manutenções preventivas e corretivas</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input type="text" className="input pl-9 w-44" placeholder="Filtrar equipamento" value={filterEq} onChange={e => setFilterEq(e.target.value)} />
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setForm(emptyForm()); setFilteredPlans([]); setItems([newItem()]); setError(''); setShowForm(true) }}>
              <Plus className="w-4 h-4" /> Registrar
            </button>
          )}
        </div>
      </div>

      {/* Records list */}
      <div className="space-y-3">
        {filteredRecords.length === 0 && (
          <div className="card text-center text-gray-400 py-12">Nenhuma manutenção registrada</div>
        )}
        {filteredRecords.map(r => {
          const eq = r.equipment as any
          const plan = r.maintenance_plans as any
          const trackType = eq?.equipment_models?.tracking_type ?? 'hours'
          const recItems = (r.maintenance_record_items ?? []) as any[]
          const materialCost = recItems.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0)
          const totalCost = materialCost + (r.labor_cost ?? 0)
          const dt = downtimeMinutes(r.stopped_at, r.resumed_at)
          const isExpanded = expandedRecord === r.id
          const typeColor = r.type === 'preventive' ? 'badge-blue' : 'badge-red'
          const typeLabel = r.type === 'preventive' ? 'Preventiva' : 'Corretiva'

          return (
            <div key={r.id} className={`card p-0 overflow-hidden border-l-4 ${r.type === 'preventive' ? 'border-l-blue-500' : 'border-l-red-400'}`}>
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedRecord(isExpanded ? null : r.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{eq?.code}</span>
                      <span className="text-gray-600 truncate">{eq?.name}</span>
                      <span className={typeColor}>{typeLabel}</span>
                      {plan && <span className="badge-gray">{plan.name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{formatDate(r.maintenance_date)}</span>
                      <span className="text-xs text-gray-500 font-mono">{formatReading(r.reading_at_maintenance, trackType)}</span>
                      {dt !== null && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Parada: {formatDowntime(dt)}
                        </span>
                      )}
                      {totalCost > 0 && (
                        <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {formatBRL(totalCost)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button className="text-red-400 hover:text-red-600 p-1 ml-2 flex-shrink-0" onClick={e => { e.stopPropagation(); deleteRecord(r.id) }}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {/* Downtime */}
                  {(r.stopped_at || r.resumed_at) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Parada</p>
                        <p className="font-medium">{formatDatetime(r.stopped_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Retomada</p>
                        <p className="font-medium">{formatDatetime(r.resumed_at)}</p>
                      </div>
                      {dt !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Tempo parado</p>
                          <p className="font-bold text-orange-600">{formatDowntime(dt)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items used */}
                  {recItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> Materiais e Serviços Utilizados
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left pb-1 text-xs text-gray-400 font-medium">Descrição</th>
                            <th className="text-right pb-1 text-xs text-gray-400 font-medium">Qtd</th>
                            <th className="text-right pb-1 text-xs text-gray-400 font-medium">Unit.</th>
                            <th className="text-right pb-1 text-xs text-gray-400 font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {recItems.map((i: any) => (
                            <tr key={i.id}>
                              <td className="py-1.5">
                                <span>{i.description}</span>
                                {i.products && <span className="ml-1 text-xs text-blue-500">({i.products.code})</span>}
                              </td>
                              <td className="py-1.5 text-right font-mono">{i.quantity} {i.unit}</td>
                              <td className="py-1.5 text-right font-mono text-gray-500">{formatBRL(i.unit_price)}</td>
                              <td className="py-1.5 text-right font-mono font-semibold">{formatBRL(i.quantity * i.unit_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Cost summary */}
                  <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Materiais</p>
                      <p className="font-bold font-mono">{formatBRL(materialCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Mão de Obra</p>
                      <p className="font-bold font-mono">{formatBRL(r.labor_cost ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold">Total</p>
                      <p className="font-bold text-green-700 font-mono text-base">{formatBRL(totalCost)}</p>
                    </div>
                  </div>

                  {(r.performed_by || r.notes) && (
                    <div className="text-sm text-gray-500">
                      {r.performed_by && <p>Executado por: <strong>{r.performed_by}</strong></p>}
                      {r.notes && <p className="mt-1">{r.notes}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-semibold text-lg">Registrar Manutenção</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="manut-form" onSubmit={handleSubmit} className="space-y-5">

                {/* Type + Equipment */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Tipo *</label>
                    <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="preventive">Preventiva</option>
                      <option value="corrective">Corretiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Data *</label>
                    <input type="date" className="input" value={form.maintenance_date} max={todayISO()} onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))} required />
                  </div>
                </div>

                <div>
                  <label className="label">Equipamento *</label>
                  <select className="input" value={form.equipment_id} onChange={e => handleEquipmentChange(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.code} – {eq.name}</option>)}
                  </select>
                </div>

                {form.type === 'preventive' && form.equipment_id && (
                  <div>
                    <label className="label">Plano de Manutenção</label>
                    <select className="input" value={form.plan_id} onChange={e => handlePlanChange(e.target.value)}>
                      <option value="">Sem plano vinculado</option>
                      {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {form.plan_id && (planItemsMap[form.plan_id] ?? []).length > 0 && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Itens do plano pré-carregados. Adicione ou remova itens abaixo.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">Leitura no momento *</label>
                  <input type="number" step="0.1" min={0} className="input font-mono" value={form.reading_at_maintenance} onChange={e => setForm(f => ({ ...f, reading_at_maintenance: e.target.value }))} required placeholder="Ex: 502.5" />
                </div>

                {/* Downtime */}
                <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
                  <p className="text-sm font-semibold text-orange-700 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Parada do Equipamento
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Parou em</label>
                      <input type="datetime-local" className="input" max={todayDatetime} value={form.stopped_at} onChange={e => setForm(f => ({ ...f, stopped_at: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Voltou em</label>
                      <input type="datetime-local" className="input" max={todayDatetime} value={form.resumed_at} onChange={e => setForm(f => ({ ...f, resumed_at: e.target.value }))} />
                    </div>
                  </div>
                  {form.stopped_at && form.resumed_at && (() => {
                    const dt = downtimeMinutes(form.stopped_at, form.resumed_at)
                    if (dt === null || dt < 0) return <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Data de retomada anterior à parada</p>
                    return <p className="text-xs text-orange-700 font-semibold">Tempo de parada: {formatDowntime(dt)}</p>
                  })()}
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                      <Package className="w-4 h-4" /> Materiais e Serviços Utilizados
                    </p>
                    <button type="button" className="btn-secondary py-1 px-3 text-xs" onClick={addItem}>
                      <Plus className="w-3 h-3" /> Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={item._key} className="border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Produto</label>
                            <select
                              className="input text-sm"
                              value={item.product_id}
                              onChange={e => {
                                const prod = products.find(p => p.id === e.target.value)
                                updateItem(item._key, {
                                  product_id: e.target.value,
                                  service_id: '',
                                  description: item.description || prod?.name || '',
                                  unit: prod?.unit ?? item.unit,
                                  unit_price: prod ? String(prod.unit_price) : item.unit_price,
                                })
                              }}
                            >
                              <option value="">Selecione ou deixe livre</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.code} – {p.name} ({p.unit})</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Serviço</label>
                            <select
                              className="input text-sm"
                              value={item.service_id}
                              onChange={e => {
                                const svc = services.find(s => s.id === e.target.value)
                                updateItem(item._key, {
                                  service_id: e.target.value,
                                  product_id: '',
                                  description: item.description || svc?.name || '',
                                  unit: svc?.unit ?? item.unit,
                                  unit_price: svc ? String(svc.unit_price) : item.unit_price,
                                })
                              }}
                            >
                              <option value="">Nenhum</option>
                              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <input
                            className="input text-sm"
                            placeholder="Descrição *"
                            value={item.description}
                            onChange={e => updateItem(item._key, { description: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                            <input type="number" step="0.001" min={0} className="input text-sm font-mono" value={item.quantity} onChange={e => updateItem(item._key, { quantity: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Unidade</label>
                            <input className="input text-sm" value={item.unit} onChange={e => updateItem(item._key, { unit: e.target.value })} placeholder="un" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Preço Unit. (R$)</label>
                            <input type="number" step="0.01" min={0} className="input text-sm font-mono" value={item.unit_price} onChange={e => updateItem(item._key, { unit_price: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">
                            Subtotal: {formatBRL((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                          </span>
                          {items.length > 1 && (
                            <button type="button" className="text-red-400 hover:text-red-600 text-xs" onClick={() => removeItem(item._key)}>Remover</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Costs */}
                <div className="border border-green-200 rounded-xl p-4 space-y-3 bg-green-50">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-green-800 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> Mão de Obra / Terceiros (R$)
                    </label>
                  </div>
                  <input type="number" step="0.01" min={0} className="input font-mono" value={form.labor_cost} onChange={e => setForm(f => ({ ...f, labor_cost: e.target.value }))} placeholder="0,00" />
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-green-200 text-sm">
                    <div><p className="text-xs text-green-700">Materiais</p><p className="font-bold font-mono">{formatBRL(itemsTotal())}</p></div>
                    <div><p className="text-xs text-green-700">Mão de Obra</p><p className="font-bold font-mono">{formatBRL(parseFloat(form.labor_cost) || 0)}</p></div>
                    <div><p className="text-xs text-green-700 font-bold">Total</p><p className="font-bold text-green-800 font-mono text-base">{formatBRL(grandTotal())}</p></div>
                  </div>
                </div>

                <div>
                  <label className="label">Executado por</label>
                  <input className="input" value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))} placeholder="Mecânico / oficina" />
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              </form>
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3 justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Total: <span className="text-green-700">{formatBRL(grandTotal())}</span></span>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary" form="manut-form" type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Manutenção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
