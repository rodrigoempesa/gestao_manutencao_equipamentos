import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: string | null): string {
  if (!date) return '-'
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatDatetime(date: string | null): string {
  if (!date) return '-'
  try {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '-'
  }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export const ESTADOS_BRASIL = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin_geral: 'Admin Geral',
    admin_local: 'Admin Local',
    encarregado: 'Encarregado',
  }
  return map[role] ?? role
}

export function trackingLabel(type: string): string {
  return type === 'hours' ? 'Horímetro (h)' : 'Odômetro (km)'
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
