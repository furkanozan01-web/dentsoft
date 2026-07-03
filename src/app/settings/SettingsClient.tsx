'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SETTINGS_TABS as TABS } from './constants'
import type { AppointmentType, ClinicSettings, Doctor, Profile, SettingsTab, Tariff, TariffPriceHistory } from './types'
import type { TariffProfile, RolePermissionRow } from './actions'
import { UserModal } from './UserModal'
import KlinikTab from './KlinikTab'
import DisHekimiTab from './DisHekimiTab'
import KullaniciTab from './KullaniciTab'
import TarifeTab from './TarifeTab'
import RandevuTab from './RandevuTab'
export type { Branch, ClinicSettings, DayHours, Doctor, Profile, Tariff, TariffProfile } from './types'
import type { Branch } from './types'
import { syncDoctorsToUsers } from './actions'

// ---- Main ----
export default function SettingsClient({
  clinic,
  doctors: initialDoctors,
  profiles: initialProfiles,
  branches,
  tariffs: initialTariffs,
  tariffProfiles: initialTariffProfiles,
  tariffHistory,
  appointmentTypes,
  isAdmin,
  currentUserId,
  activeBranchId,
  rolePermissions,
}: {
  clinic: ClinicSettings
  doctors: Doctor[]
  profiles: Profile[]
  branches: Branch[]
  tariffs: Tariff[]
  tariffProfiles: TariffProfile[]
  tariffHistory: TariffPriceHistory[]
  appointmentTypes: AppointmentType[]
  isAdmin: boolean
  currentUserId: string
  activeBranchId: number | null
  rolePermissions: RolePermissionRow[]
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('klinik')
  const [showUserModal, setShowUserModal] = useState(false)
  const usersSynced = useRef(false)

  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    if (activeTab !== 'kullanici' || !isAdmin || usersSynced.current) return
    usersSynced.current = true
    void syncDoctorsToUsers().then((result) => {
      if (result?.success) refresh()
    })
  }, [activeTab, isAdmin, refresh])

  return (
    <div className="flex min-h-full flex-col bg-[#F6F8FB]">
      {/* Header */}
      <div className="px-8 pt-7 pb-0">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#5FD3C1]/15 text-[#1EAEA0]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F2B3D]">Ayarlar</h1>
            <p className="text-xs text-gray-400">Klinik, hekim, kullanıcı ve sistem yapılandırması</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-8 overflow-x-auto border-b border-[#E7ECF2]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2DD4BF] text-[#0F2B3D]'
                  : 'border-transparent text-slate-400 hover:text-[#142536]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6">
        {activeTab === 'klinik' && <KlinikTab clinic={clinic} branches={branches} activeBranchId={activeBranchId} canManage={isAdmin} onSaved={refresh} />}
        {activeTab === 'dis-hekimi' && (
          <DisHekimiTab doctors={initialDoctors} branches={branches} isAdmin={isAdmin} onChanged={refresh} />
        )}
        {activeTab === 'kullanici' && (
          <KullaniciTab
            profiles={initialProfiles}
            doctors={initialDoctors}
            branches={branches}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            rolePermissions={rolePermissions}
            onAdd={() => setShowUserModal(true)}
            onChanged={refresh}
          />
        )}
        {activeTab === 'tarife' && (
          <TarifeTab
            tariffProfiles={initialTariffProfiles}
            tariffs={initialTariffs}
            onChanged={refresh}
            branches={branches}
            history={tariffHistory}
          />
        )}
        {activeTab === 'randevu' && (
          <RandevuTab clinic={clinic} doctors={initialDoctors} branches={branches} appointmentTypes={appointmentTypes} onSaved={refresh} />
        )}
      </div>

      {/* Modals */}
      {showUserModal && (
        <UserModal
          doctors={initialDoctors}
          branches={branches}
          onClose={() => setShowUserModal(false)}
          onSuccess={() => { setShowUserModal(false); refresh() }}
        />
      )}
    </div>
  )
}
