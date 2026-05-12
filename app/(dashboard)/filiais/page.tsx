'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Branch } from '@/lib/types'
import { ESTADOS_BRASIL } from '@/lib/utils'
import { Building2, Plus, Pencil, ToggleLeft, ToggleRight, X, MapPin } from 'lucide-react'

interface FormState {
  id: string
  name: string
  city: string
  state: string
  active: boolean
}

const emptyForm = (): FormState => ({ id: '', name: '', city: '', state: 'SP', active: true })

export default function FiliaisPage() {
  const supabase = createClient()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('branches').select('*').order('name')
    setBranches((data as Branch[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setForm(emptyForm())
    setError('')
    setShowForm(true)
  }

  function openEdit(b: Branch) {
    setForm({ id: b.id, name: b.name, city: b.city, state: b.state, active: b.active })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = { name: form.name.trim(), city: form.city.trim(), state: form.state, active: form.active }
    const { error: err } = form.id
      ? await supabase.from('branches').update(payload).eq('id', form.id)
      : await supabase.from('branches').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowForm(false)
    loadData()
    setSaving(false)
  }

  async function toggleActive(b: Branch) {
    await supabase.from('branches').update({ active: !b.active }).eq('id', b.id)
    loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Filiais
          </h1>
          <p className="text-gray-500 text-sm mt-1">{branches.length} filiais cadastradas</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nova Filial
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length === 0 && (
          <div className="col-span-full card text-center text-gray-400 py-16">
            Nenhuma filial cadastrada. Clique em "Nova Filial" para começar.
          </div>
        )}
        {branches.map(b => (
          <div key={b.id} className={`card flex items-start gap-4 ${!b.active ? 'opacity-60' : ''}`}>
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{b.name}</h3>
                {b.active
                  ? <span className="badge-green">Ativa</span>
                  : <span className="badge-gray">Inativa</span>
                }
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{b.city} – {b.state}</p>
              <div className="flex gap-2 mt-3">
                <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openEdit(b)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  className={`btn-secondary py-1 px-2 text-xs ${b.active ? 'text-red-500' : 'text-green-600'}`}
                  onClick={() => toggleActive(b)}
                >
                  {b.active
                    ? <><ToggleRight className="w-3.5 h-3.5" /> Desativar</>
                    : <><ToggleLeft className="w-3.5 h-3.5" /> Ativar</>
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">{form.id ? 'Editar' : 'Nova'} Filial</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Nome da Filial *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Filial São Paulo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cidade *</label>
                  <input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required placeholder="Ex: Campinas" />
                </div>
                <div>
                  <label className="label">Estado *</label>
                  <select className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    {ESTADOS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bactive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                <label htmlFor="bactive" className="text-sm text-gray-700">Filial ativa</label>
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
