'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, Reading } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { todayISO, trackingLabel, formatDate } from '@/lib/utils'
import { Gauge, Save, Check, AlertTriangle, History, ListPlus, Plus, Trash2, X, CheckCircle2 } from 'lucide-react'

interface EquipmentRow {
  equipment: Equipment
  lastReading: Reading | null
  todayReading: Reading | null
  inputValue: string
  notes: string
  saved: boolean
  error: string
}

interface BatchEntry {
  _key: string
  date: string
  value: string
  notes: string
  status: 'pending' | 'ok' | 'error'
  errorMsg: string
}

function newEntry(defaultDate: string): BatchEntry {
  return { _key: Math.random().toString(36).slice(2), date: defaultDate, value: '', notes: '', status: 'pending', errorMsg: '' }
}

export default function LeiturasPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ role: string; branch_id: string | null } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ equipment: Equipment; readings: Reading[] } | null>(null)
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([])

  // Batch modal state
  const [showBatch, setShowBatch] = useState(false)
  const [batchEquipId, setBatchEquipId] = useState('')
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([newEntry(todayISO())])
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchDone, setBatchDone] = useState(false)
  const [batchResult, setBatchResult] = useState({ ok: 0, errors: 0 })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single()

    if (!prof) return
    setProfile(prof)

    let equipQuery = supabase
      .from('equipment')
      .select('*, equipment_models(*, brands(*)), branches(*)')
      .eq('active', true)
      .order('code')

    if (prof.role !== 'admin_geral' && prof.branch_id) {
      equipQuery = equipQuery.eq('branch_id', prof.branch_id)
    }

    const { data: equipments } = await equipQuery

    if (!equipments) { setLoading(false); return }

    setAllEquipment(equipments as Equipment[])

    const ids = equipments.map(e => e.id)

    const { data: lastReadings } = await supabase
      .from('readings')
      .select('*')
      .in('equipment_id', ids)
      .order('reading_date', { ascending: false })

    const { data: todayReadings } = await supabase
      .from('readings')
      .select('*')
      .in('equipment_id', ids)
      .eq('reading_date', date)

    const lastMap: Record<string, Reading> = {}
    if (lastReadings) {
      for (const r of lastReadings) {
        if (!lastMap[r.equipment_id]) lastMap[r.equipment_id] = r
      }
    }
    const todayMap: Record<string, Reading> = {}
    if (todayReadings) {
      for (const r of todayReadings) todayMap[r.equipment_id] = r
    }

    setRows(equipments.map(eq => ({
      equipment: eq as Equipment,
      lastReading: lastMap[eq.id] ?? null,
      todayReading: todayMap[eq.id] ?? null,
      inputValue: todayMap[eq.id] ? String(todayMap[eq.id].reading_value) : '',
      notes: todayMap[eq.id]?.notes ?? '',
      saved: !!todayMap[eq.id],
      error: '',
    })))
    setLoading(false)
  }, [date, supabase])

  useEffect(() => { loadData() }, [loadData])

  function updateRow(id: string, patch: Partial<EquipmentRow>) {
    setRows(rows => rows.map(r => r.equipment.id === id ? { ...r, ...patch } : r))
  }

  async function saveReading(row: EquipmentRow) {
    const val = parseFloat(row.inputValue)
    if (isNaN(val)) {
      updateRow(row.equipment.id, { error: 'Valor inválido' })
      return
    }
    if (row.lastReading && val < row.lastReading.reading_value && row.equipment.equipment_models?.tracking_type !== 'km') {
      updateRow(row.equipment.id, { error: `Valor menor que a última leitura (${row.lastReading.reading_value})` })
      return
    }

    setSaving(row.equipment.id)
    updateRow(row.equipment.id, { error: '' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      equipment_id: row.equipment.id,
      reading_value: val,
      reading_date: date,
      notes: row.notes || null,
      created_by: user.id,
    }

    let error
    if (row.todayReading) {
      const res = await supabase
        .from('readings')
        .update({ reading_value: val, notes: row.notes || null })
        .eq('id', row.todayReading.id)
      error = res.error
    } else {
      const res = await supabase.from('readings').insert(payload)
      error = res.error
    }

    if (error) {
      updateRow(row.equipment.id, { error: error.message })
    } else {
      updateRow(row.equipment.id, {
        saved: true,
        todayReading: { ...payload, id: row.todayReading?.id ?? '', created_at: new Date().toISOString() } as Reading,
      })
    }
    setSaving(null)
  }

  async function openHistory(equipment: Equipment) {
    const { data } = await supabase
      .from('readings')
      .select('*')
      .eq('equipment_id', equipment.id)
      .order('reading_date', { ascending: false })
      .limit(30)
    setHistoryModal({ equipment, readings: data ?? [] })
  }

  function openBatch() {
    setBatchEquipId('')
    setBatchEntries([newEntry(todayISO())])
    setBatchDone(false)
    setBatchResult({ ok: 0, errors: 0 })
    setShowBatch(true)
  }

  function updateEntry(key: string, patch: Partial<BatchEntry>) {
    setBatchEntries(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e))
  }

  function addEntry() {
    const lastDate = batchEntries[batchEntries.length - 1]?.date ?? todayISO()
    setBatchEntries(prev => [...prev, newEntry(lastDate)])
  }

  function removeEntry(key: string) {
    setBatchEntries(prev => prev.filter(e => e._key !== key))
  }

  async function saveBatch() {
    if (!batchEquipId) return
    setBatchSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBatchSaving(false); return }

    // Sort entries by date ascending for sequential validation
    const sorted = [...batchEntries].sort((a, b) => a.date.localeCompare(b.date))

    // Get the last reading before the earliest date in the batch
    const earliestDate = sorted[0]?.date
    const { data: priorReadings } = await supabase
      .from('readings')
      .select('*')
      .eq('equipment_id', batchEquipId)
      .lt('reading_date', earliestDate)
      .order('reading_date', { ascending: false })
      .limit(1)

    const equip = allEquipment.find(e => e.id === batchEquipId)!
    const isKm = equip.equipment_models?.tracking_type === 'km'
    let prevValue = priorReadings?.[0]?.reading_value ?? null

    let okCount = 0
    let errCount = 0

    for (const entry of sorted) {
      const val = parseFloat(entry.value)
      if (isNaN(val) || !entry.date) {
        updateEntry(entry._key, { status: 'error', errorMsg: 'Data ou valor inválido' })
        errCount++
        continue
      }
      if (!isKm && prevValue !== null && val < prevValue) {
        updateEntry(entry._key, { status: 'error', errorMsg: `Valor ${val} menor que leitura anterior (${prevValue})` })
        errCount++
        continue
      }

      const { error } = await supabase.from('readings').upsert({
        equipment_id: batchEquipId,
        reading_value: val,
        reading_date: entry.date,
        notes: entry.notes || null,
        created_by: user.id,
      }, { onConflict: 'equipment_id,reading_date' })

      if (error) {
        updateEntry(entry._key, { status: 'error', errorMsg: error.message })
        errCount++
      } else {
        updateEntry(entry._key, { status: 'ok', errorMsg: '' })
        prevValue = val
        okCount++
      }
    }

    setBatchResult({ ok: okCount, errors: errCount })
    setBatchDone(true)
    setBatchSaving(false)
    if (okCount > 0) loadData()
  }

  const trackType = (row: EquipmentRow) =>
    row.equipment.equipment_models?.tracking_type ?? 'hours'

  const batchEquip = allEquipment.find(e => e.id === batchEquipId)
  const isAdmin = profile?.role === 'admin_geral'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Carregando equipamentos...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-600" />
            Leituras
          </h1>
          <p className="text-gray-500 text-sm mt-1">Informe o horímetro ou odômetro de cada equipamento</p>
        </div>
        <div className="flex items-end gap-3">
          {isAdmin && (
            <button className="btn-secondary" onClick={openBatch}>
              <ListPlus className="w-4 h-4" /> Leituras em Lote
            </button>
          )}
          <div>
            <label className="label">Data da leitura</label>
            <input
              type="date"
              className="input"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="card text-center text-gray-400 py-16">
          Nenhum equipamento encontrado para sua filial.
        </div>
      )}

      <div className="space-y-3">
        {rows.map(row => (
          <div
            key={row.equipment.id}
            className={`card p-4 border-l-4 ${
              row.saved
                ? 'border-l-green-500'
                : row.error
                ? 'border-l-red-400'
                : 'border-l-gray-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">{row.equipment.code}</span>
                  <span className="text-gray-600 truncate">{row.equipment.name}</span>
                  {row.saved && (
                    <span className="badge-green flex items-center gap-1">
                      <Check className="w-3 h-3" /> Salvo
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {row.equipment.equipment_models?.brands?.name} {row.equipment.equipment_models?.name}
                  {' · '}
                  {trackingLabel(trackType(row))}
                  {row.lastReading && (
                    <> · Última: <strong>{formatReading(row.lastReading.reading_value, trackType(row))}</strong> em {formatDate(row.lastReading.reading_date)}</>
                  )}
                </div>
                {row.error && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {row.error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    className="input w-36 font-mono text-right"
                    placeholder="Ex: 1250.5"
                    value={row.inputValue}
                    onChange={e => updateRow(row.equipment.id, { inputValue: e.target.value, saved: false, error: '' })}
                    onKeyDown={e => { if (e.key === 'Enter') saveReading(row) }}
                  />
                </div>
                <input
                  type="text"
                  className="input w-40 hidden sm:block"
                  placeholder="Observação (opcional)"
                  value={row.notes}
                  onChange={e => updateRow(row.equipment.id, { notes: e.target.value })}
                />
                <button
                  className="btn-primary flex-shrink-0"
                  onClick={() => saveReading(row)}
                  disabled={saving === row.equipment.id || !row.inputValue}
                >
                  {saving === row.equipment.id
                    ? '...'
                    : <><Save className="w-4 h-4" /><span className="hidden sm:inline">Salvar</span></>
                  }
                </button>
                <button
                  className="btn-secondary flex-shrink-0"
                  title="Histórico"
                  onClick={() => openHistory(row.equipment)}
                >
                  <History className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              type="text"
              className="input mt-2 sm:hidden"
              placeholder="Observação (opcional)"
              value={row.notes}
              onChange={e => updateRow(row.equipment.id, { notes: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold">{historyModal.equipment.code} – {historyModal.equipment.name}</h3>
                <p className="text-xs text-gray-400">Últimas 30 leituras</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setHistoryModal(null)}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyModal.readings.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nenhuma leitura registrada</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Data</th>
                      <th className="table-header text-right">Leitura</th>
                      <th className="table-header">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyModal.readings.map(r => (
                      <tr key={r.id}>
                        <td className="table-cell">{formatDate(r.reading_date)}</td>
                        <td className="table-cell font-mono text-right font-semibold">
                          {formatReading(r.reading_value, historyModal.equipment.equipment_models?.tracking_type ?? 'hours')}
                        </td>
                        <td className="table-cell text-gray-400 text-xs">{r.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t">
              <button className="btn-secondary w-full" onClick={() => setHistoryModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Readings Modal — admin_geral only */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-blue-600" /> Leituras em Lote
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Adicione várias leituras para um equipamento em datas diferentes</p>
              </div>
              <button onClick={() => setShowBatch(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Equipment selector */}
              <div>
                <label className="label">Equipamento *</label>
                <select
                  className="input"
                  value={batchEquipId}
                  onChange={e => { setBatchEquipId(e.target.value); setBatchDone(false); setBatchEntries([newEntry(todayISO())]) }}
                  disabled={batchDone}
                >
                  <option value="">Selecione o equipamento...</option>
                  {allEquipment.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} — {eq.name} ({(eq as any).branches?.name ?? ''})
                    </option>
                  ))}
                </select>
                {batchEquip && (
                  <p className="text-xs text-gray-400 mt-1">
                    {(batchEquip as any).equipment_models?.brands?.name} {batchEquip.equipment_models?.name}
                    {' · '}{trackingLabel(batchEquip.equipment_models?.tracking_type ?? 'hours')}
                  </p>
                )}
              </div>

              {/* Result banner */}
              {batchDone && (
                <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${batchResult.errors === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${batchResult.errors === 0 ? 'text-green-600' : 'text-yellow-500'}`} />
                  <p className="text-sm font-medium">
                    {batchResult.ok} leitura{batchResult.ok !== 1 ? 's' : ''} salva{batchResult.ok !== 1 ? 's' : ''}
                    {batchResult.errors > 0 && ` · ${batchResult.errors} com erro (veja abaixo)`}
                  </p>
                </div>
              )}

              {/* Entries table */}
              {batchEquipId && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-44">Data</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-36">
                          Leitura ({batchEquip?.equipment_models?.tracking_type === 'km' ? 'km' : 'h'})
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Observação</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {batchEntries.map(entry => (
                        <tr key={entry._key} className={
                          entry.status === 'ok' ? 'bg-green-50' :
                          entry.status === 'error' ? 'bg-red-50' : 'bg-white'
                        }>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              className="input py-1 text-sm"
                              value={entry.date}
                              max={todayISO()}
                              disabled={batchDone}
                              onChange={e => updateEntry(entry._key, { date: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              className="input py-1 text-sm font-mono w-28"
                              placeholder="0.0"
                              value={entry.value}
                              disabled={batchDone}
                              onChange={e => updateEntry(entry._key, { value: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-2">
                            {entry.status === 'error' ? (
                              <span className="text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{entry.errorMsg}
                              </span>
                            ) : entry.status === 'ok' ? (
                              <span className="text-xs text-green-700 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Salvo
                              </span>
                            ) : (
                              <input
                                type="text"
                                className="input py-1 text-sm"
                                placeholder="Opcional"
                                value={entry.notes}
                                onChange={e => updateEntry(entry._key, { notes: e.target.value })}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {!batchDone && batchEntries.length > 1 && (
                              <button
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                onClick={() => removeEntry(entry._key)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!batchDone && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        onClick={addEntry}
                      >
                        <Plus className="w-3 h-3" /> Adicionar linha
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 bg-gray-50 flex justify-between items-center gap-4">
              <p className="text-xs text-gray-400">
                {!batchDone && batchEquipId
                  ? `${batchEntries.length} leitura${batchEntries.length !== 1 ? 's' : ''} a salvar · ordenadas por data automaticamente`
                  : !batchEquipId ? 'Selecione o equipamento para começar' : ''}
              </p>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setShowBatch(false)}>
                  {batchDone ? 'Fechar' : 'Cancelar'}
                </button>
                {!batchDone && batchEquipId && (
                  <button
                    className="btn-primary"
                    onClick={saveBatch}
                    disabled={batchSaving || batchEntries.every(e => !e.value)}
                  >
                    {batchSaving ? 'Salvando...' : `Salvar ${batchEntries.length} leitura${batchEntries.length !== 1 ? 's' : ''}`}
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
