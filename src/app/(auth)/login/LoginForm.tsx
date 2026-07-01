'use client'

import { useActionState } from 'react'
import { staffLogin, type LoginState } from './actions'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    staffLogin,
    null
  )

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      {/* Başhekim Girişi */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Başhekim Girişi
        </p>
        <button
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm"
        >
          <GoogleIcon />
          Google ile Giriş Yap
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400 uppercase tracking-wider">
            veya
          </span>
        </div>
      </div>

      {/* Personel Girişi */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Personel Girişi
        </p>
        <form action={action} className="space-y-3">
          <input
            name="username"
            type="text"
            placeholder="Kullanıcı adı"
            autoComplete="username"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF] transition-colors"
          />
          <input
            name="password"
            type="password"
            placeholder="Şifre"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF] transition-colors"
          />
          {state?.error && (
            <p className="text-red-500 text-sm">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 px-4 bg-[#0F2B3D] hover:bg-[#14364A] disabled:opacity-60 text-white rounded-xl font-medium transition-colors text-sm"
          >
            {pending ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
