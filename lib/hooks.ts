'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Carrega o role do usuário autenticado uma vez. Retorna null enquanto
// carrega ou se não houver sessão. Use em conjunto com canWrite() de
// @/lib/utils para esconder ações de escrita do papel "visualizador".
export function useUserRole(): string | null {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (cancelled) return
          setRole(data?.role ?? null)
        })
    })
    return () => { cancelled = true }
  }, [])

  return role
}
