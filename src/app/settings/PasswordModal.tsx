'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resetUserPassword, setMyPassword } from './actions'
import { ErrBox, MActions, SModal } from './SettingsSharedUI'

/** Şifre belirleme: userId verilirse o çalışanın şifresi sıfırlanır (başhekim); verilmezse kişinin kendi şifresi. */
export function PasswordModal({
  userId,
  userLabel,
  onClose,
}: {
  userId?: string
  userLabel?: string
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const self = !userId

  const submit = (formData: FormData) => {
    const pw = String(formData.get('password') ?? '')
    const again = String(formData.get('password2') ?? '')
    if (pw !== again) { setError('Şifreler aynı değil'); return }
    setError(null)
    startTransition(async () => {
      const res = self ? await setMyPassword(pw) : await resetUserPassword(userId!, pw)
      if (res?.error) { setError(res.error); return }
      toast.success(self ? 'Şifreniz belirlendi' : 'Şifre sıfırlandı; yeni şifreyi çalışana iletin')
      onClose()
    })
  }

  const cls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'
  return (
    <SModal
      title={self ? 'Şifremi Belirle' : 'Şifre Sıfırla'}
      subtitle={self ? 'Giriş: klinik e-postası + kullanıcı adınız + bu şifre.' : `${userLabel ?? 'Kullanıcı'} için yeni şifre belirleyin.`}
      onClose={onClose}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)) }} className="p-6 space-y-4" autoComplete="off">
        {error && <ErrBox msg={error} />}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Yeni şifre (en az 10 karakter)</label>
          <input name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={cls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Yeni şifre (tekrar)</label>
          <input name="password2" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={cls} />
        </div>
        <MActions onCancel={onClose} pending={pending} label="Şifreyi Kaydet" />
      </form>
    </SModal>
  )
}
