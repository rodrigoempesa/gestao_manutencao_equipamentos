'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Shield, Users, Wrench, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Tenant {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
  user_count: number
  equip_count: number
}

export default function SuperadminClient({ tenants: initial }: { tenants: Tenant[] }) {
  const router = useRouter()
  const [tenants, setTenants] = useState(initial)
  const [toggling, setToggling] = useState<string | null>(null)

  async function toggleTenant(tenant: Tenant) {
    setToggling(tenant.id)
    const res = await fetch('/api/superadmin/toggle-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id, active: !tenant.active }),
    })
    if (res.ok) {
      setTenants(ts => ts.map(t => t.id === tenant.id ? { ...t, active: !t.active } : t))
    }
    setToggling(null)
  }

  const active = tenants.filter(t => t.active).length
  const inactive = tenants.filter(t => !t.active).length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">Integer Tecnologia — Painel SuperAdmin</h1>
            <p className="text-xs text-gray-400">Controle de todas as empresas clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.refresh()}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">
            ← Voltar ao sistema
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Total de empresas</p>
            <p className="text-3xl font-bold text-white">{tenants.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Ativas</p>
            <p className="text-3xl font-bold text-green-400">{active}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Bloqueadas</p>
            <p className="text-3xl font-bold text-red-400">{inactive}</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Empresa</th>
                <th className="text-left px-5 py-3 font-medium">Slug</th>
                <th className="text-center px-5 py-3 font-medium">
                  <span className="flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Usuários</span>
                </th>
                <th className="text-center px-5 py-3 font-medium">
                  <span className="flex items-center justify-center gap-1"><Wrench className="w-3 h-3" /> Equipamentos</span>
                </th>
                <th className="text-left px-5 py-3 font-medium">Cadastro</th>
                <th className="text-center px-5 py-3 font-medium">Status</th>
                <th className="text-center px-5 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{t.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-sm font-mono">{t.slug}</td>
                  <td className="px-5 py-4 text-center text-gray-300 font-semibold">{t.user_count}</td>
                  <td className="px-5 py-4 text-center text-gray-300 font-semibold">{t.equip_count}</td>
                  <td className="px-5 py-4 text-gray-400 text-sm">{formatDate(t.created_at)}</td>
                  <td className="px-5 py-4 text-center">
                    {t.active
                      ? <span className="inline-flex items-center gap-1 text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">Ativa</span>
                      : <span className="inline-flex items-center gap-1 text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">Bloqueada</span>
                    }
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => toggleTenant(t)}
                      disabled={toggling === t.id}
                      title={t.active ? 'Bloquear acesso' : 'Liberar acesso'}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        t.active
                          ? 'hover:bg-red-900/30 text-red-400 hover:text-red-300'
                          : 'hover:bg-green-900/30 text-green-400 hover:text-green-300'
                      }`}
                    >
                      {t.active
                        ? <ToggleRight className="w-5 h-5" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    Nenhuma empresa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
