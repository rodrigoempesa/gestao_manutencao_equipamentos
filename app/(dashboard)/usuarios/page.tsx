'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Branch } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import {
  Users, Plus, Pencil, ToggleRight, ToggleLeft, X,
  ShieldCheck, Settings2, Check, Save, Trash2, Shield,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface InviteForm {
  email: string; name: string; role: string; branch_id: string; password: string; access_profile_id: string
}
const emptyInvite = (): InviteForm => ({ email: '', name: '', role: 'encarregado', branch_id: '', password: '', access_profile_id: '' })

interface EditForm {
  id: string; name: string; role: string; branch_id: string; active: boolean; access_profile_id: string
}

interface Module { slug: string; label: string; order_index: number }
interface AccessProfile { id: string; name: string; created_at: string }

type PermMatrix = Record<string, Record<string, boolean>> // role → slug → enabled
type ProfileModules = Record<string, Record<string, boolean>> // profile_id → slug → enabled

const ROLES = [
  { value: 'admin_geral', label: 'Admin Geral',  color: 'badge-red'  },
  { value: 'admin_local', label: 'Admin Local',  color: 'badge-blue' },
  { value: 'encarregado', label: 'Operador',     color: 'badge-gray' },
]

function roleBadge(role: string) {
  return ROLES.find(r => r.value === role) ?? { label: role, color: 'badge-gray' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'users' | 'profiles'>('users')
  const [loading, setLoading] = useState(true)
  const [myProfile, setMyProfile] = useState<{ role: string; branch_id: string | null } | null>(null)

  // Users tab
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState<InviteForm>(emptyInvite())
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Role permissions tab
  const [modules, setModules] = useState<Module[]>([])
  const [permMatrix, setPermMatrix] = useState<PermMatrix>({})
  const [permSaving, setPermSaving] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  // Custom profiles
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([])
  const [profileModules, setProfileModules] = useState<ProfileModules>({})
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null) // null = new
  const [profileForm, setProfileForm] = useState<{ name: string; modules: Record<string, boolean> }>({ name: '', modules: {} })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<AccessProfile | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('profiles').select('role, branch_id').eq('id', user.id).single()
    if (!me) return
    setMyProfile(me)

    let pQuery = supabase.from('profiles').select('*, branches(*), access_profiles(id, name)').order('name')
    if (me.role === 'admin_local' && me.branch_id) {
      pQuery = pQuery.eq('branch_id', me.branch_id)
    }

    const [{ data: profs }, { data: brs }, { data: mods }, { data: perms }, { data: aps }, { data: apMods }] = await Promise.all([
      pQuery,
      supabase.from('branches').select('*').eq('active', true).order('name'),
      supabase.from('modules').select('*').order('order_index'),
      supabase.from('role_module_permissions').select('role, module_slug, enabled'),
      supabase.from('access_profiles').select('*').order('name'),
      supabase.from('access_profile_modules').select('profile_id, module_slug, enabled'),
    ])

    setProfiles((profs as Profile[]) ?? [])
    setBranches((brs as Branch[]) ?? [])
    setModules((mods as Module[]) ?? [])
    setAccessProfiles((aps as AccessProfile[]) ?? [])

    // Build role permission matrix
    const matrix: PermMatrix = {}
    ROLES.forEach(r => {
      matrix[r.value] = {}
      ;(mods as Module[] ?? []).forEach(m => { matrix[r.value][m.slug] = false })
    })
    ;(perms ?? []).forEach((p: any) => {
      if (matrix[p.role]) matrix[p.role][p.module_slug] = p.enabled
    })
    setPermMatrix(matrix)

    // Build custom profile module map
    const pm: ProfileModules = {}
    ;(aps as AccessProfile[] ?? []).forEach(ap => {
      pm[ap.id] = {}
      ;(mods as Module[] ?? []).forEach(m => { pm[ap.id][m.slug] = false })
    })
    ;(apMods ?? []).forEach((row: any) => {
      if (pm[row.profile_id]) pm[row.profile_id][row.module_slug] = row.enabled
    })
    setProfileModules(pm)

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── User CRUD ────────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault(); setInviteError(''); setInviteSuccess(''); setInviting(true)
    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password: invite.password,
      options: { data: { name: invite.name, role: invite.role, branch_id: invite.branch_id || null } },
    })
    if (error) { setInviteError(error.message); setInviting(false); return }

    // If a custom profile was selected, update the profile row after creation
    if (invite.access_profile_id) {
      // Small wait for the trigger to create the profile row
      await new Promise(r => setTimeout(r, 800))
      const { data: newUser } = await supabase.from('profiles').select('id').eq('email', invite.email).single()
      if (newUser) {
        await supabase.from('profiles').update({ access_profile_id: invite.access_profile_id }).eq('id', newUser.id)
      }
    }

    setInviteSuccess(`Usuário ${invite.email} criado com sucesso!`)
    setInvite(emptyInvite())
    setTimeout(() => { setShowInvite(false); setInviteSuccess(''); loadData() }, 2000)
    setInviting(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setEditError(''); setEditSaving(true)
    const { error } = await supabase.from('profiles').update({
      name: editForm.name,
      role: editForm.role,
      branch_id: editForm.branch_id || null,
      active: editForm.active,
      access_profile_id: editForm.access_profile_id || null,
    }).eq('id', editForm.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    setShowEdit(false); loadData(); setEditSaving(false)
  }

  async function toggleActive(p: Profile) {
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id)
    loadData()
  }

  function openEdit(p: Profile) {
    setEditForm({
      id: p.id, name: p.name, role: p.role,
      branch_id: p.branch_id ?? '',
      active: p.active,
      access_profile_id: (p as any).access_profile_id ?? '',
    })
    setEditError(''); setShowEdit(true)
  }

  // ── Role Permissions ─────────────────────────────────────────────────────────

  function togglePerm(role: string, slug: string) {
    if (role === 'admin_geral') return
    setPermMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [slug]: !prev[role][slug] },
    }))
  }

  async function savePermissions() {
    setPermSaving(true)
    const rows: { role: string; module_slug: string; enabled: boolean }[] = []
    ROLES.filter(r => r.value !== 'admin_geral').forEach(r => {
      modules.forEach(m => {
        rows.push({ role: r.value, module_slug: m.slug, enabled: permMatrix[r.value]?.[m.slug] ?? false })
      })
    })
    await supabase.from('role_module_permissions').upsert(rows, { onConflict: 'role,module_slug' })
    setPermSaving(false); setPermSaved(true)
    setTimeout(() => setPermSaved(false), 2000)
  }

  // ── Custom Profiles CRUD ─────────────────────────────────────────────────────

  function openNewProfile() {
    setEditingProfile(null)
    const mods: Record<string, boolean> = {}
    modules.forEach(m => { mods[m.slug] = false })
    setProfileForm({ name: '', modules: mods })
    setProfileError('')
    setShowProfileModal(true)
  }

  function openEditProfile(ap: AccessProfile) {
    setEditingProfile(ap)
    const mods: Record<string, boolean> = {}
    modules.forEach(m => { mods[m.slug] = profileModules[ap.id]?.[m.slug] ?? false })
    setProfileForm({ name: ap.name, modules: mods })
    setProfileError('')
    setShowProfileModal(true)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!profileForm.name.trim()) { setProfileError('Informe o nome do perfil'); return }
    setProfileSaving(true); setProfileError('')

    let profileId = editingProfile?.id ?? null

    if (!profileId) {
      // Create
      const { data, error } = await supabase.from('access_profiles').insert({ name: profileForm.name.trim() }).select('id').single()
      if (error) { setProfileError(error.message); setProfileSaving(false); return }
      profileId = data.id
    } else {
      // Update name
      const { error } = await supabase.from('access_profiles').update({ name: profileForm.name.trim() }).eq('id', profileId)
      if (error) { setProfileError(error.message); setProfileSaving(false); return }
    }

    // Upsert modules
    const rows = modules.map(m => ({
      profile_id: profileId!,
      module_slug: m.slug,
      enabled: profileForm.modules[m.slug] ?? false,
    }))
    const { error: modErr } = await supabase
      .from('access_profile_modules')
      .upsert(rows, { onConflict: 'profile_id,module_slug' })
    if (modErr) { setProfileError(modErr.message); setProfileSaving(false); return }

    setShowProfileModal(false); setProfileSaving(false); loadData()
  }

  async function handleDeleteProfile() {
    if (!confirmDeleteProfile) return
    await supabase.from('access_profiles').delete().eq('id', confirmDeleteProfile.id)
    setConfirmDeleteProfile(null); loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  const isAdminGeral = myProfile?.role === 'admin_geral'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Usuários
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de usuários e perfis de acesso</p>
        </div>
        {isAdminGeral && tab === 'users' && (
          <button className="btn-primary" onClick={() => { setInvite(emptyInvite()); setInviteError(''); setInviteSuccess(''); setShowInvite(true) }}>
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        )}
        {isAdminGeral && tab === 'profiles' && (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={openNewProfile}>
              <Plus className="w-4 h-4" /> Novo Perfil
            </button>
            <button className="btn-secondary" onClick={savePermissions} disabled={permSaving}>
              {permSaved
                ? <><Check className="w-4 h-4" /> Salvo!</>
                : permSaving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar Permissões</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {isAdminGeral && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('users')}
          >
            <Users className="w-4 h-4" /> Usuários
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'profiles' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('profiles')}
          >
            <ShieldCheck className="w-4 h-4" /> Perfis de Acesso
          </button>
        </div>
      )}

      {/* ── Users Tab ── */}
      {tab === 'users' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Nome</th>
                  <th className="table-header">E-mail</th>
                  <th className="table-header">Papel</th>
                  <th className="table-header">Perfil Customizado</th>
                  <th className="table-header">Filial</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Criado em</th>
                  <th className="table-header">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.length === 0 && (
                  <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">Nenhum usuário encontrado</td></tr>
                )}
                {profiles.map(p => {
                  const rb = roleBadge(p.role)
                  const customProfile = (p as any).access_profiles
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                      <td className="table-cell font-medium">{p.name}</td>
                      <td className="table-cell text-gray-500 text-sm">{p.email}</td>
                      <td className="table-cell">
                        <span className={rb.color}>{rb.label}</span>
                      </td>
                      <td className="table-cell">
                        {customProfile
                          ? <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium"><Shield className="w-3 h-3" />{customProfile.name}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="table-cell">
                        {(p as any).branches
                          ? <div><p className="text-sm">{(p as any).branches.name}</p><p className="text-xs text-gray-400">{(p as any).branches.city}/{(p as any).branches.state}</p></div>
                          : <span className="text-gray-400 text-sm">Todas</span>}
                      </td>
                      <td className="table-cell">
                        {p.active ? <span className="badge-green">Ativo</span> : <span className="badge-gray">Inativo</span>}
                      </td>
                      <td className="table-cell text-gray-400 text-sm">{formatDate(p.created_at)}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Profiles/Permissions Tab ── */}
      {tab === 'profiles' && isAdminGeral && (
        <div className="space-y-8">

          {/* Custom Profiles */}
          <div className="space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              Perfis Customizados
            </h2>
            {accessProfiles.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
                <Shield className="w-8 h-8" />
                <p className="text-sm">Nenhum perfil customizado criado. Clique em "Novo Perfil" para começar.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {accessProfiles.map(ap => {
                  const enabledCount = Object.values(profileModules[ap.id] ?? {}).filter(Boolean).length
                  return (
                    <div key={ap.id} className="card flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-500" />
                          <p className="font-semibold text-gray-900">{ap.name}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{enabledCount} módulo{enabledCount !== 1 ? 's' : ''} habilitado{enabledCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button className="btn-secondary py-1 px-2" onClick={() => openEditProfile(ap)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="btn-secondary py-1 px-2 text-red-500" onClick={() => setConfirmDeleteProfile(ap)} title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Role Permission Matrix */}
          <div className="space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-600" />
              Permissões por Papel
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-800">
              <Settings2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Configure quais módulos cada papel pode acessar por padrão. Perfis customizados sobrescrevem essas configurações. O <strong>Admin Geral</strong> sempre tem acesso completo.</span>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Módulo</th>
                      {ROLES.map(r => (
                        <th key={r.value} className="text-center px-5 py-3 text-sm font-semibold text-gray-600 min-w-[140px]">
                          <span className={r.color}>{r.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {modules.map(mod => (
                      <tr key={mod.slug} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-800">{mod.label}</td>
                        {ROLES.map(r => {
                          const enabled = permMatrix[r.value]?.[mod.slug] ?? false
                          const isAdminGeneralRole = r.value === 'admin_geral'
                          return (
                            <td key={r.value} className="px-5 py-3">
                              <div className="flex justify-center">
                                {isAdminGeneralRole ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => togglePerm(r.value, mod.slug)}
                                    title={enabled ? 'Clique para desativar' : 'Clique para ativar'}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                  >
                                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">As alterações têm efeito no próximo login do usuário.</p>
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Novo Usuário</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleInvite} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Nome Completo *</label>
                <input className="input" value={invite.name} onChange={e => setInvite(f => ({ ...f, name: e.target.value }))} required placeholder="João Silva" />
              </div>
              <div>
                <label className="label">E-mail *</label>
                <input type="email" className="input" value={invite.email} onChange={e => setInvite(f => ({ ...f, email: e.target.value }))} required placeholder="joao@empresa.com.br" />
              </div>
              <div>
                <label className="label">Senha *</label>
                <input type="password" className="input" value={invite.password} onChange={e => setInvite(f => ({ ...f, password: e.target.value }))} required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="label">Papel Base *</label>
                <select className="input" value={invite.role} onChange={e => setInvite(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {accessProfiles.length > 0 && (
                <div>
                  <label className="label">Perfil Customizado <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <select className="input" value={invite.access_profile_id} onChange={e => setInvite(f => ({ ...f, access_profile_id: e.target.value }))}>
                    <option value="">— Usar permissões do papel base —</option>
                    {accessProfiles.map(ap => <option key={ap.id} value={ap.id}>{ap.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">O perfil customizado sobrescreve as permissões do papel.</p>
                </div>
              )}
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

      {/* ── Edit User Modal ── */}
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
              {isAdminGeral && (
                <>
                  <div>
                    <label className="label">Papel Base</label>
                    <select className="input" value={editForm.role} onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  {accessProfiles.length > 0 && (
                    <div>
                      <label className="label">Perfil Customizado <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <select className="input" value={editForm.access_profile_id} onChange={e => setEditForm(f => f ? { ...f, access_profile_id: e.target.value } : f)}>
                        <option value="">— Usar permissões do papel base —</option>
                        {accessProfiles.map(ap => <option key={ap.id} value={ap.id}>{ap.name}</option>)}
                      </select>
                    </div>
                  )}
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

      {/* ── New/Edit Custom Profile Modal ── */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-semibold text-lg">{editingProfile ? 'Editar Perfil' : 'Novo Perfil'}</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveProfile} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="label">Nome do Perfil *</label>
                  <input
                    className="input"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Ex: Supervisor de Manutenção"
                  />
                </div>
                <div>
                  <label className="label mb-2 block">Módulos de Acesso</label>
                  <div className="space-y-2 border border-gray-200 rounded-xl overflow-hidden">
                    {modules.map((mod, i) => {
                      const enabled = profileForm.modules[mod.slug] ?? false
                      return (
                        <div
                          key={mod.slug}
                          className={`flex items-center justify-between px-4 py-3 ${i < modules.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                          <span className="text-sm font-medium text-gray-800">{mod.label}</span>
                          <button
                            type="button"
                            onClick={() => setProfileForm(f => ({ ...f, modules: { ...f.modules, [mod.slug]: !f.modules[mod.slug] } }))}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {profileError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{profileError}</p>}
              </div>
              <div className="px-6 py-4 border-t flex gap-3 justify-end flex-shrink-0">
                <button type="button" className="btn-secondary" onClick={() => setShowProfileModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={profileSaving}>{profileSaving ? 'Salvando...' : 'Salvar Perfil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Profile Confirmation ── */}
      {confirmDeleteProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-lg text-gray-900">Excluir Perfil</h3>
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir o perfil <strong>{confirmDeleteProfile.name}</strong>?
              Usuários associados a este perfil voltarão a usar as permissões do papel base.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDeleteProfile(null)}>Cancelar</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={handleDeleteProfile}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
