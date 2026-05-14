'use client'

import { useState, useMemo } from 'react'
import type { EquipmentStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 15

export default function EquipmentStatusTable({
  list,
  isAdminGeral,
}: {
  list: EquipmentStatus[]
  isAdminGeral: boolean
}) {
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [page, setPage] = useState(1)

  const branches = useMemo(() => {
    const map = new Map<string, { name: string; city: string; state: string }>()
    list.forEach(e => {
      if (e.branch_id && e.branch_name) {
        map.set(e.branch_id, { name: e.branch_name, city: e.branch_city ?? '', state: e.branch_state ?? '' })
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'))
  }, [list])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list.filter(e => {
      if (q && !(
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q)
      )) return false
      if (filterBranch && e.branch_id !== filterBranch) return false
      return true
    })
  }, [list, search, filterBranch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasFilters = search || filterBranch

  function clearFilters() {
    setSearch(''); setFilterBranch(''); setPage(1)
  }

  function handleSearch(v: string) { setSearch(v); setPage(1) }
  function handleBranch(v: string) { setFilterBranch(v); setPage(1) }

  const statusMap = {
    overdue: <span className="badge-red">Vencido</span>,
    warning: <span className="badge-yellow">Atenção</span>,
    ok: <span className="badge-green">OK</span>,
    no_data: <span className="badge-gray">Sem dados</span>,
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header + Filters */}
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Status dos Equipamentos</h2>
          <span className="text-sm text-gray-400">
            {filtered.length !== list.length
              ? `${filtered.length} de ${list.length} equipamentos`
              : `${list.length} equipamentos`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 py-1.5 text-sm"
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {isAdminGeral && (
            <select
              className="input py-1.5 text-sm w-56"
              value={filterBranch}
              onChange={e => handleBranch(e.target.value)}
            >
              <option value="">Todas as filiais</option>
              {branches.map(([id, b]) => (
                <option key={id} value={id}>{b.name} — {b.city}/{b.state}</option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 flex-shrink-0"
              onClick={clearFilters}
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-header">Código / Nome</th>
              <th className="table-header">Filial</th>
              <th className="table-header">Leitura Atual</th>
              <th className="table-header">Acum. desde rev.</th>
              <th className="table-header">Última Leitura</th>
              <th className="table-header">Média/dia</th>
              <th className="table-header">Última Manut.</th>
              <th className="table-header">Próx. Manut.</th>
              <th className="table-header">Previsão</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="table-cell text-center text-gray-400 py-12">
                  {hasFilters ? 'Nenhum equipamento encontrado para os filtros aplicados' : 'Nenhum equipamento cadastrado'}
                </td>
              </tr>
            )}
            {paginated.map(eq => {
              const status = getMaintenanceStatus(eq)
              const days = getDaysUntilMaintenance(eq)
              return (
                <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <p className="font-semibold text-gray-900">{eq.code}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[140px]">{eq.name}</p>
                  </td>
                  <td className="table-cell">
                    <p className="text-sm">{eq.branch_name}</p>
                    <p className="text-xs text-gray-400">{eq.branch_city}/{eq.branch_state}</p>
                  </td>
                  <td className="table-cell font-mono font-semibold">
                    {formatReading(eq.current_reading, eq.tracking_type)}
                  </td>
                  <td className="table-cell">
                    {eq.accumulated_since_maintenance !== null ? (
                      <span className={`font-mono font-semibold ${
                        eq.next_maintenance_interval &&
                        eq.accumulated_since_maintenance >= eq.next_maintenance_interval * 0.9
                          ? 'text-red-600'
                          : eq.accumulated_since_maintenance >= eq.next_maintenance_interval! * 0.7
                          ? 'text-yellow-600'
                          : 'text-gray-700'
                      }`}>
                        {formatReading(eq.accumulated_since_maintenance, eq.tracking_type)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="table-cell text-gray-500">{formatDate(eq.last_reading_date)}</td>
                  <td className="table-cell text-gray-500">
                    {eq.daily_avg ? formatReading(eq.daily_avg, eq.tracking_type) : '-'}
                  </td>
                  <td className="table-cell">
                    {eq.last_maintenance_date ? (
                      <div>
                        <p className="text-sm">{formatDate(eq.last_maintenance_date)}</p>
                        <p className="text-xs text-gray-400">{eq.last_maintenance_plan_name}</p>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell">
                    {eq.next_maintenance_plan_name ? (
                      <div>
                        <p className="text-sm font-medium">{eq.next_maintenance_plan_name}</p>
                        <p className="text-xs text-gray-400">em {formatReading(eq.next_maintenance_interval, eq.tracking_type)}</p>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell">
                    {days !== null ? (
                      <span className={days < 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                        {days < 0 ? `${Math.abs(days)}d vencido` : `${days} dias`}
                      </span>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell">{statusMap[status]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">
            Página {safePage} de {totalPages} · {filtered.length} equipamentos
          </p>
          <div className="flex items-center gap-1">
            <button
              className="btn-secondary py-1 px-2 disabled:opacity-40"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                  : <button
                      key={p}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === safePage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </button>
              )}
            <button
              className="btn-secondary py-1 px-2 disabled:opacity-40"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
