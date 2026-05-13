export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import type { Profile } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branches(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch allowed modules — custom access_profile takes precedence over role defaults
  let allowedModules: string[]

  if (profile.access_profile_id) {
    const { data: customPerms } = await supabase
      .from('access_profile_modules')
      .select('module_slug, enabled')
      .eq('profile_id', profile.access_profile_id)

    if (customPerms && customPerms.length > 0) {
      allowedModules = customPerms
        .filter((p: any) => p.enabled)
        .map((p: any) => p.module_slug)
    } else {
      allowedModules = ['dashboard']
    }
  } else {
    const { data: perms } = await supabase
      .from('role_module_permissions')
      .select('module_slug')
      .eq('role', profile.role)
      .eq('enabled', true)

    if (perms && perms.length > 0) {
      allowedModules = perms.map((p: any) => p.module_slug)
    } else {
      const defaults: Record<string, string[]> = {
        admin_geral: ['dashboard','leituras','manutencoes','equipamentos','produtos','servicos','planos','solicitacoes','filiais','usuarios'],
        admin_local: ['dashboard','leituras','manutencoes','equipamentos','produtos','servicos','solicitacoes','usuarios'],
        encarregado: ['dashboard','leituras'],
      }
      allowedModules = defaults[profile.role] ?? ['dashboard']
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile as Profile} allowedModules={allowedModules} />
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
