'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, EquipmentModel, Branch } from '@/lib/types'
import { trackingLabel } from '@/lib/utils'
import { ClipboardList, Plus, Pencil, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface FormState {
  id: string
  code: string
  name: string
  model_id: string
  branch_id: string
  year: string
  serial_number: string
  notes: string
  active: boolean
}

const emptyForm = (): FormState => ({
  id: '', code: '', name: '', model_id: '', branch_id: '',
  year: '', serial_number: '', notes: '', active: true,
})

export default function EquipamentosPage() {
  const supabase = createClient()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [models, setModels] = useState<EquipmentModel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<{ role: string; branch_id: string | null } | null>(null)
  const [filter, setFilter] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('role, branch_id').eq('id', user.id).single()
    if (!prof) return
    setProfile(prof)

    const [{ data: equips }, { data: mdls }, { data: brs }] = await Promise.all([
      supabase
        .from('equipment')
        .select('*, equipment_models(*, brands(*)), branches(*)')
        .order('code'),
      supabase.from('equipment_models').select('*, brands(*)').order('name'),
      supabase.from('branches').select('*').eq('active', true).order('name'),
    ])

    setEquipment((equips as Equipment[]) ?? [])
    setModels((mdls as EquipmentModel[]) ?? [])
    setBranches((brs as Branch[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setForm({
      ...emptyForm(),
      branch_id: profile?.role !== 'admin_geral' && profile?.branch_id ? profile.branch_id : '',
    })
    setError('')
    setShowForm(true)
  }

  function openEdit(eq: Equipment) {
    setForm({
      id: eq.id,
      code: eq.code,
      name: eq.name,
      model_id: eq.model_id,
      branch_id: eq.branch_id,
      year: eq.year ? String(eq.year) : '',
      serial_number: eq.serial_number ?? '',
      notes: eq.notes ?? '',
      active: eq.active,
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      model_id: form.model_id,
      branch_id: form.branch_id,
      year: form.year ? parseInt(form.year) : null,
      serial_number: form.serial_number.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    }

    let err
    if (form.id) {
      const res = await supabase.from('equipment').update(payload).eq('id', form.id)
      err = res.error
    } else {
      const res = await supabase.from('equipment').insert(payload)
      err = res.error
    }

    if (err) {
      setError(err.message.includes('unique') ? 'Esse código já existe.' : err.message)
    } else {
      setShowForm(false)
      loadData()
    }
    setSaving(false)
  }

  async function toggleActive(eq: Equipment) {
    await supabase.from('equipment').update({ active: !eq.active }).eq('id', eq.id)
    loadData()
  }

  const filtered = equipment.filter(e =>
    filter === '' ||
    e.code.toLowerCase().includes(filter.toLowerCase()) ||
    e.name.toLowerCase().includes(filter.toLowerCase())
  )

  const isAdmin = profile?.role === 'admin_geral' || profile?.role === 'admin_local'

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            Equipamentos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} equipamentos</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            className="input w-48"
            placeholder="Buscar..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {isAdmin && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Novo
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Código</th>
                <th className="table-header">Nome</th>
                <th className="table-header">Marca / Modelo</th>
                <th className="table-header">Filial</th>
                <th className="table-header">Ano</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Status</th>
                {isAdmin && <th className="table-header">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">Nenhum equipamento encontrado</td></tr>
              )}
              {filtered.map(eq => (
                <tr key={eq.id} className={`hover:bg-gray-50 transition-colors ${!eq.active ? 'opacity-50' : ''}`}>
                  <td className="table-cell font-mono font-bold">{eq.code}</td>
                  <td className="table-cell">
                    <p className="font-medium">{eq.name}</p>
                    {eq.serial_number && <p className="text-xs text-gray-400">S/N: {eq.serial_number}</p>}
                  </td>
                  <td className="table-cell">
                    <p>{(eq.equipment_models as any)?.brands?.name}</p>
                    <p className="text-xs text-gray-400">{eq.equipment_models?.name}</p>
                  </td>
                  <td className="table-cell">
                    <p>{(eq as any).branches?.name}</p>
                    <p className="text-xs text-gray-400">{(eq as any).branches?.city}/{(eq as any).branches?.state}</p>
                  </td>
                  <td className="table-cell">{eq.year ?? '-'}</td>
                  <td className="table-cell">
                    <span className="badge-blue">{trackingLabel(eq.equipment_models?.tracking_type ?? 'hours')}</span>
                  </td>
                  <td className="table-cell">
                    {eq.active
                      ? <span className="badge-green">Ativo</span>
                      : <span className="badge-gray">Inativo</span>
                    }
                  </td>
                  {isAdmin && (
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button className="btn-secondary py-1 px-2" onClick={() => openEdit(eq)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className={`btn-secondary py-1 px-2 ${eq.active ? 'text-red-500' : 'text-green-600'}`}
                          onClick={() => toggleActive(eq)}
                          title={eq.active ? 'Desativar' : 'Ativar'}
                        >
                          {eq.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">{form.id ? 'Editar' : 'Novo'} Equipamento</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="equip-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Código *</label>
                    <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required placeholder="Ex: JD750J-001" />
                  </div>
                  <div>
                    <label className="label">Ano</label>
                    <input type="number" className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2020" min={1900} max={2100} />
                  </div>
                </div>
                <div>
                  <label className="label">Nome *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Trator de Esteira" />
                </div>
                <div>
                  <label className="label">Modelo *</label>
                  <select className="input" value={form.model_id} onChange={e => setForm(f => ({ ...f, model_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {(m as any).brands?.name} – {m.name} ({m.tracking_type === 'hours' ? 'Horas' : 'km'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Filial *</label>
                  <select
                    className="input"
                    value={form.branch_id}
                    onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                    required
                    disabled={profile?.role !== 'admin_geral'}
                  >
                    <option value="">Selecione...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} – {b.city}/{b.state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Número de Série</label>
                  <input className="input" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Opcional" />
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="active" className="text-sm text-gray-700">Equipamento ativo</label>
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              </form>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" form="equip-form" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
