'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Branch } from '@/lib/types'
import { roleLabel, formatDate } from '@/lib/utils'
import { Users, Plus, Pencil, ToggleRight, ToggleLeft, X } from 'lucide-react'

interface InviteForm {
  email: string
  name: string
  role: string
  branch_id: string
  password: string
}

const emptyInvite = (): InviteForm => ({ email: '', name: '', role: 'encarregado', branch_id: '', password: '' })

interface EditForm {
  id: string
  name: string
  role: string
  branch_id: string
  active: boolean
}

export default function UsuariosPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [myProfile, setMyProfile] = useState<{ role: string; branch_id: string | null } | null>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState<InviteForm>(emptyInvite())
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase.from('profiles').select('role, branch_id').eq('id', user.id).single()
    if (!me) return
    setMyProfile(me)

    let pQuery = supabase
      .from('profiles')
      .select('*, branches(*)')
      .order('name')

    if (me.role === 'admin_local' && me.branch_id) {
      pQuery = pQuery.eq('branch_id', me.branch_id)
    }

    const [{ data: profs }, { data: brs }] = await Promise.all([
      pQuery,
      supabase.from('branches').select('*').eq('active', true).order('name'),
    ])

    setProfiles((profs as Profile[]) ?? [])
    setBranches((brs as Branch[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Admin-geral creates users via Supabase Admin API (not available in browser).
  // We use signUp instead, which requires email confirmation to be off or handle it.
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviting(true)

    // Note: In production, this should be a server-side admin invite.
    // Here we use signUp with metadata so the trigger creates the profile correctly.
    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password: invite.password,
      options: {
        data: {
          name: invite.name,
          role: invite.role,
          branch_id: invite.branch_id || null,
        },
      },
    })

    if (error) {
      setInviteError(error.message)
      setInviting(false)
      return
    }

    setInviteSuccess(`Usuário ${invite.email} criado com sucesso!`)
    setInvite(emptyInvite())
    setTimeout(() => { setShowInvite(false); setInviteSuccess(''); loadData() }, 2000)
    setInviting(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setEditError('')
    setEditSaving(true)
    const { error } = await supabase.from('profiles').update({
      name: editForm.name,
      role: editForm.role,
      branch_id: editForm.branch_id || null,
      active: editForm.active,
    }).eq('id', editForm.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    setShowEdit(false)
    loadData()
    setEditSaving(false)
  }

  async function toggleActive(p: Profile) {
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id)
    loadData()
  }

  function openEdit(p: Profile) {
    setEditForm({ id: p.id, name: p.name, role: p.role, branch_id: p.branch_id ?? '', active: p.active })
    setEditError('')
    setShowEdit(true)
  }

  const roleColors: Record<string, string> = {
    admin_geral: 'badge-red',
    admin_local: 'badge-blue',
    encarregado: 'badge-gray',
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Usuários
          </h1>
          <p className="text-gray-500 text-sm mt-1">{profiles.length} usuários</p>
        </div>
        {myProfile?.role === 'admin_geral' && (
          <button className="btn-primary" onClick={() => { setInvite(emptyInvite()); setInviteError(''); setInviteSuccess(''); setShowInvite(true) }}>
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Nome</th>
                <th className="table-header">E-mail</th>
                <th className="table-header">Perfil</th>
                <th className="table-header">Filial</th>
                <th className="table-header">Status</th>
                <th className="table-header">Criado em</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">Nenhum usuário encontrado</td></tr>
              )}
              {profiles.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                  <td className="table-cell font-medium">{p.name}</td>
                  <td className="table-cell text-gray-500">{p.email}</td>
                  <td className="table-cell">
                    <span className={roleColors[p.role] ?? 'badge-gray'}>{roleLabel(p.role)}</span>
                  </td>
                  <td className="table-cell">
                    {(p as any).branches ? (
                      <div>
                        <p className="text-sm">{(p as any).branches.name}</p>
                        <p className="text-xs text-gray-400">{(p as any).branches.city}/{(p as any).branches.state}</p>
                      </div>
                    ) : <span className="text-gray-400">Todas</span>}
                  </td>
                  <td className="table-cell">
                    {p.active ? <span className="badge-green">Ativo</span> : <span className="badge-gray">Inativo</span>}
                  </td>
                  <td className="table-cell text-gray-400">{formatDate(p.created_at)}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="btn-secondary py-1 px-2" onClick={() => openEdit(p)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className={`btn-secondary py-1 px-2 ${p.active ? 'text-red-500' : 'text-green-600'}`}
                        onClick={() => toggleActive(p)}
                        title={p.active ? 'Desativar' : 'Ativar'}
                      >
                        {p.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Novo Usuário</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleInvite} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nome Completo *</label>
                  <input className="input" value={invite.name} onChange={e => setInvite(f => ({ ...f, name: e.target.value }))} required placeholder="João Silva" />
                </div>
                <div className="col-span-2">
                  <label className="label">E-mail *</label>
                  <input type="email" className="input" value={invite.email} onChange={e => setInvite(f => ({ ...f, email: e.target.value }))} required placeholder="joao@empresa.com.br" />
                </div>
                <div className="col-span-2">
                  <label className="label">Senha *</label>
                  <input type="password" className="input" value={invite.password} onChange={e => setInvite(f => ({ ...f, password: e.target.value }))} required minLength={6} placeholder="Mínimo 6 caracteres" />
                </div>
              </div>
              <div>
                <label className="label">Perfil *</label>
                <select className="input" value={invite.role} onChange={e => setInvite(f => ({ ...f, role: e.target.value }))}>
                  <option value="encarregado">Encarregado</option>
                  <option value="admin_local">Admin Local</option>
                  <option value="admin_geral">Admin Geral</option>
                </select>
              </div>
              <div>
                <label className="label">Filial</label>
                <select className="input" value={invite.branch_id} onChange={e => setInvite(f => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">Todas (Admin Geral)</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} – {b.city}/{b.state}</option>)}
                </select>
              </div>
              {inviteError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{inviteSuccess}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={inviting}>{inviting ? 'Criando...' : 'Criar Usuário'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Editar Usuário</h3>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSave} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} required />
              </div>
              {myProfile?.role === 'admin_geral' && (
                <>
                  <div>
                    <label className="label">Perfil</label>
                    <select className="input" value={editForm.role} onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}>
                      <option value="encarregado">Encarregado</option>
                      <option value="admin_local">Admin Local</option>
                      <option value="admin_geral">Admin Geral</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Filial</label>
                    <select className="input" value={editForm.branch_id} onChange={e => setEditForm(f => f ? { ...f, branch_id: e.target.value } : f)}>
                      <option value="">Todas (Admin Geral)</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name} – {b.city}/{b.state}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="uactive" checked={editForm.active} onChange={e => setEditForm(f => f ? { ...f, active: e.target.checked } : f)} className="w-4 h-4" />
                <label htmlFor="uactive" className="text-sm text-gray-700">Usuário ativo</label>
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={editSaving}>{editSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
