'use client'

import { useState, useEffect, useMemo, useActionState, useTransition, useCallback, useRef, Fragment, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { parseToKurus } from '@/lib/format'
import {
  updateClinic,
  updateRandevuSettings,
  addDoctor,
  updateDoctor,
  deleteDoctor,
  toggleMesulMudur,
  updateUserRole,
  setUserActive,
  updateRolePermission,
  getUserPermissionsPanel,
  updateUserPermission,
  resetUserPermissions,
  deleteTariffItem,
  importTdb2024,
  importTufanbeyli,
  syncTdbProfile,
  copyTariffProfile,
  deleteTariffProfile,
  renameTariffProfile,
  setDefaultProfile,
  toggleTariffItemActive,
  updateTariffItemPrice,
  updateTariffItemDuration,
  updateTariffItemColor,
  addTariffItemToProfile,
  uploadClinicLogo,
} from './actions'
import type { TariffProfile, RolePermissionRow, UserPermissionRow, PermissionFields } from './actions'
import { ASSIGNABLE_ROLES, DAYS, PAYMENT_MODEL_LABEL, ROLE_LABEL, SETTINGS_TABS as TABS, SPECIALTIES } from './constants'
import { emptyWorkHours, fmtPrice } from './helpers'
import type { AppointmentType, ClinicSettings, DayHours, Doctor, Profile, R, SettingsTab, Tariff, TariffPriceHistory } from './types'
import { ErrBox } from './SettingsSharedUI'
import { UserModal } from './UserModal'
import BranchManager from './BranchManager'
import { BulkPriceModal, PriceHistoryModal, TariffCards, TreatmentVisual, VISUAL_SCHEMAS, inferTariffVisual } from './TariffEnhancements'
import AppointmentSettingsEnhancements from './AppointmentSettingsEnhancements'
export type { Branch, ClinicSettings, DayHours, Doctor, Profile, Tariff, TariffProfile } from './types'
import type { Branch } from './types'
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

  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

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

// ---- Klinik Tab ----
function KlinikTab({ clinic, branches, activeBranchId, canManage, onSaved }: { clinic: ClinicSettings; branches: Branch[]; activeBranchId: number | null; canManage: boolean; onSaved: () => void }) {
  const [state, action, pending] = useActionState(updateClinic, null as R)
  const [logoState, logoAction, logoPending] = useActionState(uploadClinicLogo, null as R)
  const [logoPreview, setLogoPreview] = useState<string | null>(clinic.logo_url ?? null)
  const [vatEditable, setVatEditable] = useState(false)

  useEffect(() => {
    if ((state as R)?.success) onSaved()
  }, [state, onSaved])

  useEffect(() => {
    if ((logoState as R)?.success) onSaved()
  }, [logoState, onSaved])

  const vatRate = clinic.vat_rate != null ? clinic.vat_rate / 100 : 10
  const hasClinicIdentity = Boolean(clinic.clinic_name && clinic.phone && clinic.email)
  const hasInvoiceInfo = Boolean(clinic.tax_no && clinic.tax_office && clinic.invoice_institution)
  const hasAddress = Boolean(clinic.address)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="space-y-6">
        <BranchManager branches={branches} activeBranchId={activeBranchId} canManage={canManage} onChanged={onSaved} />
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-start gap-3">
            <SettingsIconBox><IconImage /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Klinik Logosu</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Fatura, reçete ve hasta çıktılarında kullanılacak klinik logosu.</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] text-slate-400">
              {logoPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                </>
              ) : (
                <IconImageLarge />
              )}
            </div>
            <form action={logoAction} className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="min-w-0 flex-1 cursor-pointer">
                  <input
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setLogoPreview(URL.createObjectURL(f))
                    }}
                  />
                  <span className="flex h-12 items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[#FAFBFC] px-4 text-sm font-bold text-slate-500 transition hover:border-[#5FD3C1] hover:text-[#142536]">
                    <IconUpload />
                    Dosya Seç
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={logoPending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-5 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-60"
                >
                  <IconUpload />
                  {logoPending ? 'Yükleniyor...' : 'Yükle'}
                </button>
              </div>
              {(logoState as R)?.error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{(logoState as R)!.error}</p>}
              {(logoState as R)?.success && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-600">Logo başarıyla yüklendi.</p>}
              <p className="mt-3 text-xs font-medium text-slate-400">PNG, JPG, SVG veya WebP · Maks. 2 MB · Fatura ve reçetede görünür</p>
            </form>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-start gap-3">
            <SettingsIconBox><IconBuilding /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Klinik Bilgileri</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Klinik kimlik, iletişim, vergi ve fatura ayarları.</p>
            </div>
          </div>

          <form action={action} className="space-y-7">
            {(state as R)?.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{(state as R)!.error}</div>}
            {(state as R)?.success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-600">Klinik bilgileri kaydedildi.</div>}

            <ClinicFormSection title="Klinik Kimliği" icon={<IconBuilding />}> 
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <ModernField label="Klinik Adı" name="clinic_name" defaultValue={clinic.clinic_name} required />
                <ModernField label="Telefon" name="phone" defaultValue={clinic.phone ?? ''} type="tel" />
                <ModernField label="E-posta" name="email" defaultValue={clinic.email ?? ''} type="email" />
                <ModernField label="Yetkili Kişi" name="authorized_person" defaultValue={clinic.authorized_person ?? ''} />
                <ModernField label="Ünit Sayısı" name="unit_count" defaultValue={String(clinic.unit_count ?? 1)} type="number" />
                <ModernField label="Banka Masrafı (%)" name="bank_fee_pct" defaultValue={String((clinic.bank_fee_bps ?? 0) / 100)} type="number" />
                <label className="block"><span className="mb-2 block text-[13px] font-bold text-slate-500">Varsayılan Para Birimi</span><select name="default_currency" defaultValue={clinic.default_currency ?? 'TRY'} className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-semibold text-[#142536]"><option value="TRY">TRY — Türk Lirası</option><option value="USD">USD — Amerikan Doları</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Sterlin</option></select></label>
                <label className="flex items-center gap-3 self-end rounded-2xl border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-3 text-sm font-bold text-slate-600"><input type="checkbox" name="is_active" defaultChecked={clinic.is_active ?? true} />Klinik aktif</label>
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Vergi ve Fatura Bilgileri" icon={<IconReceipt />}> 
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <ModernField label="Vergi No" name="tax_no" defaultValue={clinic.tax_no ?? ''} />
                <ModernField label="Vergi Dairesi" name="tax_office" defaultValue={clinic.tax_office ?? ''} />
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-[13px] font-bold text-slate-500">KDV Matrahı / Oranı (%)</label>
                    <button
                      type="button"
                      onClick={() => setVatEditable((v) => !v)}
                      className="rounded-xl border border-[#E7ECF2] bg-[#F8FAFC] px-3 py-2 text-xs font-black text-[#142536] transition hover:border-[#5FD3C1] hover:text-[#0F766E]"
                    >
                      {vatEditable ? 'Kilitle' : 'KDV Matrahını Değiştir'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      name="vat_rate_pct"
                      min={0}
                      max={100}
                      step={1}
                      readOnly={!vatEditable}
                      defaultValue={vatRate}
                      className={`h-12 w-full rounded-2xl border border-[#E7ECF2] px-4 pr-10 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15 ${vatEditable ? 'bg-white' : 'bg-[#F8FAFC] text-slate-500'}`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-400">Varsayılan KDV %10&apos;dur.</p>
                </div>
                <div>
                  <ModernField
                    label="E-Fatura Gönderim Kurumu"
                    name="invoice_institution"
                    defaultValue={clinic.invoice_institution ?? ''}
                    placeholder="Örn: Logo, EDM, Uyumsoft"
                  />
                  {!clinic.invoice_institution && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7E6] px-3 py-2.5 text-xs font-semibold text-[#B45309]">
                      <IconAlert />
                      <span>Gönderim kurumu tanımlı değilse fatura gönderimi pasif kalabilir.</span>
                    </div>
                  )}
                </div>
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Adres" icon={<IconMapPin />}> 
              <div>
                <label className="mb-2 block text-[13px] font-bold text-slate-500">Adres</label>
                <textarea
                  name="address"
                  rows={4}
                  defaultValue={clinic.address ?? ''}
                  className="min-h-24 w-full resize-y rounded-2xl border border-[#E7ECF2] bg-white px-4 py-3 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
                />
              </div>
            </ClinicFormSection>

            <div className="flex justify-end border-t border-[#EEF2F6] pt-5 sm:justify-start">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-6 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-60 sm:w-auto"
              >
                <IconSave />
                {pending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-start gap-3">
            <SettingsIconBox><IconClipboard /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Klinik Profil Özeti</h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">Çıktılara yansıyacak temel bilgiler</p>
            </div>
          </div>
          <div className="space-y-3">
            <ProfileStatusRow label="Logo durumu" value={logoPreview ? 'Yüklendi' : 'Yüklenmedi'} ok={Boolean(logoPreview)} />
            <ProfileStatusRow label="Klinik bilgileri" value={hasClinicIdentity ? 'Tamamlandı' : 'Eksik'} ok={hasClinicIdentity} />
            <ProfileStatusRow label="E-fatura kurumu" value={clinic.invoice_institution || 'Tanımlı değil'} ok={Boolean(clinic.invoice_institution)} />
            <ProfileStatusRow label="Vergi bilgileri" value={hasInvoiceInfo ? 'Tamamlandı' : 'Eksik'} ok={hasInvoiceInfo} />
            <ProfileStatusRow label="Adres" value={hasAddress ? 'Tanımlı' : 'Eksik'} ok={hasAddress} />
          </div>
          <div className="mt-5 rounded-[18px] bg-[#FAFBFC] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">KDV Oranı</p>
            <p className="mt-1 text-2xl font-black text-[#142536]">%{vatRate}</p>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-start gap-3">
            <SettingsIconBox><IconReceipt /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Çıktılarda Kullanılır</h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">Klinik profili bu belgelerde görünür.</p>
            </div>
          </div>
          <div className="space-y-3">
            <PrintUsageRow icon={<IconReceipt />} label="Fatura" />
            <PrintUsageRow icon={<IconClipboard />} label="Reçete" />
            <PrintUsageRow icon={<IconFileText />} label="Hasta çıktıları" />
            <PrintUsageRow icon={<IconBuilding />} label="Klinik antetleri" />
          </div>
        </section>
      </aside>
    </div>
  )
}

function SettingsIconBox({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5FD3C1]/15 text-[#1EAEA0]">{children}</span>
}

function ClinicFormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[#EEF2F6] pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F8FAFC] text-[#0F766E]">{icon}</span>
        <h3 className="text-sm font-black text-[#142536]">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function ModernField({ label, name, type = 'text', required, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-bold text-slate-500">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-300 focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
      />
    </div>
  )
}

function ProfileStatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${ok ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{value}</span>
    </div>
  )
}

function PrintUsageRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3 text-sm font-bold text-[#142536]">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0F766E] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">{icon}</span>
      {label}
    </div>
  )
}

function IconBuilding() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 21V9h6v12" /><path d="M9 3v3" /><path d="M15 3v3" /><path d="M3 13h18" /></svg>
}

function IconImage() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
}

function IconImageLarge() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
}

function IconUpload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
}

