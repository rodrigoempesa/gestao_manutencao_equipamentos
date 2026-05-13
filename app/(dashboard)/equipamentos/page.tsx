'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, EquipmentModel, Branch } from '@/lib/types'
import { trackingLabel } from '@/lib/utils'
import { ClipboardList, Plus, Pencil, ToggleLeft, ToggleRight, X, Search, SlidersHorizontal, Upload, AlertCircle, CheckCircle2, Download } from 'lucide-react'

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

interface ImportRow {
  identificacao: string
  marca: string
  modelo: string
  fabricacao: string
  chassi: string
  localizacao: string
  // resolved
  _brandId?: string
  _modelId?: string   // set after model upsert
  _errors: string[]
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field.trim()); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (field || row.length) { row.push(field.trim()); rows.push(row) }
        row = []; field = ''
        if (ch === '\r' && text[i + 1] === '\n') i++
      } else field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows
}

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
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')

  // Import state
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importTrackingType, setImportTrackingType] = useState<'hours' | 'km'>('hours')
  const [importSaving, setImportSaving] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importResult, setImportResult] = useState({ inserted: 0, errors: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ── Import helpers ──

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      processCSV(text)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  function processCSV(text: string) {
    const rows = parseCSV(text)
    if (rows.length < 2) return

    // Detect header row (case-insensitive)
    const header = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
    const idx = {
      id:    header.findIndex(h => h.includes('identifica')),
      marca: header.findIndex(h => h.includes('marca')),
      model: header.findIndex(h => h.includes('model')),
      fab:   header.findIndex(h => h.includes('fabrica')),
      chassi:header.findIndex(h => h.includes('chassi') || h.includes('serie')),
      loc:   header.findIndex(h => h.includes('localiza')),
    }

    // Load all brands for matching
    const parsed: ImportRow[] = rows.slice(1).filter(r => r.some(c => c)).map(r => {
      const identificacao = r[idx.id] ?? ''
      const marca         = r[idx.marca] ?? ''
      const modelo        = r[idx.model] ?? ''
      const fabricacao    = r[idx.fab] ?? ''
      const chassi        = r[idx.chassi] ?? ''
      const localizacao   = r[idx.loc] ?? ''
      const errs: string[] = []

      if (!identificacao) errs.push('IDENTIFICAÇÃO vazio')
      if (!marca)         errs.push('MARCA vazia')
      if (!modelo)        errs.push('MODELO vazio')
      if (!localizacao)   errs.push('LOCALIZAÇÃO vazia')

      // Validate UUID format for localizacao
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (localizacao && !uuidRe.test(localizacao)) errs.push('LOCALIZAÇÃO deve ser um UUID válido')

      return { identificacao, marca, modelo, fabricacao, chassi, localizacao, _errors: errs }
    })

    // Match brands (fetch from current models state — brands are embedded)
    const brandMap = new Map<string, string>() // name.lower → id
    models.forEach(m => {
      const b = (m as any).brands
      if (b) brandMap.set(b.name.toLowerCase(), b.id)
    })

    parsed.forEach(row => {
      const bid = brandMap.get(row.marca.toLowerCase())
      if (!bid) row._errors.push(`Marca "${row.marca}" não encontrada`)
      else row._brandId = bid
    })

    setImportRows(parsed)
    setImportDone(false)
  }

  async function runImport() {
    setImportSaving(true)
    const validRows = importRows.filter(r => r._errors.length === 0)
    let inserted = 0
    let errors = 0

    // Step 1: upsert models (brand_id + name) and collect their IDs
    const modelKey = (brandId: string, name: string) => `${brandId}|${name.toLowerCase()}`
    const modelIdMap = new Map<string, string>() // key → id

    // Pre-populate from existing models
    models.forEach(m => modelIdMap.set(modelKey(m.brand_id, m.name), m.id))

    // Find models that need to be created
    const toCreateModels = validRows
      .filter(r => r._brandId && !modelIdMap.has(modelKey(r._brandId!, r.modelo)))
      .reduce((acc, r) => {
        const key = modelKey(r._brandId!, r.modelo)
        if (!acc.has(key)) acc.set(key, { brand_id: r._brandId!, name: r.modelo, tracking_type: importTrackingType })
        return acc
      }, new Map<string, any>())

    for (const [key, payload] of toCreateModels.entries()) {
      const { data, error } = await supabase
        .from('equipment_models')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        // Maybe it already exists (race condition) — try to fetch
        const { data: existing } = await supabase
          .from('equipment_models')
          .select('id')
          .eq('brand_id', payload.brand_id)
          .eq('name', payload.name)
          .single()
        if (existing) modelIdMap.set(key, existing.id)
      } else if (data) {
        modelIdMap.set(key, data.id)
      }
    }

    // Step 2: insert equipment
    for (const row of validRows) {
      if (!row._brandId) { errors++; continue }
      const key = modelKey(row._brandId, row.modelo)
      const modelId = modelIdMap.get(key)
      if (!modelId) { errors++; continue }

      const year = parseInt(row.fabricacao)
      const { error: insertErr } = await supabase.from('equipment').insert({
        code: row.identificacao.trim().toUpperCase(),
        name: row.identificacao.trim(),
        model_id: modelId,
        branch_id: row.localizacao.trim(),
        year: isNaN(year) ? null : year,
        serial_number: row.chassi.trim() || null,
        active: true,
      })

      if (insertErr) errors++
      else inserted++
    }

    setImportResult({ inserted, errors })
    setImportSaving(false)
    setImportDone(true)
    if (inserted > 0) loadData()
  }

  function downloadTemplate() {
    const header = 'IDENTIFICAÇÃO,MARCA,MODELO,FABRICAÇÃO,CHASSI,LOCALIZAÇÃO ATUAL'
    const example = 'JD750J-001,John Deere,750J,2020,ABC123DEF,xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template_equipamentos.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Derived ──

  const brands = Array.from(
    new Map(
      models.map(m => [(m as any).brands?.id, (m as any).brands])
    ).entries()
  ).filter(([id]) => id).map(([, b]) => b as { id: string; name: string })

  const filteredModels = filterBrand
    ? models.filter(m => (m as any).brands?.id === filterBrand)
    : models

  const filtered = equipment.filter(e => {
    const q = search.toLowerCase()
    if (q && !(
      e.code.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      (e.serial_number ?? '').toLowerCase().includes(q) ||
      ((e.equipment_models as any)?.brands?.name ?? '').toLowerCase().includes(q) ||
      (e.equipment_models?.name ?? '').toLowerCase().includes(q) ||
      ((e as any).branches?.name ?? '').toLowerCase().includes(q)
    )) return false
    if (filterBranch && e.branch_id !== filterBranch) return false
    if (filterBrand && (e.equipment_models as any)?.brands?.id !== filterBrand) return false
    if (filterModel && e.model_id !== filterModel) return false
    if (filterStatus === 'active' && !e.active) return false
    if (filterStatus === 'inactive' && e.active) return false
    return true
  })

  const hasFilters = search || filterBranch || filterBrand || filterModel || filterStatus !== 'active'

  function clearFilters() {
    setSearch(''); setFilterBranch(''); setFilterBrand(''); setFilterModel(''); setFilterStatus('active')
  }

  const isAdmin = profile?.role === 'admin_geral' || profile?.role === 'admin_local'
  const validCount = importRows.filter(r => r._errors.length === 0).length
  const errorCount = importRows.filter(r => r._errors.length > 0).length

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            Equipamentos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} equipamento{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn-secondary" onClick={() => { setImportRows([]); setImportDone(false); setShowImport(true) }}>
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Novo
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card py-4 px-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Buscar por código, nome, S/N, marca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {profile?.role === 'admin_geral' && (
            <select className="input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">Todas as filiais</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} – {b.city}/{b.state}</option>)}
            </select>
          )}

          <select
            className="input"
            value={filterBrand}
            onChange={e => { setFilterBrand(e.target.value); setFilterModel('') }}
          >
            <option value="">Todas as marcas</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select className="input" value={filterModel} onChange={e => setFilterModel(e.target.value)}>
            <option value="">Todos os modelos</option>
            {filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Todos os status</option>
            <option value="active">Somente ativos</option>
            <option value="inactive">Somente inativos</option>
          </select>
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

      {/* Edit/Create Modal */}
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

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Importar Equipamentos via CSV</h3>
                <p className="text-xs text-gray-400 mt-0.5">Colunas: IDENTIFICAÇÃO · MARCA · MODELO · FABRICAÇÃO · CHASSI · LOCALIZAÇÃO ATUAL (UUID)</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

              {/* Step 1: upload + config */}
              {!importDone && (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="label">Tipo de medição padrão para modelos novos</label>
                    <select className="input w-52" value={importTrackingType} onChange={e => setImportTrackingType(e.target.value as any)}>
                      <option value="hours">Horímetro (horas)</option>
                      <option value="km">Odômetro (km)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={downloadTemplate}>
                      <Download className="w-4 h-4" /> Template CSV
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" /> Selecionar arquivo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              )}

              {/* Result after import */}
              {importDone && (
                <div className={`rounded-xl px-5 py-4 flex items-center gap-3 ${importResult.errors === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <CheckCircle2 className={`w-6 h-6 flex-shrink-0 ${importResult.errors === 0 ? 'text-green-600' : 'text-yellow-600'}`} />
                  <div>
                    <p className="font-semibold text-gray-800">{importResult.inserted} equipamento{importResult.inserted !== 1 ? 's' : ''} importado{importResult.inserted !== 1 ? 's' : ''} com sucesso</p>
                    {importResult.errors > 0 && <p className="text-sm text-yellow-700">{importResult.errors} linha{importResult.errors !== 1 ? 's' : ''} com erro foram ignoradas</p>}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {importRows.length > 0 && !importDone && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-4 h-4" /> {validCount} válido{validCount !== 1 ? 's' : ''}</span>
                    {errorCount > 0 && <span className="flex items-center gap-1 text-red-600"><AlertCircle className="w-4 h-4" /> {errorCount} com erro</span>}
                  </div>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500 w-6">#</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Identificação</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Marca</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Modelo</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Ano</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Chassi</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500 w-48">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importRows.map((row, i) => (
                          <tr key={i} className={row._errors.length > 0 ? 'bg-red-50' : 'bg-white'}>
                            <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{row.identificacao}</td>
                            <td className="px-3 py-2">{row.marca}</td>
                            <td className="px-3 py-2">{row.modelo}</td>
                            <td className="px-3 py-2">{row.fabricacao}</td>
                            <td className="px-3 py-2 font-mono">{row.chassi}</td>
                            <td className="px-3 py-2">
                              {row._errors.length === 0
                                ? <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" /> OK</span>
                                : <span className="flex items-start gap-1 text-red-600"><AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{row._errors.join('; ')}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 bg-gray-50 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                {importRows.length > 0 && !importDone
                  ? `${importRows.length} linha${importRows.length !== 1 ? 's' : ''} carregada${importRows.length !== 1 ? 's' : ''} · ${validCount} serão importadas`
                  : 'Exporte sua planilha como CSV (UTF-8) e selecione o arquivo'}
              </p>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setShowImport(false)}>
                  {importDone ? 'Fechar' : 'Cancelar'}
                </button>
                {!importDone && validCount > 0 && (
                  <button
                    className="btn-primary"
                    onClick={runImport}
                    disabled={importSaving}
                  >
                    {importSaving ? 'Importando...' : `Importar ${validCount} equipamento${validCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
