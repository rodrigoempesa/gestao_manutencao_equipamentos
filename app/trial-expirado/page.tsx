'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'

export default function TrialExpiradoPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-2xl mb-6">
          <Lock className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Período gratuito encerrado</h1>
        <p className="text-gray-400 mb-8">
          Seu trial de 7 dias expirou. Para continuar usando o sistema, entre em contato com a Integer Tecnologia e confirme o pagamento do seu plano.
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-xs text-gray-400 uppercase font-medium">Como liberar o acesso</p>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p className="text-gray-300 text-sm">Escolha seu plano e efetue o pagamento</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p className="text-gray-300 text-sm">Envie o comprovante para nossa equipe</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p className="text-gray-300 text-sm">Seu acesso será liberado em minutos</p>
          </div>
        </div>

        <a
          href="mailto:admin@integertecnologia.com.br?subject=Pagamento%20-%20Gestão%20de%20Manutenção"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
        >
          <Mail className="w-4 h-4" />
          Contato: admin@integertecnologia.com.br
        </a>

        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </div>
  )
}
