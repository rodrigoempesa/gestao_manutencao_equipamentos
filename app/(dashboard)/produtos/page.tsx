'use client'

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Plus, Pencil, ToggleLeft, ToggleRight, X, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, History } from 'lucide-react'
import ListTotal from '@/components/ListTotal'
import { formatDate } from '@/lib/utils'

interface PriceHistoryEntry {
  id: string
  quantity: number
  unit_price: number
  request_id: string
  purchase_requests?: { id: string; created_at: string; status: string } | null
}

interface Product {
  id: string
  code: string
  name: string
  unit: string
  current_stock: number
  min_stock: number
  unit_price: number
  category: string | null
  notes: string | null
  active: boolean
}

interface FormState {
  id: string
  code: string
  name: string
  unit: string
  current_stock: string
  min_stock: string
  unit_price: string
  category: string
  notes: string
  active: boolean
}

const UNITS = ['un', 'L', 'mL', 'kg', 'g', 'm', 'cm', 'cx', 'par', 'rolo', 'lt', 'galão', 'tambor']
const PAGE_SIZE = 20

const emptyForm = (): FormState => ({
  id: '', code: '', name: '', unit: 'un',
  current_stock: '0', min_stock: '0', unit_price: '0',
  category: '', notes: '', active: true,
})

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ProdutosPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showStockModal, setShowStockModal] = useState<Product | null>(null)
  const [stockAdjust, setStockAdjust] = useState('')
  const [stockType, setStockType] = useState<'add' | 'remove' | 'set'>('add')

  // Histórico de preços por produto (carregamento sob demanda)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyCache, setHistoryCache] = useState<Record<string, PriceHistoryEntry[]>>({})
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({})

  async function loadHistory(productId: string) {
    if (historyCache[productId]) return
    setHistoryLoading(prev => ({ ...prev, [productId]: true }))
    const { data } = await supabase
      .from('purchase_request_items')
      .select('id, quantity, unit_price, request_id, purchase_requests:request_id(id, created_at, status)')
      .eq('product_id', productId)
      .limit(50)
    const list = (((data ?? []) as any[]) as PriceHistoryEntry[])
      .filter(r => r.purchase_requests?.status === 'concluido')
      .sort((a, b) => (b.purchase_requests?.created_at ?? '').localeCompare(a.purchase_requests?.created_at ?? ''))
      .slice(0, 10)
    setHistoryCache(prev => ({ ...prev, [productId]: list }))
    setHistoryLoading(prev => ({ ...prev, [productId]: false }))
  }

  function toggleExpand(productId: string) {
    if (expandedId === productId) {
      setExpandedId(null)
    } else {
      setExpandedId(productId)
      loadHistory(productId)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      unit: form.unit,
      current_stock: parseFloat(form.current_stock) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    }
    const { error: err } = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id)
      : await supabase.from('products').insert(payload)
    if (err) {
      setError(err.message.includes('unique') ? 'Código já existe.' : err.message)
    } else {
      setShowForm(false)
      loadData()
    }
    setSaving(false)
  }

  async function adjustStock() {
    if (!showStockModal) return
    const val = parseFloat(stockAdjust)
    if (isNaN(val)) return
    let newStock = showStockModal.current_stock
    if (stockType === 'add') newStock += val
    else if (stockType === 'remove') newStock -= val
    else newStock = val
    await supabase.from('products').update({ current_stock: newStock }).eq('id', showStockModal.id)
    setShowStockModal(null)
    setStockAdjust('')
    loadData()
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    loadData()
  }

  const filtered = useMemo(() => products.filter(p =>
    !filter ||
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.code.toLowerCase().includes(filter.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(filter.toLowerCase())
  ), [products, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const lowStock = products.filter(p => p.active && p.current_stock <= p.min_stock && p.min_stock > 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Produtos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-3">
          <input type="text" className="input w-48" placeholder="Buscar..." value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }} />
          <button className="btn-primary" onClick={() => { setForm(emptyForm()); setError(''); setShowForm(true) }}>
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Estoque baixo</p>
            <p className="text-amber-700 text-sm">{lowStock.map(p => p.name).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Código</th>
                <th className="table-header">Nome</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">Unidade</th>
                <th className="table-header text-right">Estoque</th>
                <th className="table-header text-right">Preço Unit.</th>
                <th className="table-header text-right">Valor Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="table-cell text-center text-gray-400 py-12">Nenhum produto encontrado</td></tr>
              )}
              {paginated.map(p => {
                const belowMin = p.active && p.min_stock > 0 && p.current_stock <= p.min_stock
                const isExpanded = expandedId === p.id
                const history = historyCache[p.id]
                const isHistoryLoading = historyLoading[p.id]
                return (
                  <Fragment key={p.id}>
                    <tr className={`hover:bg-gray-50 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                      <td className="table-cell font-mono font-bold">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="inline-flex items-center gap-1 hover:text-blue-600"
                          title="Ver histórico de preços pagos"
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                          <span>{p.code}</span>
                        </button>
                      </td>
                      <td className="table-cell font-medium">{p.name}</td>
                      <td className="table-cell text-gray-500">{p.category ?? '-'}</td>
                      <td className="table-cell">{p.unit}</td>
                      <td className="table-cell text-right">
                        <span className={belowMin ? 'text-red-600 font-bold' : 'font-semibold'}>
                          {p.current_stock.toLocaleString('pt-BR')}
                        </span>
                        {belowMin && <span className="ml-1 badge-red">Baixo</span>}
                      </td>
                      <td className="table-cell text-right font-mono">{formatBRL(p.unit_price)}</td>
                      <td className="table-cell text-right font-mono font-semibold">{formatBRL(p.current_stock * p.unit_price)}</td>
                      <td className="table-cell">{p.active ? <span className="badge-green">Ativo</span> : <span className="badge-gray">Inativo</span>}</td>
                      <td className="table-cell">
                        <div className="flex gap-1.5">
                          <button className="btn-secondary py-1 px-2 text-xs" onClick={() => { setShowStockModal(p); setStockAdjust(''); setStockType('add') }} title="Ajustar estoque">
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-secondary py-1 px-2" onClick={() => { setForm({ id: p.id, code: p.code, name: p.name, unit: p.unit, current_stock: String(p.current_stock), min_stock: String(p.min_stock), unit_price: String(p.unit_price), category: p.category ?? '', notes: p.notes ?? '', active: p.active }); setError(''); setShowForm(true) }}>
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button className={`btn-secondary py-1 px-2 ${p.active ? 'text-red-500' : 'text-green-600'}`} onClick={() => toggleActive(p)}>
                            {p.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            <History className="w-3.5 h-3.5" />
                            Histórico de preços pagos
                            <span className="text-gray-400 font-normal normal-case text-[11px]">
                              · catálogo: {formatBRL(p.unit_price)}
                            </span>
                          </div>
                          {isHistoryLoading ? (
                            <p className="text-xs text-gray-400 py-2">Carregando...</p>
                          ) : !history || history.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">Nenhuma compra concluída registrada para este produto.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 text-[11px]">
                                  <th className="text-left font-medium py-1">Data</th>
                                  <th className="text-right font-medium py-1">Quantidade</th>
                                  <th className="text-right font-medium py-1">Preço pago</th>
                                  <th className="text-right font-medium py-1">Variação</th>
                                  <th className="text-right font-medium py-1">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-100">
                                {history.map((h, idx) => {
                                  const prev = history[idx + 1]
                                  const diff = prev ? h.unit_price - prev.unit_price : null
                                  const pct = diff !== null && prev && prev.unit_price > 0 ? (diff / prev.unit_price) * 100 : null
                                  return (
                                    <tr key={h.id}>
                                      <td className="py-1.5 text-gray-600">{formatDate(h.purchase_requests?.created_at ?? null)}</td>
                                      <td className="py-1.5 text-right font-mono text-gray-600">{h.quantity.toLocaleString('pt-BR')} {p.unit}</td>
                                      <td className="py-1.5 text-right font-mono font-semibold">{formatBRL(h.unit_price)}</td>
                                      <td className="py-1.5 text-right font-mono">
                                        {pct === null ? (
                                          <span className="text-gray-300">—</span>
                                        ) : (
                                          <span className={pct > 0 ? 'text-red-600' : pct < 0 ? 'text-emerald-600' : 'text-gray-400'}>
                                            {pct > 0 ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right font-mono text-gray-600">{formatBRL(h.quantity * h.unit_price)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={6} className="table-cell font-semibold text-right text-gray-600">Valor total em estoque:</td>
                  <td className="table-cell text-right font-bold font-mono text-blue-700">
                    {formatBRL(filtered.reduce((sum, p) => sum + p.current_stock * p.unit_price, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <ListTotal
          count={filtered.length}
          total={products.length}
          singular="produto"
          plural="produtos"
          className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right"
        />

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-500">
              Página {safePage} de {totalPages} · {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
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
                    ? <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                    : <button
                        key={p}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === safePage ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => setPage(p as number)}
                      >{p}</button>
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">{form.id ? 'Editar' : 'Novo'} Produto</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="prod-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Código *</label>
                    <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required placeholder="Ex: OL-MOTOR-15W40" />
                  </div>
                  <div>
                    <label className="label">Categoria</label>
                    <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Lubrificantes" />
                  </div>
                </div>
                <div>
                  <label className="label">Nome *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Óleo Motor 15W40" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Unidade</label>
                    <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Estoque mínimo</label>
                    <input type="number" step="0.001" min={0} className="input" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Preço Unit. (R$)</label>
                    <input type="number" step="0.01" min={0} className="input font-mono" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                  </div>
                </div>
                {!form.id && (
                  <div>
                    <label className="label">Estoque inicial</label>
                    <input type="number" step="0.001" min={0} className="input" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="pactive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="pactive" className="text-sm text-gray-700">Produto ativo</label>
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              </form>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" form="prod-form" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock adjustment modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">Ajuste de Estoque</h3>
              <button onClick={() => setShowStockModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold">{showStockModal.name}</p>
                <p className="text-sm text-gray-500">Estoque atual: <strong>{showStockModal.current_stock} {showStockModal.unit}</strong></p>
              </div>
              <div>
                <label className="label">Tipo de ajuste</label>
                <select className="input" value={stockType} onChange={e => setStockType(e.target.value as any)}>
                  <option value="add">Entrada (adicionar)</option>
                  <option value="remove">Saída (remover)</option>
                  <option value="set">Acerto de inventário (definir valor exato)</option>
                </select>
              </div>
              <div>
                <label className="label">Quantidade ({showStockModal.unit})</label>
                <input type="number" step="0.001" min={0} className="input font-mono text-lg" value={stockAdjust} onChange={e => setStockAdjust(e.target.value)} placeholder="0" autoFocus />
              </div>
              {stockAdjust && (
                <p className="text-sm text-gray-500">
                  Novo estoque:{' '}
                  <strong>
                    {stockType === 'set'
                      ? parseFloat(stockAdjust)
                      : stockType === 'add'
                      ? showStockModal.current_stock + parseFloat(stockAdjust)
                      : showStockModal.current_stock - parseFloat(stockAdjust)
                    } {showStockModal.unit}
                  </strong>
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button className="btn-secondary" onClick={() => setShowStockModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={adjustStock} disabled={!stockAdjust}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
