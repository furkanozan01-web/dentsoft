'use client'

import { useState, useEffect, useActionState, type ReactNode } from 'react'
import { updateClinic, uploadClinicLogo } from './actions'
import { ClinicFormSection, ModernField, SettingsIconBox, IconSave, IconClipboard, IconAlert } from './SettingsSharedUI'
import BranchManager from './BranchManager'
import type { Branch, ClinicSettings, R } from './types'

export default function KlinikTab({ clinic, branches, activeBranchId, canManage, onSaved }: { clinic: ClinicSettings; branches: Branch[]; activeBranchId: number | null; canManage: boolean; onSaved: () => void }) {
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

function IconReceipt() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 12h8" /><path d="M8 17h5" /></svg>
}

function IconFileText() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
}

function IconMapPin() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
}
