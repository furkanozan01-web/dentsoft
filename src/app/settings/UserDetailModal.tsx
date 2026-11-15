'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resetUserPassword, setMyPassword, updateUsername } from './actions'
import { ROLE_LABEL } from './constants'
import { ErrBox, SModal } from './SettingsSharedUI'
import type { Profile } from './types'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-400'
const btnCls = 'px-4 py-2 rounded-xl bg-[#0F2B3D] text-white text-xs font-bold hover:bg-[#14364A] disabled:opacity-50'

/**
 * Kullanıcıya tıklanınca açılan ekran: kullanıcı adı ve şifre seçenekleri.
 * canEdit: başhekim (herkes) veya mesul müdür (kendi şubesindeki hekim/asistan); self: kendi şifresini değiştirme
 */
export function UserDetailModal({
  user,
  branchName,
  doctorName,
  canEdit,
  canEditUsername,
  isSelf,
  onClose,
  onChanged,
  onOpenPermissions,
}: {
  user: Profile
  branchName: string | null
  doctorName: string | null
  canEdit: boolean
  canEditUsername: boolean
  isSelf: boolean
  onClose: () => void
  onChanged: () => void
  onOpenPermissions?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState(user.username ?? '')
  const hasAccount = !user.is_pending
  const canPassword = hasAccount && (canEdit || isSelf)

  const saveUsername = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateUsername(user.id, username)
      if (res?.error) { setError(res.error); return }
      toast.success('Kullanıcı adı güncellendi')
      onChanged()
    })
  }

  const savePassword = (formData: FormData) => {
    const pw = String(formData.get('password') ?? '')
    const again = String(formData.get('password2') ?? '')
    if (pw !== again) { setError('Şifreler aynı değil'); return }
    setError(null)
    startTransition(async () => {
      const res = isSelf ? await setMyPassword(pw) : await resetUserPassword(user.id, pw)
      if (res?.error) { setError(res.error); return }
      toast.success(isSelf ? 'Şifreniz belirlendi' : 'Şifre belirlendi; yeni şifreyi çalışana iletin')
      onClose()
    })
  }

  return (
    <SModal
      title={user.full_name ?? user.username ?? 'Kullanıcı'}
      subtitle={`${ROLE_LABEL[user.role] ?? user.role}${doctorName ? ` · Dt. ${doctorName}` : ''}${branchName ? ` · ${branchName}` : ''}`}
      onClose={onClose}
    >
      <div className="p-6 space-y-6">
        {error && <ErrBox msg={error} />}

        {!hasAccount && (
          <p className="text-sm text-gray-500">Bu kişinin henüz bir hesabı yok. Kullanıcı adı ve şifre için önce “Kullanıcı Ekle” ile hesabı oluşturun.</p>
        )}

        {hasAccount && (
          <section className="space-y-3">
            <h3 className="text-sm font-black text-[#142536]">Kullanıcı Adı</h3>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!canEditUsername || pending}
                autoComplete="off"
                className={inputCls}
                placeholder="kullanici.adi"
              />
              {canEditUsername && (
                <button type="button" onClick={saveUsername} disabled={pending || username.trim() === (user.username ?? '')} className={btnCls}>
                  Kaydet
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400">Giriş: klinik e-postası + bu kullanıcı adı + şifre.</p>
          </section>
        )}

        {canPassword && (
          <section>
            <h3 className="mb-3 text-sm font-black text-[#142536]">{isSelf ? 'Şifremi Belirle' : 'Yeni Şifre Belirle'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); savePassword(new FormData(e.currentTarget)) }} className="space-y-3" autoComplete="off">
              <input name="password" type="password" required minLength={6} maxLength={72} autoComplete="new-password" placeholder="Yeni şifre (en az 6 karakter)" className={inputCls} />
              <input name="password2" type="password" required minLength={6} maxLength={72} autoComplete="new-password" placeholder="Yeni şifre (tekrar)" className={inputCls} />
              <button type="submit" disabled={pending} className={btnCls}>Şifreyi Kaydet</button>
            </form>
          </section>
        )}

        {hasAccount && !canPassword && (
          <p className="text-xs text-gray-400">Bu kullanıcının kullanıcı adını ve şifresini yalnızca yetkili yönetici belirleyebilir.</p>
        )}

        {onOpenPermissions && hasAccount && (
          <button type="button" onClick={onOpenPermissions} className="text-xs font-bold text-[#1EAEA0] hover:underline">
            İzinleri düzenle / görüntüle →
          </button>
        )}
      </div>
    </SModal>
  )
}
