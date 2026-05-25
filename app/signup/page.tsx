'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Settings, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Plan = 'starter' | 'pro' | 'enterprise'

const PLANS = [
  {
    id: 'starter' as Plan,
    name: 'Starter',
    price: 'R$ 99',
    period: '/mês',
    description: 'Ideal para empresas pequenas que estão adotando uma gestão de manutenção mais estruturada.',
    limits: 'Até 3 usuários · Até 20 equipamentos',
    features: [
      'Dashboard e leituras',
      'Manutenções e OS',
      'Planos de manutenção',
      'Relatórios básicos',
    ],
    recommended: false,
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: 'R$ 199',
    period: '/mês',
    description: 'Para empresas de médio porte com operações de manutenção mais abrangentes.',
    limits: 'Até 10 usuários · Até 100 equipamentos',
    features: [
      'Tudo do Starter',
      'Estoque de produtos',
      'Serviços e solicitações de compra',
      'Controle de filiais',
      'Relatórios completos',
    ],
    recommended: true,
  },
  {
    id: 'enterprise' as Plan,
    name: 'Enterprise',
    price: 'Consulte',
    period: '',
    description: 'Solução completa para grandes empresas com operações complexas de manutenção.',
    limits: 'Usuários e equipamentos ilimitados',
    features: [
      'Tudo do Pro',
      'Suporte prioritário',
      'Onboarding dedicado',
      'SLA garantido',
    ],
    recommended: false,
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'plans' | 'form'>('plans')
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')
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
      const timeout = setTimeout(() => controller.abort(), 20000)

      let res: Response
      try {
        res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, plan: selectedPlan }),
          signal: controller.signal,
        })
      } catch (fetchErr: any) {
        clearTimeout(timeout)
        if (fetchErr.name === 'AbortError') {
          setError('O servidor demorou muito para responder. Tente novamente.')
        } else {
          setError('Erro de rede. Verifique sua conexão e tente novamente.')
        }
        setLoading(false)
        return
      }
      clearTimeout(timeout)

      let data: any = {}
      try {
        data = await res.json()
      } catch {
        setError(`Erro no servidor (${res.status}). Tente novamente.`)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar conta')
        setLoading(false)
        return
      }

      router.push('/login?cadastro=ok')
    } catch {
      setError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  const planInfo = PLANS.find(p => p.id === selectedPlan)!

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-12">
      <div className="w-full max-w-4xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Settings className="w-9 h-9 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-white">Gestão de Manutenção</h1>
          <p className="text-blue-200 text-sm mt-1">Equipamentos e Horímetros</p>
        </div>

        {step === 'plans' ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-white">Escolha seu plano</h2>
              <p className="text-blue-200 text-sm mt-1">Cancele quando quiser. Sem fidelidade.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={cn(
                    'relative bg-white rounded-2xl shadow-xl p-6 flex flex-col cursor-pointer transition-transform hover:-translate-y-1',
                    plan.recommended && 'ring-2 ring-orange-400'
                  )}
                  onClick={() => { setSelectedPlan(plan.id); setStep('form') }}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" /> RECOMENDADO
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-1 flex items-baseline gap-0.5">
                      <span className="text-2xl font-bold text-blue-700">{plan.price}</span>
                      <span className="text-gray-400 text-sm">{plan.period}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">{plan.description}</p>
                    <p className="text-blue-600 text-xs font-medium mt-2">{plan.limits}</p>
                  </div>

                  <ul className="space-y-1.5 flex-1 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={cn(
                      'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      plan.recommended
                        ? 'bg-orange-400 hover:bg-orange-500 text-white'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    )}
                  >
                    Escolher {plan.name}
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-sm mx-auto">
            {/* Plano selecionado */}
            <div className="bg-white/10 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-white text-xs text-blue-200">Plano selecionado</p>
                <p className="text-white font-semibold">{planInfo.name} — {planInfo.price}{planInfo.period}</p>
              </div>
              <button
                onClick={() => setStep('plans')}
                className="text-blue-200 hover:text-white text-xs underline"
              >
                Trocar
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Criar conta</h2>
              <p className="text-gray-500 text-sm mb-6">Acesso imediato após o cadastro.</p>

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
            </div>
          </div>
        )}

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
