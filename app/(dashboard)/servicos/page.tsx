'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hammer, Plus, Pencil, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface Service {
  id: string
  name: string
  description: string | null
  unit: string
  unit_price: number
  active: boolean
}

interface FormState {
  id: string
  name: string
  description: string
  unit: string
  unit_price: string
  active: boolean
}

const SERVICE_UNITS = ['h', 'un', 'diária', 'serviço', 'm', 'm²']

const emptyForm = (): FormState => ({ id: '', name: '', description: '', unit: 'h', unit_price: '0', active: true })

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ServicosPage() {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('services').select('*').order('name')
    setServices((data as Service[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit,
      unit_price: parseFloat(form.unit_price) || 0,
      active: form.active,
    }
    const { error: err } = form.id
      ? await supabase.from('services').update(payload).eq('id', form.id)
      : await supabase.from('services').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowForm(false)
    loadData()
    setSaving(false)
  }

  async function toggleActive(s: Service) {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Hammer className="w-6 h-6 text-blue-600" />
            Serviços
          </h1>
          <p className="text-gray-500 text-sm mt-1">Mão de obra, terceiros e serviços externos</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(emptyForm()); setError(''); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Novo Serviço
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Nome</th>
                <th className="table-header">Descrição</th>
                <th className="table-header">Unidade</th>
                <th className="table-header text-right">Preço Unit.</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-12">Nenhum serviço cadastrado</td></tr>
              )}
              {services.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="table-cell font-semibold">{s.name}</td>
                  <td className="table-cell text-gray-500 text-sm max-w-[200px] truncate">{s.description ?? '-'}</td>
                  <td className="table-cell">{s.unit}</td>
                  <td className="table-cell text-right font-mono font-semibold">{formatBRL(s.unit_price)}</td>
                  <td className="table-cell">{s.active ? <span className="badge-green">Ativo</span> : <span className="badge-gray">Inativo</span>}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="btn-secondary py-1 px-2" onClick={() => { setForm({ id: s.id, name: s.name, description: s.description ?? '', unit: s.unit, unit_price: String(s.unit_price), active: s.active }); setError(''); setShowForm(true) }}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button className={`btn-secondary py-1 px-2 ${s.active ? 'text-red-500' : 'text-green-600'}`} onClick={() => toggleActive(s)}>
                        {s.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">{form.id ? 'Editar' : 'Novo'} Serviço</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Mão de obra mecânico" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unidade</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {SERVICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Preço Unit. (R$)</label>
                  <input type="number" step="0.01" min={0} className="input font-mono" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sactive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                <label htmlFor="sactive" className="text-sm text-gray-700">Serviço ativo</label>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
