'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Download, Clock, Database, AlertTriangle, Pencil, X, Check, Loader2, EyeOff } from 'lucide-react'

type DaysFilter = 7 | 15 | 30
type Tab = 'leituras' | 'horimetro' | 'planos'

function downloadCsv(filename: string, headers: string[], rows: (string | null | undefined)[][]) {
  const lines = [headers, ...rows].map(r =>
    r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(';')
  )
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function daysSince(dateStr: string | null): { label: string; days: number | null } {
  if (!dateStr) return { label: 'Nunca', days: null }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000)
  return { label: `${days} dias`, days }
}

export default function RelatoriosClient({
  statusList,
  noInitialList,
  noPlansModels,
  isAdminGeral,
}: {
  statusList: any[]
  noInitialList: any[]
  noPlansModels: any[]
  isAdminGeral: boolean
}) {
  const [tab, setTab] = useState<Tab>('leituras')
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(7)
  const [showInactive, setShowInactive] = useState(false)

  // Sem Horímetro Inicial — lista local para remoção ao salvar
  const [pendingList, setPendingList] = useState<any[]>(noInitialList)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ reading: '', date: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const lateReadings = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - daysFilter)

    return statusList
      .filter(eq => {
        if (!showInactive && !eq.active) return false
        if (!eq.last_reading_date) return true
        return new Date(eq.last_reading_date) < cutoff
      })
      .sort((a, b) => {
        const brandCmp = (a.brand_name ?? '').localeCompare(b.brand_name ?? '', 'pt-BR')
        if (brandCmp !== 0) return brandCmp
        if (!a.last_reading_date && !b.last_reading_date) return a.code.localeCompare(b.code, 'pt-BR')
        if (!a.last_reading_date) return -1
        if (!b.last_reading_date) return 1
        return new Date(a.last_reading_date).getTime() - new Date(b.last_reading_date).getTime()
      })
  }, [statusList, daysFilter, showInactive])

  function openEdit(eq: any) {
    setEditingId(eq.id)
    setEditForm({ reading: '', date: '' })
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  async function handleSave(eq: any) {
    if (!editForm.reading || !editForm.date) {
      setSaveError('Preencha o horímetro e a data.')
      return
    }
    const reading = parseFloat(editForm.reading)
    if (isNaN(reading) || reading < 0) {
      setSaveError('Horímetro inválido.')
      return
    }

    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('equipment')
      .update({ initial_reading: reading, initial_reading_date: editForm.date })
      .eq('id', eq.id)

    setSaving(false)
    if (error) {
      setSaveError('Erro ao salvar. Tente novamente.')
      return
    }

    setEditingId(null)
    setPendingList(prev => prev.filter(e => e.id !== eq.id))
  }

  const visiblePending = (showInactive ? pendingList : pendingList.filter(eq => eq.active))
    .slice()
    .sort((a, b) => {
      const brandCmp = (a.equipment_models?.brands?.name ?? '').localeCompare(b.equipment_models?.brands?.name ?? '', 'pt-BR')
      if (brandCmp !== 0) return brandCmp
      return a.code.localeCompare(b.code, 'pt-BR')
    })

  const tabs = [
    { key: 'leituras' as Tab, label: 'Leituras Atrasadas', icon: Clock, count: null },
    { key: 'horimetro' as Tab, label: 'Sem Horímetro Inicial', icon: Database, count: visiblePending.length },
    ...(isAdminGeral
      ? [{ key: 'planos' as Tab, label: 'Modelos Sem Planos', icon: AlertTriangle, count: noPlansModels.length }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">Indicadores operacionais e pendências</p>
      </div>

      {/* Toggle inativos + Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== null && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
        </div>
        <button
          onClick={() => setShowInactive(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showInactive
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          <EyeOff className="w-4 h-4" />
          {showInactive ? 'Mostrando inativos' : 'Incluir inativos'}
        </button>
      </div>

      {/* Leituras Atrasadas */}
      {tab === 'leituras' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {([7, 15, 30] as DaysFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDaysFilter(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    daysFilter === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  +{d} dias
                </button>
              ))}
              <span className="text-sm text-gray-400 ml-2">
                {lateReadings.length} equipamento{lateReadings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => downloadCsv(
                `leituras_atrasadas_${daysFilter}d.csv`,
                ['Código', 'Nome', 'Filial', 'Cidade', 'Estado', 'Última Leitura', 'Dias sem leitura'],
                lateReadings.map(eq => {
                  const ds = daysSince(eq.last_reading_date)
                  return [
                    eq.code, eq.name, eq.branch_name, eq.branch_city, eq.branch_state,
                    eq.last_reading_date ? formatDate(eq.last_reading_date) : 'Nunca',
                    ds.days !== null ? String(ds.days) : 'Nunca',
                  ]
                })
              )}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Código / Nome</th>
                  <th className="table-header">Filial</th>
                  <th className="table-header">Última Leitura</th>
                  <th className="table-header">Dias sem leitura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lateReadings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-cell text-center text-gray-400 py-12">
                      Todos os equipamentos enviaram leitura nos últimos {daysFilter} dias
                    </td>
                  </tr>
                ) : lateReadings.map(eq => {
                  const ds = daysSince(eq.last_reading_date)
                  return (
                    <tr key={eq.id} className={`hover:bg-gray-50 ${!eq.active ? 'opacity-60' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{eq.code}</p>
                          {!eq.active && <span className="badge-gray text-xs">Inativo</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">{eq.name}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{eq.branch_name}</p>
                        <p className="text-xs text-gray-400">{eq.branch_city}/{eq.branch_state}</p>
                      </td>
                      <td className="table-cell text-gray-500">
                        {eq.last_reading_date
                          ? formatDate(eq.last_reading_date)
                          : <span className="badge-gray">Nunca registrada</span>
                        }
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold ${
                          ds.days === null ? 'text-red-600' :
                          ds.days > 30 ? 'text-red-600' :
                          ds.days > 15 ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          {ds.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sem Horímetro Inicial */}
      {tab === 'horimetro' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {visiblePending.length} equipamento{visiblePending.length !== 1 ? 's' : ''} sem horímetro inicial cadastrado
            </span>
            <button
              onClick={() => downloadCsv(
                'sem_horimetro_inicial.csv',
                ['Código', 'Nome', 'Filial', 'Cidade', 'Estado', 'Marca', 'Modelo'],
                visiblePending.map((eq: any) => [
                  eq.code, eq.name,
                  eq.branches?.name, eq.branches?.city, eq.branches?.state,
                  eq.equipment_models?.brands?.name, eq.equipment_models?.name,
                ])
              )}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Código / Nome</th>
                  <th className="table-header">Filial</th>
                  <th className="table-header">Marca / Modelo</th>
                  <th className="table-header w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visiblePending.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-cell text-center text-gray-400 py-12">
                      Todos os equipamentos têm horímetro inicial cadastrado
                    </td>
                  </tr>
                ) : visiblePending.map((eq: any) => (
                  <>
                    <tr key={eq.id} className={`hover:bg-gray-50 ${editingId === eq.id ? 'bg-blue-50' : ''} ${!eq.active ? 'opacity-60' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{eq.code}</p>
                          {!eq.active && <span className="badge-gray text-xs">Inativo</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">{eq.name}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{eq.branches?.name}</p>
                        <p className="text-xs text-gray-400">{eq.branches?.city}/{eq.branches?.state}</p>
                      </td>
                      <td className="table-cell text-sm text-gray-600">
                        {eq.equipment_models?.brands?.name} {eq.equipment_models?.name}
                      </td>
                      <td className="table-cell">
                        {editingId !== eq.id && (
                          <button
                            onClick={() => openEdit(eq)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Preencher
                          </button>
                        )}
                      </td>
                    </tr>
                    {editingId === eq.id && (
                      <tr key={`${eq.id}-form`} className="bg-blue-50 border-t-0">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Horímetro inicial
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                className="input w-36 text-sm py-1.5"
                                placeholder="Ex: 9200"
                                value={editForm.reading}
                                onChange={e => setEditForm(f => ({ ...f, reading: e.target.value }))}
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Data do horímetro
                              </label>
                              <input
                                type="date"
                                className="input w-40 text-sm py-1.5"
                                value={editForm.date}
                                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSave(eq)}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {saving
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Check className="w-4 h-4" />
                                }
                                Salvar
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                <X className="w-4 h-4" /> Cancelar
                              </button>
                            </div>
                            {saveError && (
                              <p className="text-xs text-red-600 w-full">{saveError}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modelos Sem Planos */}
      {tab === 'planos' && isAdminGeral && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {noPlansModels.length} modelo{noPlansModels.length !== 1 ? 's' : ''} sem planos de manutenção vinculados
            </span>
            <button
              onClick={() => downloadCsv(
                'modelos_sem_planos.csv',
                ['Marca', 'Modelo'],
                noPlansModels.map((m: any) => [m.brands?.name, m.name])
              )}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Marca</th>
                  <th className="table-header">Modelo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {noPlansModels.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="table-cell text-center text-gray-400 py-12">
                      Todos os modelos têm planos cadastrados
                    </td>
                  </tr>
                ) : [...noPlansModels].sort((a, b) =>
                    (a.brands?.name ?? '').localeCompare(b.brands?.name ?? '', 'pt-BR') ||
                    a.name.localeCompare(b.name, 'pt-BR')
                  ).map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="table-cell text-sm text-gray-600">{m.brands?.name ?? '-'}</td>
                    <td className="table-cell font-semibold text-gray-900">{m.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
