import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Giriş Yap — DentSoft' }

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F0F4F9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F2B3D] mb-4">
            <span className="text-[#2DD4BF] text-2xl font-bold tracking-tight">
              D
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F2B3D]">DentSoft</h1>
          <p className="text-sm text-gray-400 mt-1">Ozanoğlu Poliklinik</p>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