function IconSave() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>
}

function IconReceipt() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 12h8" /><path d="M8 17h5" /></svg>
}

function IconClipboard() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 14h6" /><path d="M9 18h4" /></svg>
}

function IconFileText() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
}

function IconMapPin() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
}

function IconAlert() {
  return <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
}
// ---- Dis Hekimi Tab ----
function DisHekimiTab({ doctors, branches, isAdmin, onChanged }: { doctors: Doctor[]; branches: Branch[]; isAdmin: boolean; onChanged: () => void }) {
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<'none' | 'new' | 'edit'>('none')
  const [delPending, startDel] = useTransition()

  const selected = doctors.find((d) => d.id === selectedId) ?? null
  const activeDoctors = doctors.filter((d) => d.status === 'active')
  const undefinedModelCount = doctors.filter((d) => !d.payment_model).length

  const openNew = () => { setSelectedId(null); setMode('new') }
  const openEdit = (d: Doctor) => { setSelectedId(d.id); setMode('edit') }
  const closeEditor = () => { setMode('none'); setSelectedId(null) }

  const handleDelete = async (d: Doctor) => {
    const ok = await confirm({
      title: 'Hekimi Pasife Al',
      message: 'Dt. ' + d.name + ' pasife alınacak (kayıt silinmez). Devam edilsin mi?',
      confirmText: 'Evet',
    })
    if (!ok) return
    const fd = new FormData()
    fd.set('id', String(d.id))
    startDel(async () => {
      const res = await deleteDoctor(null, fd)
      if ((res as R)?.error) toast.error((res as R)!.error!)
      else {
        toast.success('Hekim pasife alındı')
        if (selectedId === d.id) closeEditor()
        onChanged()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DoctorStatCard title="Toplam Hekim" value={doctors.length} tone="blue" icon={<IconUsers />} />
        <DoctorStatCard title="Aktif Hekim" value={activeDoctors.length} tone="green" icon={<IconCheckCircle />} />
        <DoctorStatCard title="Model Tanımsız" value={undefinedModelCount} tone="amber" icon={<IconAlert />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#EEF2F6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <SettingsIconBox><IconUsers /></SettingsIconBox>
              <div>
                <h2 className="text-base font-black text-[#142536]">Diş Hekimleri</h2>
                <p className="mt-1 text-sm font-medium text-slate-400">Klinikte görev yapan hekimler ve ödeme modelleri</p>
              </div>
            </div>
            <button onClick={openNew} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105">
              <IconPlus />
              Hekim Ekle
            </button>
          </div>

          {doctors.length === 0 ? (
            <div className="p-6">
              <div className="flex min-h-60 flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]"><IconUsers /></span>
                <h3 className="text-sm font-black text-[#142536]">Henüz diş hekimi eklenmemiş.</h3>
                <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-slate-400">Hekim ekleyerek randevu, tedavi ve hakediş takibini başlatabilirsiniz.</p>
                <button onClick={openNew} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)]"><IconPlus />Hekim Ekle</button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-[#FAFBFC]">
                  <tr className="h-14 border-b border-[#EEF2F6] text-slate-400">
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Ad Soyad</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Uzmanlık</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Ödeme Modeli</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Durum</th>
                    <th className="px-5 text-right text-xs font-black uppercase tracking-wide">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d, index) => {
                    const isSel = selectedId === d.id
                    const isActive = d.status === 'active'
                    const hasCommission = d.payment_model === 'commission' || d.payment_model === 'hybrid'
                    const modelLabel = d.payment_model ? PAYMENT_MODEL_LABEL[d.payment_model] ?? d.payment_model : 'Tanımsız'
                    const rowClass = 'h-20 cursor-pointer border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04] ' + (isSel ? 'bg-[#5FD3C1]/[0.08] ' : '') + (!isActive ? 'opacity-65' : '')
                    return (
                      <tr key={d.id} onClick={() => openEdit(d)} className={rowClass}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm" style={{ background: d.color ?? (index % 2 === 0 ? 'linear-gradient(135deg,#60A5FA,#7C3AED)' : 'linear-gradient(135deg,#5FD3C1,#0284C7)') }}>{d.name[0]}</div>
                            <div className="min-w-0"><p className="truncate font-black text-[#142536]">Dt. {d.name}</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{d.specialty || 'Uzmanlık belirtilmedi'}</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1.5 text-xs font-bold text-slate-600">{d.specialty || 'Belirtilmedi'}</span></td>
                        <td className="px-5 py-4">
                          {d.payment_model ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E8FF] px-3 py-1.5 text-xs font-black text-[#7C3AED]"><IconPercent />{modelLabel}{hasCommission && ' · %' + ((d.commission_rate_bps ?? 0) / 100).toLocaleString('tr-TR')}</span>
                          ) : (
                            <div className="space-y-1"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] px-3 py-1.5 text-xs font-black text-[#B45309]"><IconAlert />Tanımsız</span><p className="text-[11px] font-semibold text-[#B45309]">Hakediş hesaplanamaz.</p></div>
                          )}
                        </td>
                        <td className="px-5 py-4"><span className={'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ' + (isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}><span className={'h-2 w-2 rounded-full ' + (isActive ? 'bg-green-500' : 'bg-slate-400')} />{isActive ? 'Aktif' : 'Pasif'}</span></td>
                        <td className="px-5 py-4"><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); openEdit(d) }} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#E6FFFA] hover:text-[#0F766E]" title="Düzenle"><IconPencil /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(d) }} disabled={delPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Pasife al"><IconTrash /></button></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-[#EEF2F6] px-6 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Toplam {doctors.length} hekim listeleniyor</span><span>Model tanımsız: {undefinedModelCount}</span></div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7E6] p-5 text-[#B45309] shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70"><IconAlert /></span><div><h3 className="text-sm font-black">Hakediş Durumu</h3><p className="mt-1 text-xs font-semibold leading-5">{undefinedModelCount > 0 ? undefinedModelCount + ' hekimde ödeme modeli tanımsız.' : 'Tüm hekimlerde ödeme modeli tanımlı.'}</p></div></div>
            <p className="text-xs font-semibold leading-5">Hakediş hesaplaması için her hekime ödeme modeli tanımlanmalıdır.</p>
          </section>
          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start gap-3"><SettingsIconBox><IconWallet /></SettingsIconBox><div><h3 className="text-base font-black text-[#142536]">Ödeme Modeli Türleri</h3><p className="mt-1 text-xs font-semibold text-slate-400">Finans hakediş ekranında bu modele göre hesaplanır.</p></div></div>
            <div className="space-y-3"><PaymentInfoRow title="Sabit Maaş" description="Aylık sabit tutar üzerinden takip edilir." icon={<IconWallet />} /><PaymentInfoRow title="Komisyon" description="Ciro veya net kâr oranına göre hesaplanır." icon={<IconPercent />} /><PaymentInfoRow title="Karma Model" description="Maaş ve komisyon birlikte kullanılır." icon={<IconClipboard />} /></div>
          </section>
        </aside>
      </div>

      {mode !== 'none' && (<DoctorEditor key={mode === 'edit' ? selected?.id ?? 'edit' : 'new'} doctor={mode === 'edit' ? selected : null} branches={branches} isAdmin={isAdmin} onCancel={closeEditor} onSaved={() => { closeEditor(); onChanged() }} />)}
    </div>
  )
}

function DoctorStatCard({ title, value, tone, icon }: { title: string; value: number; tone: 'blue' | 'green' | 'amber'; icon: ReactNode }) {
  const toneClass = { blue: 'bg-[#EAF7FF] text-[#0284C7]', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600' }[tone]
  return <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-3xl font-black text-[#142536]">{value}</p></div>
}

function PaymentInfoRow({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F766E] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">{icon}</span><span><strong className="block text-sm font-black text-[#142536]">{title}</strong><span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-400">{description}</span></span></div>
}

function IconUsers() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function IconCheckCircle() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m22 4-10 10.01-3-3" /></svg> }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg> }
function IconPercent() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg> }
function IconPencil() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg> }
function IconTrash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg> }
function IconWallet() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M18 12h.01" /></svg> }

function DoctorEditor({
  doctor,
  branches,
  isAdmin,
  onCancel,
  onSaved,
}: {
  doctor: Doctor | null
  branches: Branch[]
  isAdmin: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const isNew = !doctor
  const existingNameParts = (doctor?.name ?? '').trim().split(/\s+/).filter(Boolean)
  const [firstName, setFirstName] = useState(existingNameParts.length > 1 ? existingNameParts.slice(0, -1).join(' ') : existingNameParts[0] ?? '')
  const [surname, setSurname] = useState(existingNameParts.length > 1 ? existingNameParts.at(-1) ?? '' : '')
  const [title, setTitle] = useState(doctor?.title ?? 'Diş Hekimi')
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? '')
  const [phone, setPhone] = useState(doctor?.phone ?? '')
  const [email, setEmail] = useState(doctor?.email ?? '')
  const [diplomaNo, setDiplomaNo] = useState(doctor?.diploma_no ?? '')
  const [tcIdentityNo, setTcIdentityNo] = useState(doctor?.tc_identity_no ?? '')
  const [diplomaDate, setDiplomaDate] = useState(doctor?.diploma_date ?? '')
  const [birthDate, setBirthDate] = useState(doctor?.birth_date ?? '')
  const [status, setStatus] = useState(doctor?.status ?? 'active')
  const [branchId, setBranchId] = useState(String(doctor?.branch_id ?? branches.find((branch) => branch.is_default)?.id ?? ''))
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [userAccessLevel, setUserAccessLevel] = useState('branch')
  const [isMesulMudur, setIsMesulMudur] = useState(doctor?.is_mesul_mudur ?? false)
  const [salaryStr, setSalaryStr] = useState(
    doctor?.monthly_salary != null ? String(doctor.monthly_salary / 100) : ''
  )
  const [rateStr, setRateStr] = useState(
    doctor?.commission_rate_bps ? String(doctor.commission_rate_bps / 100) : ''
  )
  const [bonusStr, setBonusStr] = useState(doctor?.bonus_amount ? String(doctor.bonus_amount / 100) : '')
  const [guaranteeActive, setGuaranteeActive] = useState(doctor?.guarantee_active ?? false)
  const [guaranteeAmountStr, setGuaranteeAmountStr] = useState(doctor?.guarantee_amount ? String(doctor.guarantee_amount / 100) : '')
  const [guaranteePeriod, setGuaranteePeriod] = useState(doctor?.guarantee_period ?? 'monthly')
  const [guaranteeMethod, setGuaranteeMethod] = useState(doctor?.guarantee_method ?? 'minimum_total')
  const [guaranteeNote, setGuaranteeNote] = useState(doctor?.guarantee_note ?? '')
  const [shareActive, setShareActive] = useState(doctor?.share_active ?? false)
  const [shareRateStr, setShareRateStr] = useState(doctor?.share_rate_bps ? String(doctor.share_rate_bps / 100) : '')
  const [shareStartDate, setShareStartDate] = useState(doctor?.share_start_date ?? '')
  const [shareEndDate, setShareEndDate] = useState(doctor?.share_end_date ?? '')
  const [shareBranchId, setShareBranchId] = useState(String(doctor?.share_branch_id ?? ''))
  const [sharePeriod, setSharePeriod] = useState(doctor?.share_period ?? 'monthly')
  const [shareNote, setShareNote] = useState(doctor?.share_note ?? '')
  const [profitDistributionType, setProfitDistributionType] = useState(doctor?.profit_distribution_type ?? 'profit_distribution')
  const [salaryDay, setSalaryDay] = useState(doctor?.salary_day ? String(doctor.salary_day) : '')
  const [paymentAccount, setPaymentAccount] = useState(doctor?.payment_account ?? '')
  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const base = emptyWorkHours()
    const src = doctor?.work_hours_json
    if (src) for (const k of Object.keys(base)) if (src[k]) base[k] = { ...base[k], ...src[k] }
    return base
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const rateBps = Math.round((parseFloat(rateStr.replace(',', '.')) || 0) * 100)
  const shareRateBps = Math.round((parseFloat(shareRateStr.replace(',', '.')) || 0) * 100)

  const setDay = (key: string, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }))

  const submit = () => {
    if (!firstName.trim() || !surname.trim()) {
      setError('Ad ve soyad zorunludur')
      return
    }
    setError(null)
    const payload = {
      name: `${firstName.trim()} ${surname.trim()}`,
      title: title.trim() || 'Diş Hekimi',
      specialty: specialty || null,
      phone: phone || null,
      email: email || null,
      diploma_no: diplomaNo || null,
      tc_identity_no: tcIdentityNo || null,
      diploma_date: diplomaDate || null,
      birth_date: birthDate || null,
      color: doctor?.color ?? '#3b82f6',
      status,
      branch_id: branchId ? Number(branchId) : null,
      create_user_account: isNew && createUserAccount,
      user_access_level: userAccessLevel,
      payment_model: null,
      monthly_salary: salaryStr ? parseToKurus(salaryStr) : 0,
      commission_rate_bps: rateBps,
      guarantee_amount: guaranteeActive && guaranteeAmountStr ? parseToKurus(guaranteeAmountStr) : 0,
      bonus_amount: bonusStr ? parseToKurus(bonusStr) : 0,
      per_transaction_amount: null,
      guarantee_active: guaranteeActive,
      guarantee_period: guaranteePeriod,
      guarantee_method: guaranteeMethod,
      guarantee_note: guaranteeNote || null,
      share_active: shareActive,
      share_rate_bps: shareRateBps,
      share_start_date: shareStartDate || null,
      share_end_date: shareEndDate || null,
      share_branch_id: shareBranchId ? Number(shareBranchId) : null,
      share_period: sharePeriod,
      share_note: shareNote || null,
      profit_distribution_type: profitDistributionType,
      salary_day: salaryDay ? Number(salaryDay) : null,
      payment_account: paymentAccount || null,
      work_hours_json: hours,
    }
    startTransition(async () => {
      const res = isNew ? await addDoctor(payload) : await updateDoctor(doctor!.id, payload)
      if ((res as R)?.error) {
        setError((res as R)!.error!)
        toast.error((res as R)!.error!)
        return
      }
      toast.success(isNew ? 'Hekim eklendi' : 'Hekim bilgileri kaydedildi')
      onSaved()
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0F2B3D]">
          {isNew ? 'Yeni Hekim' : `Dt. ${doctor!.name} — Düzenle`}
        </h2>
        <button type="button" onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {error && <ErrBox msg={error} />}

      {/* KİŞİSEL BİLGİLER */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Kişisel Bilgiler</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ad *</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Furkan" className={inputCls} />
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Soyad *</label><input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Ozancı" className={inputCls} /></div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Uzmanlık</label>
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputCls}>
              <option value="">Seçiniz</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              {specialty && !SPECIALTIES.includes(specialty) && <option value={specialty}>{specialty}</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ünvan</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diş Hekimi" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Bağlı Şube</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
              <option value="">Şube seçin</option>
              {branches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0555 111 22 33" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hekim@klinik.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Diploma Numarası</label>
            <input value={diplomaNo} onChange={(e) => setDiplomaNo(e.target.value)} className={inputCls} />
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">T.C. Kimlik Numarası</label><input inputMode="numeric" maxLength={11} value={tcIdentityNo} onChange={(e) => setTcIdentityNo(e.target.value.replace(/\D/g, '').slice(0, 11))} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Diploma Tarihi</label><input type="date" value={diplomaDate} onChange={(e) => setDiplomaDate(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Doğum Tarihi</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">Durum:</span>
            <button
              type="button"
              onClick={() => setStatus((s) => (s === 'active' ? 'passive' : 'active'))}
              className={`relative w-11 h-6 rounded-full transition-colors ${status === 'active' ? 'bg-[#2DD4BF]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${status === 'active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-[#0F2B3D]">{status === 'active' ? 'Aktif' : 'Pasif'}</span>
          </div>
          {!isNew && isAdmin && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">Mesul Müdür:</span>
              <button
                type="button"
                onClick={async () => {
                  const next = !isMesulMudur
                  setIsMesulMudur(next)
                  const res = await toggleMesulMudur(doctor!.id, next)
                  if ((res as { error?: string })?.error) {
                    toast.error((res as { error?: string })!.error!)
                    setIsMesulMudur(!next)
                  } else {
                    toast.success(next ? 'Mesul müdür olarak atandı' : 'Mesul müdür yetkisi kaldırıldı')
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${isMesulMudur ? 'bg-violet-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isMesulMudur ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-[#0F2B3D]">{isMesulMudur ? 'Evet' : 'Hayır'}</span>
            </div>
          )}
        </div>
      </section>

      {isNew && (
        <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <label className="flex items-start gap-3 text-sm font-black text-[#1D4ED8]"><input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} className="mt-1" /><span>Bu hekimi aynı zamanda kullanıcı olarak ekle<span className="mt-1 block text-xs font-semibold text-blue-500">Hekimin e-postası giriş izin listesine eklenir ve ilk girişinde hesabı otomatik bağlanır.</span></span></label>
          {createUserAccount && <div className="mt-4"><label className="block text-xs font-medium text-blue-600 mb-1.5">Yetki Seviyesi</label><select value={userAccessLevel} onChange={(e) => setUserAccessLevel(e.target.value)} className={inputCls}><option value="branch">Yalnızca bağlı şube</option><option value="all">Tüm şubeler</option></select></div>}
        </section>
      )}

      {/* HAKEDİŞ MODELİ */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Esnek Hakediş Ayarları</h3>
        <p className="mb-4 text-xs font-semibold text-slate-400">Sistem girilen tutarlara göre sabit, komisyon veya karma modeli otomatik belirler.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-black uppercase text-emerald-700">Sabit Ücret</p><label className="mt-3 block text-xs font-bold text-slate-500">Aylık tutar (₺)<input value={salaryStr} onChange={(e) => setSalaryStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} /></label></div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-black uppercase text-blue-700">Komisyon</p><label className="mt-3 block text-xs font-bold text-slate-500">Tahsilat oranı: %{rateStr || '0'}<input type="range" min="0" max="100" step="0.5" value={rateStr || '0'} onChange={(e) => setRateStr(e.target.value)} className="mt-3 w-full accent-blue-600" /></label><input value={rateStr} onChange={(e) => setRateStr(e.target.value)} placeholder="0" className={`mt-2 ${inputCls}`} /></div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-xs font-black uppercase text-amber-700">Prim</p><label className="mt-3 block text-xs font-bold text-slate-500">Aylık prim (₺)<input value={bonusStr} onChange={(e) => setBonusStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} /></label></div>
        </div>

        <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <label className="flex items-center justify-between gap-3 text-sm font-black text-violet-800"><span>Garantör</span><input type="checkbox" checked={guaranteeActive} onChange={(e) => setGuaranteeActive(e.target.checked)} /></label>
          {guaranteeActive && <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-500">Garantör tutarı (₺)<input value={guaranteeAmountStr} onChange={(e) => setGuaranteeAmountStr(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Dönem<select value={guaranteePeriod} onChange={(e) => setGuaranteePeriod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option><option value="yearly">Yıllık</option></select></label><label className="text-xs font-bold text-slate-500">Hesaplama yöntemi<select value={guaranteeMethod} onChange={(e) => setGuaranteeMethod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="minimum_total">Toplam hakedişi minimuma tamamla</option><option value="commission_only">Komisyon ve primi minimuma tamamla</option></select></label><label className="text-xs font-bold text-slate-500">Açıklama<input value={guaranteeNote} onChange={(e) => setGuaranteeNote(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label></div>}
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <label className="flex items-center justify-between gap-3 text-sm font-black text-rose-800"><span>Hisse / Kâr Payı</span><input type="checkbox" checked={shareActive} onChange={(e) => setShareActive(e.target.checked)} /></label>
          {shareActive && <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold text-slate-500">Hisse oranı (%)<input value={shareRateStr} onChange={(e) => setShareRateStr(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Başlangıç<input type="date" value={shareStartDate} onChange={(e) => setShareStartDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Bitiş<input type="date" value={shareEndDate} onChange={(e) => setShareEndDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Geçerli şube<select value={shareBranchId} onChange={(e) => setShareBranchId(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="">Tüm erişilebilir klinik</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Hesaplama dönemi<select value={sharePeriod} onChange={(e) => setSharePeriod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option><option value="yearly">Yıllık</option></select></label><label className="text-xs font-bold text-slate-500">Muhasebe sınıfı<select value={profitDistributionType} onChange={(e) => setProfitDistributionType(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="profit_distribution">Kâr dağıtımı</option><option value="expense">Gider</option><option value="partner_payment">Ortak ödeme hareketi</option></select></label><label className="text-xs font-bold text-slate-500 md:col-span-2 lg:col-span-3">Açıklama<input value={shareNote} onChange={(e) => setShareNote(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label></div>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Maaş / Hakediş Günü</label>
            <input type="number" min="1" max="31" value={salaryDay} onChange={(e) => setSalaryDay(e.target.value)} placeholder="5" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Ödeme Kasası / Banka</label>
            <input value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} placeholder="Ana Kasa / İş Bankası" className={inputCls} />
          </div>
        </div>

      </section>

      {/* ÇALIŞMA SAATLERİ */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Çalışma Saatleri</h3>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            // Savunmacı: bozuk/eksik work_hours_json gün anahtarı çökme yapmasın.
            const day = hours[d.key] ?? { start: '09:00', end: '18:00', clinic: '', off: false }
            return (
              <div key={d.key} className="grid grid-cols-[110px_1fr_1fr_1.2fr_auto] items-center gap-2">
                <span className="text-sm text-gray-600">{d.label}</span>
                <input
                  type="time"
                  value={day.start}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { start: e.target.value })}
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <input
                  type="time"
                  value={day.end}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { end: e.target.value })}
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <input
                  type="text"
                  value={day.clinic}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { clinic: e.target.value })}
                  placeholder="Klinik (ops.)"
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={day.off} onChange={(e) => setDay(d.key, { off: e.target.checked })} className="w-3.5 h-3.5 rounded accent-gray-400" />
                  Çalışmıyor
                </label>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
          İptal
        </button>
        <button type="button" onClick={submit} disabled={pending} className="px-5 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : isNew ? 'Hekim Ekle' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  )
}

// ---- Kullanici Tab ----
function KullaniciTab({
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

// ---- Rol İzin Matrisi (role_permissions tablosundan gerçek veri) ----
const ROLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'bashekim', label: 'Başhekim' },
  { key: 'responsible_manager', label: 'Mesul Müdür' },
  { key: 'hekim', label: 'Hekim' },
  { key: 'asistan', label: 'Asistan' },
]

const RESOURCE_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: 'RANDEVULAR',
    items: [
      { key: 'randevu_sube', label: 'Randevu (Şube)' },
      { key: 'randevu_tum', label: 'Randevu (Tüm)' },
    ],
  },
  {
    title: 'HASTALAR',
    items: [
      { key: 'hasta_liste', label: 'Liste' },
      { key: 'hasta_karti', label: 'Hasta Kartı' },
      { key: 'oral_kendi', label: 'Oral (Kendi)' },
      { key: 'oral_sube', label: 'Oral (Şube)' },
      { key: 'oral_tum', label: 'Oral (Tüm)' },
      { key: 'not_goruntu', label: 'Not & Görüntü' },
      { key: 'hesap', label: 'Hesap' },
      { key: 'fatura', label: 'Fatura' },
      { key: 'recete', label: 'Reçete' },
    ],
  },
  {
    title: 'FİNANS',
    items: [
      { key: 'finans_bilgi', label: 'Bilgi' },
      { key: 'finans_borclar', label: 'Borçlar' },
      { key: 'finans_defter', label: 'Defter' },
      { key: 'finans_bakiye', label: 'Bakiye' },
      { key: 'hakedis_kendi', label: 'Hakediş — Kendi' },
      { key: 'hakedis_tum', label: 'Hakediş — Tüm Hekimler' },
      { key: 'is_ortaklari', label: 'İş Ortaklarımız' },
    ],
  },
  {
    title: 'AYARLAR',
    items: [
      { key: 'ayarlar_klinik', label: 'Klinik' },
      { key: 'ayarlar_hekim', label: 'Hekim' },
      { key: 'ayarlar_kullanici', label: 'Kullanıcı' },
      { key: 'ayarlar_tarife', label: 'Tarife' },
      { key: 'ayarlar_randevu', label: 'Randevu Ayarları' },
    ],
  },
]

type PermRow = { can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }
const EMPTY_PERM: PermRow = { can_view: false, can_create: false, can_update: false, can_delete: false }

function RolePermissionMatrix({ rolePermissions, isAdmin }: { rolePermissions: RolePermissionRow[]; isAdmin: boolean }) {
  const [selectedRole, setSelectedRole] = useState('bashekim')
  const [pending, startTransition] = useTransition()
  const [overrides, setOverrides] = useState<Record<string, PermRow>>({})

  useEffect(() => {
    setOverrides({})
  }, [selectedRole])

  const getRow = useCallback((resource: string): PermRow => {
    if (overrides[resource]) return overrides[resource]
    const found = rolePermissions.find((p) => p.role_name === selectedRole && p.resource === resource)
    return found
      ? { can_view: found.can_view, can_create: found.can_create, can_update: found.can_update, can_delete: found.can_delete }
      : EMPTY_PERM
  }, [overrides, rolePermissions, selectedRole])

  const persist = (resource: string, current: PermRow, next: PermRow) => {
    setOverrides((prev) => ({ ...prev, [resource]: next }))
    startTransition(async () => {
      const res = await updateRolePermission({
        roleName: selectedRole,
        resource,
        canView: next.can_view,
        canCreate: next.can_create,
        canUpdate: next.can_update,
        canDelete: next.can_delete,
      })
      if ((res as R)?.error) {
        toast.error((res as R)!.error!)
        setOverrides((prev) => ({ ...prev, [resource]: current }))
      } else {
        toast.success('İzin güncellendi')
      }
    })
  }

  const handleToggle = (resource: string, field: keyof PermRow, value: boolean) => {
    if (!isAdmin) return
    const current = getRow(resource)
    persist(resource, current, { ...current, [field]: value })
  }

  const handleToggleAll = (resource: string, value: boolean) => {
    if (!isAdmin) return
    const current = getRow(resource)
    persist(resource, current, { can_view: value, can_create: value, can_update: value, can_delete: value })
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#EEF2F6] px-6 py-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <SettingsIconBox><IconShield /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Rol İzin Matrisi</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Modüllere göre rollerin görüntüleme/yazma yetkileri</p>
            </div>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="h-10 rounded-full border border-[#E7ECF2] bg-white px-4 text-xs font-bold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold text-slate-500">
          <IconInfo />
          <span>{isAdmin ? 'Değişiklikler anında kaydedilir.' : 'Sadece başhekim düzenleyebilir — görüntüleme modundasınız.'}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#FAFBFC]">
            <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
              <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Modül</th>
              <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Göster</th>
              <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Yeni</th>
              <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Değiştir</th>
              <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Sil</th>
              <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Tümü</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <tr className="bg-[#FAFBFC]">
                  <td colSpan={6} className="px-5 pt-4 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{group.title}</td>
                </tr>
                {group.items.map((item) => {
                  const row = getRow(item.key)
                  const allChecked = row.can_view && row.can_create && row.can_update && row.can_delete
                  const disabled = !isAdmin || pending
                  return (
                    <tr key={item.key} className="h-14 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                      <td className="px-5 py-2 font-bold text-[#142536]">{item.label}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_view} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_view', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_create} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_create', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_update} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_update', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_delete} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_delete', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={allChecked} disabled={disabled} onChange={(e) => handleToggleAll(item.key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---- Kullanıcı Bazlı İzin Paneli (rol şablonu + kişisel override) ----
type PermField = 'can_view' | 'can_create' | 'can_update' | 'can_delete'
type RowStatus = 'idle' | 'pending' | 'success' | 'error'
const EMPTY_OVERRIDE: Omit<UserPermissionRow, 'resource'> = { can_view: null, can_create: null, can_update: null, can_delete: null }

function UserPermissionPanel({ user, isAdmin, onClose }: { user: Profile; isAdmin: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>(user.role)
  const [template, setTemplate] = useState<Record<string, RolePermissionRow>>({})
  const [overrides, setOverrides] = useState<Record<string, UserPermissionRow>>({})
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({})
  const [resetting, setResetting] = useState(false)
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getUserPermissionsPanel(user.id).then((res) => {
      if (cancelled) return
      if (res.error || !res.data) {
        toast.error(res.error ?? 'İzinler yüklenemedi')
        setLoading(false)
        return
      }
      setRole(res.data.role)
      setTemplate(Object.fromEntries(res.data.template.map((row) => [row.resource, row])))
      setOverrides(Object.fromEntries(res.data.overrides.map((row) => [row.resource, row])))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const effective = (resource: string, field: PermField): boolean => {
    const ov = overrides[resource]?.[field]
    if (ov !== undefined && ov !== null) return ov
    return template[resource]?.[field] === true
  }

  const isOverridden = (resource: string, field: PermField): boolean => {
    const ov = overrides[resource]?.[field]
    return ov !== undefined && ov !== null && ov !== (template[resource]?.[field] === true)
  }

  const setStatus = (resource: string, status: RowStatus) => {
    setRowStatus((s) => ({ ...s, [resource]: status }))
    if (status === 'success') {
      setTimeout(() => setRowStatus((s) => (s[resource] === 'success' ? { ...s, [resource]: 'idle' } : s)), 1500)
    }
  }

  const persist = (resource: string, patch: Partial<Record<'canView' | 'canCreate' | 'canUpdate' | 'canDelete', boolean>>, prevOverride: UserPermissionRow | undefined) => {
    setStatus(resource, 'pending')
    clearTimeout(timersRef.current[resource])
    timersRef.current[resource] = setTimeout(() => {
      updateUserPermission({ userId: user.id, resource, ...patch }).then((res) => {
        if ((res as R)?.error) {
          toast.error((res as R)!.error!)
          setOverrides((o) => ({ ...o, [resource]: prevOverride ?? { resource, ...EMPTY_OVERRIDE } }))
          setStatus(resource, 'error')
        } else {
          setStatus(resource, 'success')
        }
      })
    }, 500)
  }

  const handleToggle = (resource: string, field: PermField, value: boolean) => {
    if (!isAdmin) return
    const prevOverride = overrides[resource]
    const nextOverride: UserPermissionRow = {
      resource,
      can_view: prevOverride?.can_view ?? null,
      can_create: prevOverride?.can_create ?? null,
      can_update: prevOverride?.can_update ?? null,
      can_delete: prevOverride?.can_delete ?? null,
      [field]: value,
    }
    setOverrides((o) => ({ ...o, [resource]: nextOverride }))
    const fieldKey = { can_view: 'canView', can_create: 'canCreate', can_update: 'canUpdate', can_delete: 'canDelete' }[field] as 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'
    persist(resource, { [fieldKey]: value }, prevOverride)
  }

  const handleToggleAll = (resource: string, value: boolean) => {
    if (!isAdmin) return
    const prevOverride = overrides[resource]
    const nextOverride: UserPermissionRow = { resource, can_view: value, can_create: value, can_update: value, can_delete: value }
    setOverrides((o) => ({ ...o, [resource]: nextOverride }))
    persist(resource, { canView: value, canCreate: value, canUpdate: value, canDelete: value }, prevOverride)
  }

  const handleReset = async () => {
    setResetting(true)
    const res = await resetUserPermissions(user.id)
    setResetting(false)
    if ((res as R)?.error) {
      toast.error((res as R)!.error!)
      return
    }
    setOverrides({})
    toast.success('Kullanıcı rol şablonuna döndürüldü')
  }

  const roleLabel = ROLE_LABEL[role] ?? role

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[#142536]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Geri
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h2 className="text-base font-black text-[#0F2B3D]">
              {user.full_name ?? user.email ?? 'Kullanıcı'} — {roleLabel}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {isAdmin ? 'Rol şablonundan farklı hücreler sarı ile işaretlenir.' : 'Sadece görüntüleme modundasınız.'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 px-3 text-xs font-bold text-slate-500 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {resetting ? 'Sıfırlanıyor…' : 'Rol Şablonunu Sıfırla'}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm font-semibold text-slate-400">Yükleniyor…</div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-[#FAFBFC]">
                <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
                  <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Kaynak</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Göster</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Yeni</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Değiştir</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Sil</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Tümü</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCE_GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    <tr className="bg-[#FAFBFC]">
                      <td colSpan={6} className="px-5 pt-4 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{group.title}</td>
                    </tr>
                    {group.items.map((item) => {
                      const fields: PermField[] = ['can_view', 'can_create', 'can_update', 'can_delete']
                      const values = fields.map((f) => effective(item.key, f))
                      const allState: 'all' | 'none' | 'mixed' = values.every(Boolean) ? 'all' : values.every((v) => !v) ? 'none' : 'mixed'
                      const status = rowStatus[item.key] ?? 'idle'
                      const disabled = !isAdmin
                      return (
                        <tr key={item.key} className="h-14 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                          <td className="px-5 py-2 font-bold text-[#142536]">
                            <span className="inline-flex items-center gap-2">
                              {item.label}
                              {status === 'pending' && <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />}
                              {status === 'success' && <IconCheckTiny />}
                              {status === 'error' && <IconAlertTiny />}
                            </span>
                          </td>
                          {fields.map((field) => (
                            <td key={field} className={`px-3 py-2 text-center ${isOverridden(item.key, field) ? 'bg-amber-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={effective(item.key, field)}
                                disabled={disabled}
                                onChange={(e) => handleToggle(item.key, field, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <TriStateCheckbox state={allState} disabled={disabled} onChange={(v) => handleToggleAll(item.key, v)} />
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function TriStateCheckbox({ state, disabled, onChange }: { state: 'all' | 'none' | 'mixed'; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      ref={(el) => { if (el) el.indeterminate = state === 'mixed' }}
      checked={state === 'all'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40"
    />
  )
}

function IconKey() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></svg>
}

function IconCheckTiny() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-green-600"><path d="m20 6-11 11-5-5" /></svg>
}

function IconAlertTiny() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-600"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
}

function UserStatCard({ title, value, tone, icon }: { title: string; value: number; tone: 'blue' | 'green' | 'violet'; icon: ReactNode }) {
  const toneClass = {
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
  }[tone]
  return <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-3xl font-black text-[#142536]">{value}</p></div>
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

function IconShield() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" /><path d="m9 12 2 2 4-5" /></svg>
}

function IconClock() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
}

function IconInfo() {
  return <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
}

function IconCalendar() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>
}

function IconSearch() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}

function IconTimer() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2h4" /><path d="M12 14l3-3" /><circle cx="12" cy="14" r="8" /></svg>
}

function TariffDateCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">{icon}</span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-black text-[#142536]">{value}</p>
    </div>
  )
}

function ScheduleStatCard({ title, value, tone, icon }: { title: string; value: string; tone: 'blue' | 'green' | 'violet' | 'slate'; icon: ReactNode }) {
  const toneClass = {
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-500',
  }[tone]
  return (
    <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-black text-[#142536]">{value}</p>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF2F6] py-3 text-sm last:border-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <strong className="text-right font-black text-[#142536]">{value}</strong>
    </div>
  )
}

// ---- Tarife Tab ----
function TarifeTab({
  tariffProfiles,
  tariffs,
  onChanged,
  branches,
  history,
}: {
  tariffProfiles: TariffProfile[]
  tariffs: Tariff[]
  onChanged: () => void
  branches: Branch[]
  history: TariffPriceHistory[]
}) {
  const [activeProfileId, setActiveProfileId] = useState<number | null>(
    tariffProfiles.find((p) => p.is_default)?.id ?? tariffProfiles[0]?.id ?? null
  )
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'passive'>('all')
  const [editingPrice, setEditingPrice] = useState<{ id: number; val: string } | null>(null)
  const [editingDuration, setEditingDuration] = useState<{ id: number; val: string } | null>(null)
  const [showCopy, setShowCopy] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [showRename, setShowRename] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [showAddItem, setShowAddItem] = useState<string | null>(null) // category name
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [showBulk, setShowBulk] = useState(false)
  const [historyItem, setHistoryItem] = useState<Tariff | null>(null)
  const [transition, startTransition] = useTransition()
  const confirm = useConfirm()

  const [importState, importAction, importPending] = useActionState(importTdb2024, null as R)
  const [tufanState, tufanAction, tufanPending] = useActionState(importTufanbeyli, null as R)
  const [syncState, syncAction, syncPending] = useActionState(syncTdbProfile, null as R)
  const [copyState, copyAction, copyPending] = useActionState(copyTariffProfile, null as R)
  const [delProfileState, delProfileAction, delProfilePending] = useActionState(deleteTariffProfile, null as R)
  const [renameState, renameAction, renamePending] = useActionState(renameTariffProfile, null as R)
  const [defaultState, defaultAction, defaultPending] = useActionState(setDefaultProfile, null as R)
  const [addItemState, addItemAction, addItemPending] = useActionState(addTariffItemToProfile, null as R)

  useEffect(() => {
    if ((importState as R)?.success) onChanged()
  }, [importState, onChanged])
  useEffect(() => {
    if ((tufanState as R)?.success) onChanged()
  }, [tufanState, onChanged])
  useEffect(() => {
    if ((syncState as R)?.success) onChanged()
  }, [syncState, onChanged])
  useEffect(() => {
    if ((copyState as R)?.success) {
      queueMicrotask(() => {
        setShowCopy(false)
        setCopyName('')
        onChanged()
      })
    }
  }, [copyState, onChanged])
  useEffect(() => {
    if ((delProfileState as R)?.success) {
      queueMicrotask(() => {
        setActiveProfileId(tariffProfiles[0]?.id ?? null)
        onChanged()
      })
    }
  }, [delProfileState, tariffProfiles, onChanged])
  useEffect(() => {
    if ((renameState as R)?.success) {
      queueMicrotask(() => {
        setShowRename(false)
        onChanged()
      })
    }
  }, [renameState, onChanged])
  useEffect(() => {
    if ((defaultState as R)?.success) onChanged()
  }, [defaultState, onChanged])
  useEffect(() => {
    if ((addItemState as R)?.success) {
      queueMicrotask(() => {
        setShowAddItem(null)
        onChanged()
      })
    }
  }, [addItemState, onChanged])

  const activeProfile = tariffProfiles.find((p) => p.id === activeProfileId) ?? null

  const profileItems = useMemo(
    () => tariffs.filter((t) => t.profile_id === activeProfileId),
    [tariffs, activeProfileId],
  )

  const filtered = useMemo(() => {
    let items = profileItems
    if (filterStatus === 'active') items = items.filter((t) => t.is_active)
    if (filterStatus === 'passive') items = items.filter((t) => !t.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (t) =>
          t.treatment_name.toLowerCase().includes(q) ||
          (t.treatment_code?.toLowerCase().includes(q) ?? false),
      )
    }
    return items
  }, [profileItems, filterStatus, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Tariff[]>()
    for (const t of filtered) {
      const cat = t.category ?? 'Diğer'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return map
  }, [filtered])

  const handleToggle = (itemId: number) => {
    startTransition(async () => {
      const res = await toggleTariffItemActive(itemId)
      if (res?.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handlePriceSave = (item: Tariff) => {
    if (!editingPrice) return
    const raw = editingPrice.val.replace(',', '.').replace(/[^0-9.]/g, '')
    const priceKurus = Math.round(parseFloat(raw || '0') * 100)
    if (priceKurus < 0) return
    startTransition(async () => {
      const res = await updateTariffItemPrice(item.id, priceKurus)
      if (res?.error) toast.error(res.error)
      else { setEditingPrice(null); onChanged() }
    })
  }

  const handleDurationSave = (item: Tariff) => {
    if (!editingDuration) return
    const mins = parseInt(editingDuration.val, 10)
    const val = isNaN(mins) || mins <= 0 ? null : mins
    startTransition(async () => {
      const res = await updateTariffItemDuration(item.id, val)
      if (res?.error) toast.error(res.error)
      else { setEditingDuration(null); onChanged() }
    })
  }

  const handleColorSave = (item: Tariff, color: string) => {
    startTransition(async () => {
      const res = await updateTariffItemColor(item.id, color)
      if (res?.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handleDeleteItem = async (item: Tariff) => {
    const ok = await confirm({ title: 'Kalemi Sil', message: `"${item.treatment_name}" tarifeden kaldırılacak. Emin misiniz?`, confirmText: 'Evet, Sil' })
    if (!ok) return
    const fd = new FormData()
    fd.set('id', String(item.id))
    startTransition(async () => {
      const res = await deleteTariffItem(null, fd)
      if (res?.error) toast.error(res.error)
      else { toast.success('Kalem silindi'); onChanged() }
    })
  }

  const activeCount = profileItems.filter((t) => t.is_active).length
  const latestUpdate = activeProfile?.last_synced_at
    ? new Date(activeProfile.last_synced_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Henüz yok'
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of profileItems) {
      const key = item.category ?? 'Diğer'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [profileItems])

  return (
    <div className="space-y-6">
      {/* Profil sekmeleri */}
      <div className="flex items-center gap-3 flex-wrap">
        {tariffProfiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProfileId(p.id)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
              p.id === activeProfileId
                ? 'border-[#142536] bg-[linear-gradient(135deg,#142536,#1EAEA0)] text-white shadow-[0_10px_24px_rgba(20,37,54,0.14)]'
                : 'border-[#E7ECF2] bg-white text-slate-500 hover:border-[#5FD3C1] hover:text-[#142536]'
            }`}
          >
            {p.source === 'tdb' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
            {p.name}
            {p.is_default && (
              <span className="text-[10px] bg-[#2DD4BF]/20 text-[#0F2B3D] px-1.5 py-0.5 rounded-md">Varsayılan</span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowAddProfile(true)}
          className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-400 transition hover:border-[#5FD3C1] hover:text-[#0F766E]"
        >
          <IconPlus />
          Tarife Ekle
        </button>
      </div>

      {activeProfile && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <UserStatCard title="Toplam Tedavi" value={profileItems.length} tone="blue" icon={<IconClipboard />} />
          <UserStatCard title="Aktif Tedavi" value={activeCount} tone="green" icon={<IconCheckCircle />} />
          <TariffDateCard title="Son Güncelleme" value={latestUpdate} icon={<IconCalendar />} />
        </div>
      )}

      {/* Profil yoksa boş durum */}
      {tariffProfiles.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center space-y-4">
          <p className="text-sm text-gray-400">Henüz tarife profili yok.</p>
          <div className="flex justify-center gap-3">
            <form action={importAction}>
              <button type="submit" disabled={importPending} className="px-4 py-2 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                {importPending ? 'Aktarılıyor…' : 'TDB 2024 Tarifesini İçe Aktar'}
              </button>
            </form>
            <form action={tufanAction}>
              <button type="submit" disabled={tufanPending} className="px-4 py-2 border border-gray-200 text-[#0F2B3D] text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60">
                {tufanPending ? 'Aktarılıyor…' : 'Tufanbeyli Tarifesini İçe Aktar'}
              </button>
            </form>
          </div>
          {(importState as R)?.error && <p className="text-sm text-red-600">{(importState as R)!.error}</p>}
          {(tufanState as R)?.error && <p className="text-sm text-red-600">{(tufanState as R)!.error}</p>}
        </div>
      )}

      {/* Aktif profil içeriği */}
      {activeProfile && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
          {/* Profil başlığı + aksiyonlar */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-[#142536]">{activeProfile.name}</span>
                  {activeProfile.source === 'tdb' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">TDB {activeProfile.tdb_year}</span>
                  )}
                  {activeProfile.source === 'custom' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Özel Tarife</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {profileItems.length} tedavi · {activeCount} aktif
                  {activeProfile.last_synced_at && (
                    <> · Son güncelleme: {new Date(activeProfile.last_synced_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* TDB ise yenile butonu */}
              {activeProfile.source === 'tdb' && (
                <form action={syncAction}>
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <button type="submit" disabled={syncPending}
                    onClick={(e) => { if (!window.confirm('TDB tarifesi yenilenecek. Mevcut fiyatlar ve aktif/pasif durumları sıfırlanacak. Devam edilsin mi?')) e.preventDefault() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    {syncPending ? 'Yenileniyor…' : 'TDB\'yi Yenile'}
                  </button>
                </form>
              )}
              {/* Kopyala */}
              <button onClick={() => { setCopyName(`${activeProfile.name} Kopyası`); setShowCopy(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Kopyala
              </button>
              {/* Yeniden adlandır */}
              <button onClick={() => { setRenameName(activeProfile.name); setShowRename(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Yeniden Adlandır
              </button>
              {/* Varsayılan yap */}
              {!activeProfile.is_default && (
                <form action={defaultAction}>
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <button type="submit" disabled={defaultPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60">
                    Varsayılan Yap
                  </button>
                </form>
              )}
              {/* Sil */}
              <form action={delProfileAction}>
                <input type="hidden" name="profile_id" value={activeProfile.id} />
                <button type="submit" disabled={delProfilePending}
                  onClick={(e) => { if (!window.confirm(`"${activeProfile.name}" tarifesi tüm kalemleriyle silinecek. Emin misiniz?`)) e.preventDefault() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Sil
                </button>
              </form>
            </div>
          </div>

          {/* Filtre ve arama */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch /></span>
              <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tedavi adı veya kod ara…"
              className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white pl-10 pr-4 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="h-12 rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-bold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
            >
              <option value="all">Tümü ({profileItems.length})</option>
              <option value="active">Aktif ({activeCount})</option>
              <option value="passive">Pasif ({profileItems.length - activeCount})</option>
            </select>
            <div className="flex h-12 items-center rounded-2xl border border-[#E7ECF2] bg-white p-1">
              <button onClick={() => setViewMode('list')} className={`h-9 rounded-xl px-3 text-xs font-black ${viewMode === 'list' ? 'bg-[#142536] text-white' : 'text-slate-400'}`}>Liste</button>
              <button onClick={() => setViewMode('cards')} className={`h-9 rounded-xl px-3 text-xs font-black ${viewMode === 'cards' ? 'bg-[#142536] text-white' : 'text-slate-400'}`}>Kartlar</button>
            </div>
            <button onClick={() => setShowBulk(true)} className="h-12 rounded-2xl bg-[#1EAEA0] px-5 text-sm font-black text-white shadow-sm hover:bg-[#178F84]">Toplu Fiyat Değiştir</button>
          </div>

          {viewMode === 'cards' && <TariffCards items={filtered} branches={branches} onHistory={setHistoryItem} />}

          {/* Tarife grupları */}
          {grouped.size === 0 && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-8 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]"><IconClipboard /></span>
                <h3 className="text-sm font-black text-[#142536]">{search ? 'Arama sonucu yok.' : 'Bu tarifede henüz tedavi yok.'}</h3>
                <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-slate-400">Tedavi ekleyerek bu tarife için ücret listesini oluşturmaya başlayabilirsiniz.</p>
              </div>
            </div>
          )}

          {viewMode === 'list' && [...grouped.entries()].map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[#0F2B3D] uppercase tracking-wide">{category}</h3>
                  <span className="text-xs text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <button
                  onClick={() => setShowAddItem(showAddItem === category ? null : category)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#2DD4BF] border border-[#2DD4BF]/40 rounded-lg hover:bg-[#2DD4BF]/10 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ekle
                </button>
              </div>

              {/* İnline ekleme formu */}
              {showAddItem === category && (
                <form action={addItemAction} className="flex items-end gap-2 px-5 py-3 bg-[#2DD4BF]/5 border-b border-[#2DD4BF]/20">
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <input type="hidden" name="category" value={category} />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Tedavi Adı *</label>
                    <input name="treatment_name" required placeholder="Örn: Dolgu" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Kod</label>
                    <input name="treatment_code" placeholder="08-999" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Fiyat (KDV dahil)</label>
                    <input name="price" required placeholder="500" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-16">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Renk</label>
                    <input name="color" type="color" defaultValue="#B5EAD7" className="h-8 w-full rounded-lg border border-gray-200 cursor-pointer" />
                  </div>
                  <div className="w-36">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Tedavi Şeması</label>
                    <select name="visual_schema" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs">{VISUAL_SCHEMAS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
                  </div>
                  <div className="w-28"><label className="block text-[10px] font-medium text-gray-400 mb-1">Uygulama Bölgesi</label><input name="application_region" placeholder="Tek diş" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" /></div>
                  <div className="w-20"><label className="block text-[10px] font-medium text-gray-400 mb-1">KDV (%)</label><input name="vat_rate" type="number" min="0" max="100" defaultValue="0" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" /></div>
                  <input type="hidden" name="vat_included" value="true" />
                  <div className="w-28"><label className="block text-[10px] font-medium text-gray-400 mb-1">Şube</label><select name="branch_id" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="">Tüm klinik</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                  <div className="w-20">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Para Birimi</label>
                    <select name="currency" className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none">
                      <option>TRY</option>
                      <option>EUR</option>
                      <option>USD</option>
                    </select>
                  </div>
                  <button type="submit" disabled={addItemPending}
                    className="px-3 py-1.5 bg-[#2DD4BF] text-[#0F2B3D] text-xs font-semibold rounded-lg hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                    {addItemPending ? '…' : 'Ekle'}
                  </button>
                  <button type="button" onClick={() => setShowAddItem(null)}
                    className="px-2.5 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors">
                    İptal
                  </button>
                  {(addItemState as R)?.error && (
                    <span className="text-xs text-red-500">{(addItemState as R)!.error}</span>
                  )}
                </form>
              )}

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="text-left px-4 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Tedavi</th>
                    <th className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Renk</th>
                    <th className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide hidden md:table-cell">Kod</th>
                    <th className="text-right px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide hidden lg:table-cell">Süre</th>
                    <th className="text-right px-4 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Ücret (KDV dahil)</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className={`border-b border-gray-50 last:border-0 transition-colors ${t.is_active ? '' : 'opacity-50'}`}>
                      {/* Aktif/pasif toggle */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggle(t.id)}
                          disabled={transition}
                          title={t.is_active ? 'Pasif yap' : 'Aktif yap'}
                          className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${t.is_active ? 'bg-[#2DD4BF]' : 'bg-gray-200'} disabled:cursor-not-allowed`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${t.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[#0F2B3D] text-sm"><div className="flex items-center gap-3"><TreatmentVisual schema={inferTariffVisual(t)} className="h-11 w-14 flex-none rounded-xl"/><div><p className="font-bold">{t.treatment_name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">{t.application_region || 'Bölge belirtilmedi'} · KDV %{t.vat_rate} {t.vat_included ? 'dahil' : 'hariç'}</p></div></div></td>
                      <td className="px-3 py-3">
                        <input
                          type="color"
                          value={t.color ?? '#B5EAD7'}
                          onChange={(e) => handleColorSave(t, e.target.value)}
                          disabled={transition}
                          className="h-7 w-10 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50"
                          title="Renk kodu"
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 hidden md:table-cell font-mono">{t.treatment_code ?? '—'}</td>
                      {/* Süre — tıklanınca input */}
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        {editingDuration?.id === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              autoFocus
                              type="number"
                              min={1}
                              step={5}
                              value={editingDuration.val}
                              onChange={(e) => setEditingDuration({ id: t.id, val: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleDurationSave(t)
                                if (e.key === 'Escape') setEditingDuration(null)
                              }}
                              onBlur={() => handleDurationSave(t)}
                              className="w-16 px-2 py-1 text-sm text-right border border-[#2DD4BF] rounded-lg focus:outline-none"
                            />
                            <span className="text-xs text-gray-400">dk</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDuration({ id: t.id, val: String(t.duration_minutes ?? '') })}
                            className="text-xs text-gray-400 hover:text-[#2DD4BF] transition-colors cursor-pointer group"
                            title="Süre düzenle"
                          >
                            {t.duration_minutes ? `${t.duration_minutes} dk` : '—'}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-[#2DD4BF]">✎</span>
                          </button>
                        )}
                      </td>
                      {/* Fiyat — tıklanınca input */}
                      <td className="px-4 py-3 text-right">
                        {editingPrice?.id === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-gray-400">{t.currency}</span>
                            <input
                              autoFocus
                              value={editingPrice.val}
                              onChange={(e) => setEditingPrice({ id: t.id, val: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePriceSave(t)
                                if (e.key === 'Escape') setEditingPrice(null)
                              }}
                              onBlur={() => handlePriceSave(t)}
                              className="w-24 px-2 py-1 text-sm text-right border border-[#2DD4BF] rounded-lg focus:outline-none"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingPrice({ id: t.id, val: String(t.price / 100) })}
                            className="font-semibold text-[#0F2B3D] hover:text-[#2DD4BF] transition-colors cursor-pointer group"
                            title="Fiyatı düzenle"
                          >
                            {fmtPrice(t.price, t.currency)}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-[#2DD4BF]">✎</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setHistoryItem(t)} className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#138B7E]" title="Fiyat geçmişi">↻</button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(t)}
                          disabled={transition}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Sil"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
            </div>
            <aside className="space-y-6">
              <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-start gap-3">
                  <SettingsIconBox><IconClipboard /></SettingsIconBox>
                  <div>
                    <h3 className="text-base font-black text-[#142536]">Tarife Özeti</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Seçili tarifenin kısa durumu</p>
                  </div>
                </div>
                <SummaryLine label="Tarife türü" value={activeProfile.source === 'tdb' ? `TDB ${activeProfile.tdb_year ?? ''}` : 'Özel Tarife'} />
                <SummaryLine label="Varsayılan" value={activeProfile.is_default ? 'Evet' : 'Hayır'} />
                <SummaryLine label="Tedavi sayısı" value={String(profileItems.length)} />
                <SummaryLine label="Aktif tedavi" value={String(activeCount)} />
                <SummaryLine label="Son güncelleme" value={latestUpdate} />
              </section>

              <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <h3 className="text-base font-black text-[#142536]">Kategori Dağılımı</h3>
                <div className="mt-4 space-y-3">
                  {categoryStats.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-[#FAFBFC] px-4 py-6 text-center text-xs font-semibold text-slate-400">Henüz kategori verisi yok.</p>
                  ) : categoryStats.slice(0, 6).map(([name, count]) => (
                    <div key={name}>
                      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500"><span>{name}</span><span>{count}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E7ECF2]"><div className="h-full rounded-full bg-[#5FD3C1]" style={{ width: `${Math.max(8, Math.round((count / Math.max(profileItems.length, 1)) * 100))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#E7ECF2] bg-[#F8FAFC] p-5">
                <div className="flex items-start gap-3 text-slate-600">
                  <IconInfo />
                  <div className="space-y-2 text-xs font-semibold leading-5">
                    <p>TDB tarifesini kopyalayarak özel tarife oluşturabilirsiniz.</p>
                    <p>Varsayılan tarife randevu ve tedavi ekleme ekranlarında kullanılır.</p>
                    <p>Pasif tedaviler işlem listesinde görünmez.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      {/* Yeni tarife ekleme modal (TDB + Tufanbeyli import veya boş) */}
      {showAddProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddProfile(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Tarife Ekle</h2>
            {(importState as R)?.error && <p className="text-sm text-red-600">{(importState as R)!.error}</p>}
            {(tufanState as R)?.error && <p className="text-sm text-red-600">{(tufanState as R)!.error}</p>}
            <div className="space-y-2">
              <form action={importAction}>
                <button type="submit" disabled={importPending}
                  className="w-full px-4 py-3 flex items-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 text-left">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">TDB</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2B3D]">TDB 2024 Tarifesi</p>
                    <p className="text-xs text-gray-400">8 kategori, ~160 işlem — Asgari ücret tarifesi</p>
                  </div>
                </button>
              </form>
              <form action={tufanAction}>
                <button type="submit" disabled={tufanPending}
                  className="w-full px-4 py-3 flex items-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 text-left">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-emerald-600">TFN</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2B3D]">Tufanbeyli Tarifesi</p>
                    <p className="text-xs text-gray-400">49 işlem — Klinik özel tarife</p>
                  </div>
                </button>
              </form>
            </div>
            <button type="button" onClick={() => setShowAddProfile(false)}
              className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Kopyala modal */}
      {showCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCopy(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Tarifeyi Kopyala</h2>
            <p className="text-sm text-gray-500">Tüm tedaviler yeni bir tarife olarak kopyalanır.</p>
            <form action={copyAction} className="space-y-3">
              <input type="hidden" name="source_id" value={activeProfile?.id} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Yeni Tarife Adı</label>
                <input
                  name="new_name"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                />
              </div>
              {(copyState as R)?.error && <p className="text-sm text-red-600">{(copyState as R)!.error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCopy(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={copyPending}
                  className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                  {copyPending ? 'Kopyalanıyor…' : 'Kopyala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yeniden adlandır modal */}
      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRename(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Yeniden Adlandır</h2>
            <form action={renameAction} className="space-y-3">
              <input type="hidden" name="profile_id" value={activeProfile?.id} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarife Adı</label>
                <input
                  name="name"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                />
              </div>
              {(renameState as R)?.error && <p className="text-sm text-red-600">{(renameState as R)!.error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRename(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={renamePending}
                  className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                  {renamePending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBulk && activeProfile && <BulkPriceModal profileId={activeProfile.id} items={profileItems} branches={branches} onClose={() => setShowBulk(false)} onChanged={onChanged} />}
      {historyItem && <PriceHistoryModal item={historyItem} history={history} onClose={() => setHistoryItem(null)} />}
    </div>
  )
}

// ---- Randevu Tab ----
function RandevuTab({ clinic, doctors, branches, appointmentTypes, onSaved }: { clinic: ClinicSettings; doctors: Doctor[]; branches: Branch[]; appointmentTypes: AppointmentType[]; onSaved: () => void }) {
  const [state, action, pending] = useActionState(updateRandevuSettings, null as R)

  useEffect(() => {
    if ((state as R)?.success) onSaved()
  }, [state, onSaved])

  const workStart = clinic.work_start ?? '09:00'
  const workEnd = clinic.work_end ?? '18:00'
  const duration = clinic.default_duration ?? 30
  const onlineBooking = clinic.online_booking ?? true
  const requireApproval = clinic.require_approval ?? true
  const totalMinutes = Math.max(0, toMinutes(workEnd) - toMinutes(workStart))
  const dailyHours = Math.round((totalMinutes / 60) * 10) / 10
  const slotCount = duration > 0 ? Math.floor(totalMinutes / duration) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScheduleStatCard title="Mesai Saatleri" value={workStart + ' - ' + workEnd} tone="blue" icon={<IconClock />} />
        <ScheduleStatCard title="Randevu Aralığı" value={duration + ' dk'} tone="violet" icon={<IconTimer />} />
        <ScheduleStatCard title="Online Randevu" value={onlineBooking ? 'Açık' : 'Kapalı'} tone={onlineBooking ? 'green' : 'slate'} icon={<IconCalendar />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-start gap-3">
            <SettingsIconBox><IconCalendar /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Randevu Ayarları</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Klinik çalışma saatleri, randevu aralıkları ve online randevu kurallarını yönetin.</p>
            </div>
          </div>

          <form action={action} className="space-y-7">
            {(state as R)?.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{(state as R)!.error}</div>}
            {(state as R)?.success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-600">Ayarlar kaydedildi.</div>}

            <ClinicFormSection title="Çalışma Saatleri" icon={<IconClock />}>
              <p className="-mt-2 text-xs font-semibold text-slate-400">Randevu takviminde gösterilecek varsayılan mesai aralığı.</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <ModernField label="Mesai Başlangıç" name="work_start" type="time" defaultValue={workStart} />
                <ModernField label="Mesai Bitiş" name="work_end" type="time" defaultValue={workEnd} />
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Randevu Süresi" icon={<IconTimer />}>
              <p className="-mt-2 text-xs font-semibold text-slate-400">Takvim slotlarının kaç dakikalık aralıklarla oluşturulacağını belirler.</p>
              <div>
                <label className="mb-2 block text-[13px] font-bold text-slate-500">Randevu Aralığı</label>
                <select name="default_duration" defaultValue={String(duration)} className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15">
                  {[15, 20, 30, 45, 60].map((v) => <option key={v} value={v}>{v} dk</option>)}
                </select>
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Online Randevu Kuralları" icon={<IconCalendar />}>
              <div className="space-y-3">
                <SwitchField name="online_booking" defaultChecked={onlineBooking} title="Online hasta randevusu açık" description="Hastalar online randevu talebi oluşturabilir." />
                <SwitchField name="require_approval" defaultChecked={requireApproval} title="Randevular onay gerektirsin" description="Online talepler takvime eklenmeden önce onay bekler." />
              </div>
            </ClinicFormSection>

            <div className="flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold text-slate-500">
              <IconInfo />
              <span>Bu ayarlar randevu takvimi, online randevu talepleri ve boş slot hesaplamalarında kullanılır.</span>
            </div>

            <div className="flex border-t border-[#EEF2F6] pt-5">
              <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-6 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-60 sm:w-auto">
                <IconSave />
                {pending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start gap-3">
              <SettingsIconBox><IconCalendar /></SettingsIconBox>
              <div>
                <h3 className="text-base font-black text-[#142536]">Çalışma Takvimi Özeti</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">Günlük randevu kapasitesi</p>
              </div>
            </div>
            <SummaryLine label="Günlük mesai" value={workStart + ' - ' + workEnd} />
            <SummaryLine label="Günlük süre" value={dailyHours + ' saat'} />
            <SummaryLine label="Slot aralığı" value={duration + ' dk'} />
            <SummaryLine label="Tahmini günlük slot" value={String(slotCount)} />
          </section>

          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-black text-[#142536]">Online Randevu</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={onlineBooking ? 'rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500'}>{onlineBooking ? 'Açık' : 'Kapalı'}</span>
              <span className={requireApproval ? 'rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600' : 'rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700'}>{requireApproval ? 'Onay gerekli' : 'Otomatik onay'}</span>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold leading-5 text-slate-500"><IconInfo /><span>Online talepler onay bekleyen randevular alanında görüntülenir.</span></div>
          </section>

          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-black text-[#142536]">Çalışma Günleri</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">Varsayılan çalışma günleri</p>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d, i) => <span key={d} className={(i < 5 ? 'bg-[#E6FFFA] text-[#0F766E]' : 'bg-[#F1F5F9] text-slate-400') + ' rounded-xl px-2 py-2 text-center text-xs font-black'}>{d}</span>)}
            </div>
          </section>
        </aside>
      </div>
      <AppointmentSettingsEnhancements clinic={clinic} doctors={doctors} branches={branches} appointmentTypes={appointmentTypes} onChanged={onSaved} />
    </div>
  )
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map((part) => Number(part))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function SwitchField({ name, defaultChecked, title, description }: { name: string; defaultChecked: boolean; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-3">
      <span>
        <span className="block text-sm font-black text-[#142536]">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-slate-400">{description}</span>
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-[#5FD3C1]" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
