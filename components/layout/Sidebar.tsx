'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Gauge,
  Wrench,
  ClipboardList,
  Building2,
  Users,
  BookOpen,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin_geral', 'admin_local', 'encarregado'] },
  { href: '/leituras', label: 'Leituras', icon: Gauge, roles: ['admin_geral', 'admin_local', 'encarregado'] },
  { href: '/manutencoes', label: 'Manutenções', icon: Wrench, roles: ['admin_geral', 'admin_local'] },
  { href: '/equipamentos', label: 'Equipamentos', icon: ClipboardList, roles: ['admin_geral', 'admin_local'] },
  { href: '/planos', label: 'Planos de Manutenção', icon: BookOpen, roles: ['admin_geral'] },
  { href: '/filiais', label: 'Filiais', icon: Building2, roles: ['admin_geral'] },
  { href: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin_geral', 'admin_local'] },
]

interface SidebarProps {
  profile: Profile
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(profile.role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {visibleItems.map(item => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-blue-700 text-white'
                : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Gestão de</p>
            <p className="text-blue-200 text-xs">Manutenção</p>
          </div>
        </div>
      </div>

      <NavLinks />

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-blue-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-white">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.name}</p>
            <p className="text-xs text-blue-300 truncate">
              {profile.role === 'admin_geral' ? 'Admin Geral' :
               profile.role === 'admin_local' ? 'Admin Local' : 'Encarregado'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-800 text-white rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'lg:hidden fixed top-0 left-0 z-40 h-full w-64 bg-blue-800 transform transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-blue-800 min-h-screen flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  )
}
