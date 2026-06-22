'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { WorkOrder, WorkOrderStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import ListTotal from '@/components/ListTotal'
import { Plus, X, Loader2, ClipboardList, Search, ExternalLink, Pencil } from 'lucide-react'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  criada: 'Criada',
  iniciada: 'Iniciada (aguardando material)',
  material_retirado: 'Material retirado',
  servico_iniciado: 'Serviço iniciado',
  servico_finalizado: 'Serviço finalizado',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  criada: 'bg-blue-100 text-blue-700',
  iniciada: 'bg-amber-100 text-amber-700',
  material_retirado: 'bg-orange-100 text-orange-700',
  servico_iniciado: 'bg-yellow-100 text-yellow-700',
  servico_finalizado: 'bg-green-100 text-green-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

type FilterStatus = WorkOrderStatus | ''

export default function OsClient({
  orders,
  equipmentList,
  plansByModel,
  currentUserId,
  isAdminGeral,
  role,
}: {
  orders: WorkOrder[]
  equipmentList: any[]
  plansByModel: Record<string, { id: string; name: string; interval_value: number }[]>
  currentUserId: string
  isAdminGeral: boolean
  role: string
}) {
  const canWrite = role === 'admin_geral' || role === 'admin_local' || role === 'encarregado'
  const router = useRouter()
  const searchParams = useSearchParams()
  const didAutoOpen = useRef(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Modal de edição de OS já existente (notes + description)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkOrder | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Create form state
  const [type, setType] = useState<'preventive' | 'corrective'>('preventive')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {
      '': orders.length,
      criada: 0,
      iniciada: 0,
      material_retirado: 0,
      servico_iniciado: 0,
      servico_finalizado: 0,
      cancelada: 0,
    }
    orders.forEach(o => { c[o.status] = (c[o.status] ?? 0) + 1 })
    return c
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter(o => {
      if (filterStatus && o.status !== filterStatus) return false
      if (q) {
        const eq = o.equipment as any
        const match = o.number.toLowerCase().includes(q)
          || (eq?.code ?? '').toLowerCase().includes(q)
          || (eq?.name ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [orders, filterStatus, search])

  const selectedEquipmentData = equipmentList.find((e: any) => e.id === selectedEquipment)
  const availablePlans = selectedEquipmentData
    ? (plansByModel[selectedEquipmentData.model_id] ?? [])
    : []

  function openModal() {
    setType('preventive')
    setSelectedEquipment('')
    setSelectedPlan('')
    setDescription('')
    setNotes('')
    setError('')
    setShowModal(true)
  }

  // Auto-abre o modal de criação quando vem com ?equipment=&plan= (dashboard)
  useEffect(() => {
    if (didAutoOpen.current) return
    if (!canWrite) return
    const equipParam = searchParams.get('equipment')
    const planParam = searchParams.get('plan')
    if (!equipParam || equipmentList.length === 0) return

    const eq = equipmentList.find((e: any) => e.id === equipParam)
    if (!eq) return

    // Só usa o plano se ele pertencer ao modelo do equipamento
    const validPlans = plansByModel[eq.model_id] ?? []
    const planMatches = planParam && validPlans.some((p: any) => p.id === planParam)

    didAutoOpen.current = true
    setType('preventive')
    setSelectedEquipment(equipParam)
    setSelectedPlan(planMatches ? (planParam as string) : '')
    setDescription('')
    setNotes('')
    setError('')
    setShowModal(true)
  }, [searchParams, equipmentList, plansByModel])

  async function handleCreate() {
    if (!selectedEquipment) { setError('Selecione um equipamento.'); return }
    if (type === 'preventive' && !selectedPlan) { setError('Selecione um plano de manutenção.'); return }
    if (type === 'corrective' && !description.trim()) { setError('Descreva o problema.'); return }

    setSaving(true)
    setError('')
    const supabase = createClient()

    const { data, error: err } = await supabase
      .from('work_orders')
      .insert({
        type,
        equipment_id: selectedEquipment,
        plan_id: type === 'preventive' ? selectedPlan : null,
        description: type === 'corrective' ? description.trim() : null,
        notes: notes.trim() || null,
        opened_by: currentUserId,
      })
      .select('id')
      .single()

    setSaving(false)

    if (err || !data) {
      setError('Erro ao abrir OS. Tente novamente.')
      return
    }

    setShowModal(false)
    router.push(`/os/${data.id}`)
    router.refresh()
  }

  function openEdit(o: WorkOrder) {
    setEditTarget(o)
    setEditNotes(o.notes ?? '')
    setEditDescription(o.description ?? '')
    setEditError('')
    setShowEditModal(true)
  }

  async function confirmEdit() {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    const supabase = createClient()
    const payload: { notes: string | null; description?: string | null } = {
      notes: editNotes.trim() || null,
    }
    if (editTarget.type === 'corrective') payload.description = editDescription.trim() || null

    const { error: err } = await supabase
      .from('work_orders')
      .update(payload)
      .eq('id', editTarget.id)

    if (err) { setEditSaving(false); setEditError('Erro ao salvar: ' + err.message); return }

    setEditSaving(false)
    setShowEditModal(false)
    setEditTarget(null)
    router.refresh()
  }

  const STATUS_TABS: { key: FilterStatus; label: string }[] = [
    { key: '', label: 'Todas' },
    { key: 'criada', label: 'Criadas' },
    { key: 'iniciada', label: 'Aguard. material' },
    { key: 'material_retirado', label: 'Aguard. serviço' },
    { key: 'servico_iniciado', label: 'Serviço iniciado' },
    { key: 'servico_finalizado', label: 'Finalizadas' },
    { key: 'cancelada', label: 'Canceladas' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ordens de Serviço</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as OS de manutenção preventiva e corretiva</p>
        </div>
        {canWrite && (
          <button onClick={openModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova OS
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-semibold">
                {statusCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9 py-1.5 text-sm"
            placeholder="Buscar por OS, código ou equipamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-header">Número</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Equipamento</th>
              <th className="table-header">Plano / Descrição</th>
              <th className="table-header">Status</th>
              <th className="table-header">Aberta em</th>
              <th className="table-header w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-gray-400 py-12">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Nenhuma OS encontrada
                </td>
              </tr>
            ) : filtered.map(o => {
              const eq = o.equipment as any
              return (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <span className="font-mono font-semibold text-gray-900">{o.number}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      o.type === 'preventive'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      {o.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <p className="font-semibold text-gray-900">{eq?.code}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[160px]">{eq?.name}</p>
                  </td>
                  <td className="table-cell text-sm text-gray-600">
                    {o.type === 'preventive'
                      ? (o.maintenance_plans as any)?.name ?? '-'
                      : <span className="italic truncate max-w-[180px] block">{o.description}</span>
                    }
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-500">
                    {formatDate(o.opened_at)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <button
                          onClick={() => openEdit(o)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Editar observações"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        href={`/os/${o.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="Abrir detalhe"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <ListTotal
          count={filtered.length}
          total={orders.length}
          singular="OS"
          plural="OS"
          className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-right"
        />
      </div>

      {/* Modal Nova OS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Abrir Nova OS</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de OS</label>
                <div className="flex gap-2">
                  {(['preventive', 'corrective'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setType(t); setSelectedPlan(''); setDescription('') }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        type === t
                          ? t === 'preventive'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t === 'preventive' ? 'Preventiva' : 'Corretiva'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                <select
                  className="input w-full"
                  value={selectedEquipment}
                  onChange={e => { setSelectedEquipment(e.target.value); setSelectedPlan('') }}
                >
                  <option value="">Selecione um equipamento...</option>
                  {equipmentList.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} – {eq.name} ({(eq.equipment_models as any)?.brands?.name} {(eq.equipment_models as any)?.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Plano (preventiva) */}
              {type === 'preventive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plano de Manutenção</label>
                  <select
                    className="input w-full"
                    value={selectedPlan}
                    onChange={e => setSelectedPlan(e.target.value)}
                    disabled={!selectedEquipment}
                  >
                    <option value="">
                      {selectedEquipment
                        ? availablePlans.length > 0 ? 'Selecione um plano...' : 'Nenhum plano disponível'
                        : 'Selecione um equipamento primeiro'}
                    </option>
                    {availablePlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Descrição (corretiva) */}
              {type === 'corrective' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Problema</label>
                  <textarea
                    className="input w-full h-20 resize-none"
                    placeholder="Descreva o problema ou serviço a ser realizado..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  className="input w-full h-16 resize-none"
                  placeholder="Observações gerais..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Abrir OS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar OS (notes + description) */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold">Editar OS {editTarget.number}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editTarget.type === 'preventive' ? 'Preventiva' : 'Corretiva'} · status: {STATUS_LABELS[editTarget.status] ?? editTarget.status}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editTarget.type === 'corrective' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do problema</label>
                  <textarea
                    className="input w-full h-20 resize-none"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Descreva o problema/serviço a ser feito"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  className="input w-full h-24 resize-none"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Comentários, observações técnicas, etc."
                />
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary" disabled={editSaving}>Cancelar</button>
              <button onClick={confirmEdit} disabled={editSaving} className="btn-primary">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
