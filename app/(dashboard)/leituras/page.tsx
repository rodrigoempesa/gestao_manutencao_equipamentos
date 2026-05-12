'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, Reading } from '@/lib/types'
import { formatReading } from '@/lib/types'
import { todayISO, trackingLabel, formatDate } from '@/lib/utils'
import { Gauge, Save, Check, AlertTriangle, History } from 'lucide-react'

interface EquipmentRow {
  equipment: Equipment
  lastReading: Reading | null
  todayReading: Reading | null
  inputValue: string
  notes: string
  saved: boolean
  error: string
}

export default function LeiturasPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ role: string; branch_id: string | null } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ equipment: Equipment; readings: Reading[] } | null>(null)

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

    const ids = equipments.map(e => e.id)

    // Last readings (any date)
    const { data: lastReadings } = await supabase
      .from('readings')
      .select('*')
      .in('equipment_id', ids)
      .order('reading_date', { ascending: false })

    // Today's readings
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

  const trackType = (row: EquipmentRow) =>
    row.equipment.equipment_models?.tracking_type ?? 'hours'

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
              {/* Equipment info */}
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

              {/* Input + actions */}
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
            {/* Mobile notes */}
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
    </div>
  )
}
