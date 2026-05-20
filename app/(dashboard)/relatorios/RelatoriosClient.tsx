'use client'

import { useState, useMemo } from 'react'
import { formatDate } from '@/lib/utils'
import { Download, Clock, Database, AlertTriangle } from 'lucide-react'

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

  const lateReadings = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - daysFilter)

    return statusList
      .filter(eq => {
        if (!eq.last_reading_date) return true
        return new Date(eq.last_reading_date) < cutoff
      })
      .sort((a, b) => {
        if (!a.last_reading_date && !b.last_reading_date) return a.code.localeCompare(b.code, 'pt-BR')
        if (!a.last_reading_date) return -1
        if (!b.last_reading_date) return 1
        return new Date(a.last_reading_date).getTime() - new Date(b.last_reading_date).getTime()
      })
  }, [statusList, daysFilter])

  const tabs = [
    { key: 'leituras' as Tab, label: 'Leituras Atrasadas', icon: Clock, count: null },
    { key: 'horimetro' as Tab, label: 'Sem Horímetro Inicial', icon: Database, count: noInitialList.length },
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

      {/* Tabs */}
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
                    <tr key={eq.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <p className="font-semibold text-gray-900">{eq.code}</p>
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
              {noInitialList.length} equipamento{noInitialList.length !== 1 ? 's' : ''} sem horímetro inicial cadastrado
            </span>
            <button
              onClick={() => downloadCsv(
                'sem_horimetro_inicial.csv',
                ['Código', 'Nome', 'Filial', 'Cidade', 'Estado', 'Marca', 'Modelo'],
                noInitialList.map((eq: any) => [
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {noInitialList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-cell text-center text-gray-400 py-12">
                      Todos os equipamentos têm horímetro inicial cadastrado
                    </td>
                  </tr>
                ) : noInitialList.map((eq: any) => (
                  <tr key={eq.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900">{eq.code}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">{eq.name}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm">{eq.branches?.name}</p>
                      <p className="text-xs text-gray-400">{eq.branches?.city}/{eq.branches?.state}</p>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      {eq.equipment_models?.brands?.name} {eq.equipment_models?.name}
                    </td>
                  </tr>
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
                ) : noPlansModels.map((m: any) => (
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
