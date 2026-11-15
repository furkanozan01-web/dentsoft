'use client'

import { useActionState, useEffect, useState } from 'react'
import { createStaffUser } from './actions'
import { ErrBox, MActions, SettField, SModal } from './SettingsSharedUI'
import type { Branch, Doctor, R } from './types'
// ---- Modals ----
export function UserModal({
  doctors,
  branches,
  managerOnly = false,
  lockedBranchId = null,
  labPartners = [],
  onClose,
  onSuccess,
}: {
  doctors: Doctor[]
  branches: Branch[]
  /** Mesul müdür: yalnızca hekim/asistan ekleyebilir */
  managerOnly?: boolean
  /** Mesul müdürün kendi şubesi (kilitli) */
  lockedBranchId?: number | null
  /** Laboratuvar rolü için seçilebilecek laboratuvar iş ortakları */
  labPartners?: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(createStaffUser, null as R)
  const [role, setRole] = useState('asistan')
  const [isDentist, setIsDentist] = useState(false)

  useEffect(() => {
    if ((state as R)?.success) onSuccess()
  }, [state, onSuccess])

  const activeDoctors = doctors.filter((d) => d.status === 'active')

  return (
    <SModal title="Kullanıcı Ekle" subtitle="Kişi, klinik e-postası + bu kullanıcı adı + şifre ile giriş yapar. Şifreyi çalışana siz iletirsiniz." onClose={onClose}>
      <form action={action} className="p-6 space-y-4" autoComplete="off">
        {(state as R)?.error && <ErrBox msg={(state as R)!.error!} />}
        <SettField label="Ad Soyad" name="full_name" placeholder="Ayşe Yılmaz" />
        <SettField label="Kullanıcı Adı *" name="username" required placeholder="ayse.yilmaz" />
        <SettField label="Şifre * (en az 6 karakter)" name="password" type="password" required placeholder="••••••" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Rol</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
          >
            <option value="asistan">Asistan</option>
            <option value="hekim">Hekim</option>
            {!managerOnly && <option value="responsible_manager">Mesul Müdür</option>}
            {!managerOnly && <option value="laboratuvar">Laboratuvar (dış kullanıcı)</option>}
          </select>
        </div>
        {role === 'laboratuvar' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Hangi laboratuvar? *</label>
            {labPartners.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">Önce Finans → İş Ortaklarımız bölümünden türü “Laboratuvar” olan bir firma ekleyin.</p>
            ) : (
              <select name="partner_id" required defaultValue="" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
                <option value="" disabled>Laboratuvar seçin…</option>
                {labPartners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <p className="text-[11px] text-gray-400 mt-1">Bu kullanıcı yalnızca kendi laboratuvar portalını görür: yaptığı işleri ve ücretlerini bildirir; hasta, finans ve diğer bilgilere erişemez.</p>
          </div>
        )}
        {role === 'responsible_manager' && (
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <input type="checkbox" name="is_dentist" checked={isDentist} onChange={(e) => setIsDentist(e.target.checked)} />
            Aynı zamanda diş hekimi (Diş Hekimi sekmesinde de görünsün)
          </label>
        )}
        {(role === 'hekim' || (role === 'responsible_manager' && isDentist)) && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Hangi hekimle ilişkilendir?
            </label>
            <select
              name="doctor_id"
              defaultValue="new"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
            >
              <option value="new">+ Yeni hekim profili oluştur</option>
              {activeDoctors.map((d) => (
                <option key={d.id} value={d.id}>Dt. {d.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Tedavi ve hakediş kayıtlarının doğru hekime bağlanması için bir hekim profiliyle eşleştirilir.
            </p>
          </div>
        )}
        {role !== 'laboratuvar' && <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Bağlı Şube</label>
          <select name="branch_id" defaultValue={lockedBranchId ?? branches.find((branch) => branch.is_default)?.id ?? ''} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            {branches.filter((branch) => branch.is_active && (lockedBranchId === null || branch.id === lockedBranchId)).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>}
        {role !== 'laboratuvar' && !(managerOnly && lockedBranchId !== null) && <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Yetki Seviyesi</label>
          <select name="access_level" defaultValue="branch" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            <option value="branch">Yalnızca bağlı şube</option>
            <option value="all">Tüm şubeler</option>
          </select>
        </div>}
        <MActions onCancel={onClose} pending={pending} label="Kullanıcıyı Ekle" />
      </form>
    </SModal>
  )
}
