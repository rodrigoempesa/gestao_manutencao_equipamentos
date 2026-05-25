'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Settings } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ company_name: '', name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar conta')
        setLoading(false)
        return
      }

      router.push('/login?cadastro=ok')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('O servidor demorou muito para responder. Tente novamente.')
      } else {
        setError('Erro de conexão. Verifique sua internet e tente novamente.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Settings className="w-9 h-9 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-white">Gestão de Manutenção</h1>
          <p className="text-blue-200 text-sm mt-1">Equipamentos e Horímetros</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Criar conta</h2>
          <p className="text-gray-500 text-sm mb-6">Comece agora — acesso imediato após o cadastro.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome da Empresa *</label>
              <input
                className="input"
                placeholder="Ex: Mineração ABC Ltda"
                value={form.company_name}
                onChange={set('company_name')}
                required
              />
            </div>
            <div>
              <label className="label">Seu Nome *</label>
              <input
                className="input"
                placeholder="João Silva"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
            <div>
              <label className="label">E-mail *</label>
              <input
                type="email"
                className="input"
                placeholder="joao@empresa.com.br"
                value={form.email}
                onChange={set('email')}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Senha *</label>
              <input
                type="password"
                className="input"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          {/* Benefícios resumidos */}
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
            {[
              'Controle de horímetros e leituras',
              'Planos de manutenção preventiva',
              'Ordens de serviço e alertas',
            ].map(b => (
              <div key={b} className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-white font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
