'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, MaintenancePlan, MaintenanceRecord } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { formatDate, todayISO } from '@/lib/utils'
import { Wrench, Plus, X, Filter } from 'lucide-react'

interface FormState {
  equipment_id: string
  plan_id: string
  reading_at_maintenance: string
  maintenance_date: string
  performed_by: string
  notes: string
}

const emptyForm = (): FormState => ({
  equipment_id: '', plan_id: '', reading_at_maintenance: '',
  maintenance_date: todayISO(), performed_by: '', notes: '',
})

export default function ManutencoesPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [filteredPlans, setFilteredPlans] = useState<MaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<{ role: string; branch_id: string | null } | null>(null)
  const [filterEq, setFilterEq] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('role, branch_id').eq('id', user.id).single()
    if (!prof) return
    setProfile(prof)

    let rQuery = supabase
      .from('maintenance_records')
      .select(`
        *,
        equipment:equipment_id(id, code, name, model_id, branch_id, equipment_models(*, brands(*))),
        maintenance_plans:plan_id(*, equipment_models(*)),
        profiles:created_by(name)
      `)
      .order('maintenance_date', { ascending: false })
      .limit(100)

    let eQuery = supabase
      .from('equipment')
      .select('*, equipment_models(*, brands(*)), branches(*)')
      .eq('active', true)
      .order('code')

    if (prof.role !== 'admin_geral' && prof.branch_id) {
      eQuery = eQuery.eq('branch_id', prof.branch_id)
    }

    const [{ data: recs }, { data: equips }, { data: allPlans }] = await Promise.all([
      rQuery,
      eQuery,
      supabase.from('maintenance_plans').select('*, equipment_models(*, brands(*))').order('interval_value'),
    ])

    setRecords((recs as any[]) ?? [])
    setEquipment((equips as Equipment[]) ?? [])
    setPlans((allPlans as MaintenancePlan[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function handleEquipmentChange(equipmentId: string) {
    setForm(f => ({ ...f, equipment_id: equipmentId, plan_id: '' }))
    const eq = equipment.find(e => e.id === equipmentId)
    if (eq) {
      const modelPlans = plans.filter(p => p.model_id === eq.model_id)
      setFilteredPlans(modelPlans)
    } else {
      setFilteredPlans([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const val = parseFloat(form.reading_at_maintenance)
    if (isNaN(val) || val < 0) {
      setError('Informe a leitura no momento da manutenção.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      equipment_id: form.equipment_id,
      plan_id: form.plan_id || null,
      reading_at_maintenance: val,
      maintenance_date: form.maintenance_date,
      performed_by: form.performed_by.trim() || null,
      notes: form.notes.trim() || null,
      created_by: user.id,
    }

    const { error: err } = await supabase.from('maintenance_records').insert(payload)
    if (err) {
      setError(err.message)
    } else {
      setShowForm(false)
      setForm(emptyForm())
      loadData()
    }
    setSaving(false)
  }

  async function deleteRecord(id: string) {
    if (!confirm('Excluir este registro de manutenção?')) return
    await supabase.from('maintenance_records').delete().eq('id', id)
    loadData()
  }

  const filteredRecords = records.filter(r =>
    filterEq === '' ||
    (r.equipment as any)?.code?.toLowerCase().includes(filterEq.toLowerCase()) ||
    (r.equipment as any)?.name?.toLowerCase().includes(filterEq.toLowerCase())
  )

  const isAdmin = profile?.role === 'admin_geral' || profile?.role === 'admin_local'

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            Manutenções
          </h1>
          <p className="text-gray-500 text-sm mt-1">Histórico e registro de manutenções realizadas</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9 w-44"
              placeholder="Filtrar equipamento"
              value={filterEq}
              onChange={e => setFilterEq(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setForm(emptyForm()); setFilteredPlans([]); setError(''); setShowForm(true) }}>
              <Plus className="w-4 h-4" />
              Registrar
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Data</th>
                <th className="table-header">Equipamento</th>
                <th className="table-header">Plano</th>
                <th className="table-header">Leitura</th>
                <th className="table-header">Executado por</th>
                <th className="table-header">Obs.</th>
                {isAdmin && <th className="table-header"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">Nenhuma manutenção registrada</td></tr>
              )}
              {filteredRecords.map(r => {
                const eq = r.equipment as any
                const plan = r.maintenance_plans as any
                const trackType = eq?.equipment_models?.tracking_type ?? 'hours'
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{formatDate(r.maintenance_date)}</td>
                    <td className="table-cell">
                      <p className="font-semibold">{eq?.code}</p>
                      <p className="text-xs text-gray-400">{eq?.name}</p>
                    </td>
                    <td className="table-cell">
                      {plan ? (
                        <div>
                          <p className="text-sm font-medium">{plan.name}</p>
                          <p className="text-xs text-gray-400">{(plan.equipment_models as any)?.name}</p>
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="table-cell font-mono font-semibold">
                      {formatReading(r.reading_at_maintenance, trackType)}
                    </td>
                    <td className="table-cell">{r.performed_by ?? '-'}</td>
                    <td className="table-cell text-gray-400 text-xs max-w-[160px] truncate">{r.notes ?? '-'}</td>
                    {isAdmin && (
                      <td className="table-cell">
                        <button
                          className="text-red-400 hover:text-red-600 p-1 rounded"
                          onClick={() => deleteRecord(r.id)}
                          title="Excluir"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Registrar Manutenção</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="manut-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Equipamento *</label>
                  <select className="input" value={form.equipment_id} onChange={e => handleEquipmentChange(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {equipment.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.code} – {eq.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Plano de Manutenção</label>
                  <select
                    className="input"
                    value={form.plan_id}
                    onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
                    disabled={!form.equipment_id}
                  >
                    <option value="">Selecione (opcional)...</option>
                    {filteredPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {form.equipment_id && filteredPlans.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Nenhum plano cadastrado para este modelo.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Data da Manutenção *</label>
                    <input type="date" className="input" value={form.maintenance_date} max={todayISO()} onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Leitura no Momento *</label>
                    <input type="number" step="0.1" min={0} className="input font-mono" value={form.reading_at_maintenance} onChange={e => setForm(f => ({ ...f, reading_at_maintenance: e.target.value }))} required placeholder="Ex: 500" />
                  </div>
                </div>
                <div>
                  <label className="label">Executado por</label>
                  <input className="input" value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))} placeholder="Nome do mecânico / oficina" />
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Peças trocadas, serviços realizados..." />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              </form>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" form="manut-form" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Manutenção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
