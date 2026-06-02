'use client'

import { useState, useMemo } from 'react'
import type { EquipmentStatus, MaintenanceStatus } from '@/lib/types'
import { getMaintenanceStatus, getDaysUntilMaintenance, getUpcomingWarning, formatReading } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Search, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const PAGE_SIZE = 15

type StatusFilter = MaintenanceStatus | ''

const STATUS_TABS: { key: StatusFilter; label: string; color: string; activeColor: string }[] = [
  { key: '',          label: 'Todos',     color: 'text-gray-600 border-gray-200 hover:border-gray-300',    activeColor: 'bg-gray-700 text-white border-gray-700' },
  { key: 'overdue',   label: 'Vencido',   color: 'text-red-600 border-red-200 hover:border-red-400',       activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'warning',   label: 'Atenção',   color: 'text-yellow-600 border-yellow-200 hover:border-yellow-400', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
  { key: 'ok',        label: 'OK',        color: 'text-green-600 border-green-200 hover:border-green-400', activeColor: 'bg-green-600 text-white border-green-600' },
  { key: 'os_aberta', label: 'OS Aberta', color: 'text-blue-600 border-blue-200 hover:border-blue-400',   activeColor: 'bg-blue-600 text-white border-blue-600' },
  { key: 'no_data',   label: 'Sem Dados', color: 'text-gray-500 border-gray-200 hover:border-gray-300',   activeColor: 'bg-gray-500 text-white border-gray-500' },
]

export default function EquipmentStatusTable({
  list,
  isAdminGeral,
  initialStatus = '',
}: {
  list: EquipmentStatus[]
  isAdminGeral: boolean
  initialStatus?: StatusFilter
}) {
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(initialStatus)
  const [page, setPage] = useState(1)

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': list.length, overdue: 0, warning: 0, ok: 0, os_aberta: 0, no_data: 0 }
    list.forEach(e => { counts[getMaintenanceStatus(e)]++ })
    return counts
  }, [list])

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
      if (q && !(e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))) return false
      if (filterBranch && e.branch_id !== filterBranch) return false
      if (filterStatus && getMaintenanceStatus(e) !== filterStatus) return false
      return true
    })
  }, [list, search, filterBranch, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasFilters = search || filterBranch || filterStatus

  function clearFilters() { setSearch(''); setFilterBranch(''); setFilterStatus(''); setPage(1) }
  function handleSearch(v: string) { setSearch(v); setPage(1) }
  function handleBranch(v: string) { setFilterBranch(v); setPage(1) }
  function handleStatus(v: StatusFilter) { setFilterStatus(v); setPage(1) }

  const statusBadge = (eq: EquipmentStatus) => {
    const status = getMaintenanceStatus(eq)
    if (status === 'os_aberta') return (
      <a href={`/os/${eq.active_os_id}`} className="badge-blue hover:underline" title={`OS ${eq.active_os_number}`}>
        OS {eq.active_os_number}
      </a>
    )
    if (status === 'overdue') return <span className="badge-red">Vencido</span>
    if (status === 'warning') return <span className="badge-yellow">Atenção</span>
    if (status === 'ok') return <span className="badge-green">OK</span>
    return <span className="badge-gray">Sem dados</span>
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

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleStatus(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filterStatus === tab.key ? tab.activeColor : tab.color + ' bg-white'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                filterStatus === tab.key ? 'bg-white/20 text-inherit' : 'bg-gray-100 text-gray-500'
              }`}>
                {statusCounts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Branch */}
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
                <option key={id} value={id}>{b.name}</option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 flex-shrink-0"
              onClick={clearFilters}
            >
              <X className="w-3 h-3" /> Limpar filtros
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
              const days = status === 'os_aberta' || status === 'overdue' ? null : getDaysUntilMaintenance(eq)
              const overageReading = status === 'overdue' && eq.current_reading !== null && eq.next_maintenance_threshold !== null
                ? eq.current_reading - eq.next_maintenance_threshold
                : null
              const upcoming = status === 'os_aberta' ? null : getUpcomingWarning(eq)
              const relInterval = eq.next_maintenance_threshold !== null && eq.last_maintenance_reading !== null
                ? eq.next_maintenance_threshold - eq.last_maintenance_reading
                : eq.next_maintenance_threshold
              return (
                <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <p className="font-semibold text-gray-900 whitespace-nowrap">{eq.code}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[140px]">{eq.name}</p>
                  </td>
                  <td className="table-cell whitespace-nowrap" title={`${eq.branch_city}/${eq.branch_state}`}>
                    {eq.branch_name ?? '-'}
                  </td>
                  <td className="table-cell font-mono font-semibold whitespace-nowrap">
                    {formatReading(eq.current_reading, eq.tracking_type)}
                  </td>
                  <td className="table-cell whitespace-nowrap">
                    {eq.accumulated_since_maintenance !== null && relInterval ? (
                      <span className={`font-mono font-semibold ${
                        eq.accumulated_since_maintenance >= relInterval * 0.9
                          ? 'text-red-600'
                          : eq.accumulated_since_maintenance >= relInterval * 0.7
                          ? 'text-yellow-600'
                          : 'text-gray-700'
                      }`}>
                        {formatReading(eq.accumulated_since_maintenance, eq.tracking_type)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="table-cell text-gray-500 whitespace-nowrap">{formatDate(eq.last_reading_date)}</td>
                  <td className="table-cell text-gray-500 whitespace-nowrap">
                    {eq.daily_avg ? formatReading(eq.daily_avg, eq.tracking_type) : '-'}
                  </td>
                  <td className="table-cell whitespace-nowrap" title={eq.last_maintenance_plan_name ?? undefined}>
                    {eq.last_maintenance_date ? formatDate(eq.last_maintenance_date) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell" title={eq.next_maintenance_plan_name ? `limite: ${formatReading(eq.next_maintenance_threshold, eq.tracking_type)}` : undefined}>
                    {eq.next_maintenance_plan_name ? (
                      <p className="text-xs font-medium leading-tight line-clamp-3 max-w-[140px]">{eq.next_maintenance_plan_name}</p>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell whitespace-nowrap">
                    {overageReading !== null ? (
                      <span className="text-red-600 font-semibold">
                        +{formatReading(overageReading, eq.tracking_type)} vencidas
                      </span>
                    ) : days !== null ? (
                      <span className="text-gray-700">{days} dias</span>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(eq)}
                      {upcoming && (
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-orange-500 flex-shrink-0"
                          title={`Próx. revisão: faltam ${formatReading(upcoming.remaining, eq.tracking_type)} para ${upcoming.planName} (limite: ${formatReading(upcoming.threshold, eq.tracking_type)})`}
                        />
                      )}
                      {(status === 'overdue' || status === 'warning') && eq.next_maintenance_plan_id && (
                        <Link
                          href={`/os?equipment=${eq.id}&plan=${eq.next_maintenance_plan_id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                          title={`Abrir OS para ${eq.next_maintenance_plan_name ?? 'a próxima revisão'}`}
                        >
                          Abrir OS
                        </Link>
                      )}
                    </div>
                  </td>
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
