'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { updateUserRole, setUserActive, type RolePermissionRow } from './actions'
import { ASSIGNABLE_ROLES, ROLE_LABEL } from './constants'
import {
  SettingsIconBox,
  UserStatCard,
  IconUsers,
  IconCheckCircle,
  IconPlus,
  IconClock,
} from './SettingsSharedUI'
import type {
  Branch,
  Doctor,
  Profile,
  R,
} from './types'
import { RolePermissionMatrix } from './RolePermissionMatrix'
import { UserPermissionPanel } from './UserPermissionPanel'
import { IconShield } from './kullaniciShared'

export default function KullaniciTab({
  profiles,
  doctors,
  branches,
  isAdmin,
  currentUserId,
  rolePermissions,
  onAdd,
  onChanged,
}: {
  profiles: Profile[]
  doctors: Doctor[]
  branches: Branch[]
  rolePermissions: RolePermissionRow[]
  isAdmin: boolean
  currentUserId: string
  onAdd: () => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [permissionUser, setPermissionUser] = useState<Profile | null>(null)

  const doctorName = (id: number | null) =>
    id ? doctors.find((d) => d.id === id)?.name ?? null : null
  const branchName = (id: number | null) => id ? branches.find((branch) => branch.id === id)?.name ?? null : null
  const activeUsers = profiles.filter((p) => p.is_active)
  const adminUsers = profiles.filter((p) => p.role === 'bashekim')

  const changeRole = (p: Profile, role: string) => {
    if (role === p.role) return
    startTransition(async () => {
      const res = await updateUserRole(p.id, role)
      if ((res as R)?.error) toast.error((res as R)!.error!)
      else { toast.success('Rol güncellendi'); onChanged() }
    })
  }

  const toggleActive = async (p: Profile) => {
    if (!p.is_active) {
      startTransition(async () => {
        const res = await setUserActive(p.id, true)
        if ((res as R)?.error) toast.error((res as R)!.error!)
        else { toast.success('Hesap aktifleştirildi'); onChanged() }
      })
      return
    }
    const ok = await confirm({
      title: 'Hesabı Pasife Al',
      message: `${p.full_name ?? p.email ?? 'Kullanıcı'} artık giriş yapamayacak. Devam edilsin mi?`,
      confirmText: 'Evet, Pasife Al',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await setUserActive(p.id, false)
      if ((res as R)?.error) toast.error((res as R)!.error!)
      else { toast.success('Hesap pasife alındı'); onChanged() }
    })
  }

  if (permissionUser) {
    return (
      <UserPermissionPanel
        user={permissionUser}
        isAdmin={isAdmin}
        onClose={() => setPermissionUser(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <UserStatCard title="Toplam Kullanıcı" value={profiles.length} tone="blue" icon={<IconUsers />} />
        <UserStatCard title="Aktif Kullanıcı" value={activeUsers.length} tone="green" icon={<IconCheckCircle />} />
        <UserStatCard title="Yönetici" value={adminUsers.length} tone="violet" icon={<IconShield />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 border-b border-[#EEF2F6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <SettingsIconBox><IconUsers /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Kullanıcılar</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Sisteme erişebilen kullanıcılar ve yetki rolleri</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={onAdd}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              <IconPlus />
              Kullanıcı Ekle
            </button>
          )}
        </div>
        {profiles.length === 0 ? (
          <div className="p-6">
            <div className="flex min-h-60 flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <IconUsers />
              </span>
              <h3 className="text-sm font-black text-[#142536]">Henüz kullanıcı eklenmemiş.</h3>
              <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-slate-400">Klinik ekibinizi davet ederek yetki rollerini tanımlayabilirsiniz.</p>
              {isAdmin && (
                <button onClick={onAdd} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)]">
                  <IconPlus />
                  Kullanıcı Ekle
                </button>
              )}
            </div>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#FAFBFC]">
              <tr className="h-14 border-b border-[#EEF2F6] text-slate-400">
                <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Ad Soyad</th>
                <th className="px-5 text-left text-xs font-black uppercase tracking-wide">E-posta</th>
                <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Rol</th>
                <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Son Giriş</th>
                <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Durum</th>
                <th className="px-5 text-right text-xs font-black uppercase tracking-wide">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isSelf = p.id === currentUserId
                const isAdminRow = p.role === 'bashekim'
                const canManage = isAdmin && !isSelf && !isAdminRow && !p.is_pending
                const dName = doctorName(p.doctor_id)
                const bName = branchName(p.branch_id)
                const initials = (p.full_name ?? p.email ?? '?')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toLocaleUpperCase('tr-TR')
                return (
                  <tr key={p.id} className={`h-20 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04] ${!p.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5FD3C1,#2563EB)] text-sm font-black text-white shadow-sm">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-black text-[#142536]">{p.full_name ?? 'İsimsiz kullanıcı'}</span>
                            {isSelf && <span className="rounded-full bg-[#E6FFFA] px-2 py-0.5 text-[11px] font-black text-[#0F766E]">Siz</span>}
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{dName ? `Dt. ${dName}` : 'Personel'}{bName ? ` · ${bName}` : ''}{p.is_pending ? ' · Davet bekliyor' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">{p.email ?? 'E-posta yok'}</td>
                    <td className="px-5 py-4">
                      {canManage ? (
                        <select
                          value={p.role}
                          onChange={(e) => changeRole(p, e.target.value)}
                          disabled={pending}
                          className="rounded-full border border-[#E7ECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15 disabled:opacity-50"
                        >
                          {!ASSIGNABLE_ROLES.some((r) => r.key === p.role) && (
                            <option value={p.role}>{ROLE_LABEL[p.role] ?? p.role}</option>
                          )}
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={p.role} />
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-400 whitespace-nowrap">
                      {p.last_login
                        ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <IconClock />
                            {new Date(p.last_login).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )
                        : 'Henüz giriş yok'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`h-2 w-2 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                        {p.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!p.is_pending && (
                          <button
                            onClick={() => setPermissionUser(p)}
                            title={isAdmin ? 'İzinleri Düzenle' : 'İzinleri Görüntüle'}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#5FD3C1]/10 hover:text-[#1EAEA0]"
                          >
                            <IconKey />
                          </button>
                        )}
                        {canManage ? (
                          <button
                            onClick={() => toggleActive(p)}
                            disabled={pending}
                            className={`inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-black transition disabled:opacity-50 ${
                              p.is_active
                                ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                                : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                            }`}
                          >
                            {p.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
        <div className="flex flex-col gap-2 border-t border-[#EEF2F6] px-6 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Toplam {profiles.length} kullanıcı listeleniyor</span>
          <span>Aktif: {activeUsers.length}</span>
        </div>
      </section>

          <RolePermissionMatrix rolePermissions={rolePermissions} isAdmin={isAdmin} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-[24px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 text-[#1D4ED8] shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80">
                <IconShield />
              </span>
              <div>
                <h3 className="text-sm font-black">Güvenlik Notu</h3>
                <p className="mt-1 text-xs font-semibold leading-5">Kullanıcı rolleri hasta, finans ve ayar erişimlerini sınırlar.</p>
              </div>
            </div>
            <p className="text-xs font-semibold leading-5">RLS zorlaması sonraki adımda güçlendirilebilir.</p>
          </section>

          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start gap-3">
              <SettingsIconBox><IconShield /></SettingsIconBox>
              <div>
                <h3 className="text-base font-black text-[#142536]">Rol Açıklamaları</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">Erişim seviyeleri için hızlı özet</p>
              </div>
            </div>
            <div className="space-y-3">
              <RoleInfoRow title="Başhekim" description="Tüm modüllere erişir." tone="violet" />
              <RoleInfoRow title="Mesul Müdür" description="Ayarlar → Kullanıcı hariç her şeye erişir." tone="slate" />
              <RoleInfoRow title="Hekim" description="Kendi hastası, randevu ve klinik işlem erişimi." tone="teal" />
              <RoleInfoRow title="Asistan" description="Randevu ve hasta kayıt erişimi." tone="blue" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
function IconKey() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></svg>
}
function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABEL[role] ?? role
  const cls = role === 'bashekim'
    ? 'bg-[#F3E8FF] text-[#7C3AED]'
    : role === 'responsible_manager'
      ? 'bg-[#FFF7ED] text-[#C2410C]'
      : role === 'hekim'
        ? 'bg-[#E6FFFA] text-[#0F766E]'
        : role === 'asistan'
          ? 'bg-[#EAF2FF] text-[#2563EB]'
          : 'bg-[#F1F5F9] text-slate-600'
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ' + cls}><IconShield />{label}</span>
}
function RoleInfoRow({ title, description, tone }: { title: string; description: string; tone: 'violet' | 'teal' | 'blue' | 'slate' }) {
  const toneClass = {
    violet: 'bg-violet-50 text-violet-600',
    teal: 'bg-[#E6FFFA] text-[#0F766E]',
    blue: 'bg-[#EAF2FF] text-[#2563EB]',
    slate: 'bg-[#F1F5F9] text-slate-600',
  }[tone]
  return <div className="flex items-start gap-3 rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3"><span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' + toneClass}><IconShield /></span><span><strong className="block text-sm font-black text-[#142536]">{title}</strong><span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-400">{description}</span></span></div>
}
