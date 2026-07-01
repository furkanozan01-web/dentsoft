'use client'

import { useActionState, useEffect, useState } from 'react'
import { addUserToAllowlist } from './actions'
import { ErrBox, MActions, SettField, SModal } from './SettingsSharedUI'
import type { Branch, Doctor, R } from './types'
// ---- Modals ----
export function UserModal({
  doctors,
  branches,
  onClose,
  onSuccess,
}: {
  doctors: Doctor[]
  branches: Branch[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(addUserToAllowlist, null as R)
  const [role, setRole] = useState('asistan')

  useEffect(() => {
    if ((state as R)?.success) onSuccess()
  }, [state, onSuccess])

  const activeDoctors = doctors.filter((d) => d.status === 'active')

  return (
    <SModal title="Kullanıcı Davet Et" subtitle="E-posta izin listesine ekler. Kişi Google ile ilk girişinde hesabı oluşturulur." onClose={onClose}>
      <form action={action} className="p-6 space-y-4">
        {(state as R)?.error && <ErrBox msg={(state as R)!.error!} />}
        <SettField label="Ad Soyad" name="full_name" placeholder="Ayşe Yılmaz" />
        <SettField label="Google E-postası *" name="email" type="email" required placeholder="personel@gmail.com" />
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
            <option value="responsible_manager">Mesul Müdür</option>
          </select>
        </div>
        {role === 'hekim' && (
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Bağlı Şube</label>
          <select name="branch_id" defaultValue={branches.find((branch) => branch.is_default)?.id ?? ''} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            {branches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Yetki Seviyesi</label>
          <select name="access_level" defaultValue="branch" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            <option value="branch">Yalnızca bağlı şube</option>
            <option value="all">Tüm şubeler</option>
          </select>
        </div>
        <MActions onCancel={onClose} pending={pending} label="Davet Et" />
      </form>
    </SModal>
  )
}
