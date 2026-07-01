'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  DISEASES,
  DRUG_DATABASE,
  LEVEL_STYLES,
  checkInteractions,
  type Anamnesis,
} from '@/lib/anamnesis'
import { getPatientTc, setUntrusted, updateAnamnesis } from './actions'
import DonutChart from './PatientCharts'
import PatientQuickActions from './PatientQuickActions'
import { cap, calcAge, fmt } from './formatters'
import type { Patient, TabId, Transaction, Treatment } from './types'

// ---- Hasta Kartı Tab ----
function HastaKartiTab({
  patient,
  patients,
  treatments,
  transactions,
  loadingFinance,
  loadFinanceError,
  onRetryFinance,
  anamnesis,
  loadingAnamnesis,
  onAnamnesisSaved,
  onPay,
  onEdit,
  onGoToTab,
  onGoToAppointments,
  onSelectPatient,
}: {
  patient: Patient
  patients: Patient[]
  treatments: Treatment[]
  transactions: Transaction[]
  loadingFinance: boolean
  loadFinanceError: boolean
  onRetryFinance: () => void
  anamnesis: Anamnesis
  loadingAnamnesis: boolean
  onAnamnesisSaved: (a: Anamnesis) => void
  onPay: () => void
  onEdit: () => void
  onGoToTab: (tab: TabId) => void
  onGoToAppointments: () => void
  onSelectPatient: (p: Patient) => void
}) {
  const genderLabel =
    { male: 'Erkek', female: 'Kadın', other: 'Diğer' }[patient.gender ?? ''] ?? '—'

  const totalOwed = treatments.reduce((s, t) => s + (t.fee ?? 0), 0)
  const totalPaid = transactions
    .filter((t) => t.type === 'payment')
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  const balance = totalOwed - totalPaid
  const ratio = totalOwed > 0 ? Math.min(totalPaid / totalOwed, 1) : 1
  const regDate = patient.reg_date
    ? new Date(patient.reg_date).toLocaleDateString('tr-TR')
    : new Date(patient.created_at).toLocaleDateString('tr-TR')
  const age = calcAge(patient.birth_date)
  const patientInitials = `${patient.name.charAt(0)}${patient.surname.charAt(0)}`.toLocaleUpperCase('tr-TR')

  const [tcState, setTcState] = useState<{ patientId: number; value: string | null } | null>(null)
  const tcLoading = tcState?.patientId !== patient.id
  const tcValue = tcState?.patientId === patient.id ? tcState.value : null

  // Hasta arama
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Modal durumları
  const [showKvkk, setShowKvkk] = useState(false)
  const [showOnam, setShowOnam] = useState(false)

  useEffect(() => {
    let active = true
    getPatientTc(patient.id).then((res) => {
      if (!active) return
      setTcState({ patientId: patient.id, value: res.tc ?? null })
    })
    return () => { active = false }
  }, [patient.id])

  // Click-outside arama dropdown'ını kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchResults =
    searchQuery.length >= 2
      ? patients
          .filter((p) => {
            const q = searchQuery.toLowerCase()
            return (
              `${p.name} ${p.surname}`.toLowerCase().includes(q) ||
              (p.phone1 ?? '').includes(q) ||
              (p.protocol_no ?? '').toLowerCase().includes(q)
            )
          })
          .filter((p) => p.id !== patient.id)
          .slice(0, 6)
      : []

  const printCard = () => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) { toast.error('Yazdırma penceresi açılamadı. Pop-up engelini kontrol edin.'); return }
    win.document.write(buildPrintHtml({
      patient, tcValue: tcValue ?? '—',
      anamnesis, balance, totalOwed, totalPaid, regDate, age, genderLabel,
    }))
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="space-y-5">
      {/* ── Hasta Arama ── */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#2DD4BF]">
          <span className="shrink-0 text-slate-400"><IconSearch /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true) }}
            onFocus={() => { if (searchQuery.length >= 2) setShowSearchResults(true) }}
            placeholder="Farklı hasta ara — isim, telefon veya protokol no..."
            className="flex-1 bg-transparent text-sm font-medium text-[#0F2B3D] outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSearchResults(false) }}
              className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Temizle"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectPatient(p)
                  setSearchQuery('')
                  setShowSearchResults(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-xs font-black text-[#0F766E]">
                  {p.name.charAt(0)}{p.surname.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0F2B3D] truncate">{cap(p.name)} {cap(p.surname)}</p>
                  <p className="text-xs text-slate-400">{p.phone1 ?? '—'}{p.protocol_no ? ` · ${p.protocol_no}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {p.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
              </button>
            ))}
          </div>
        )}

        {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-xl text-center text-sm text-slate-400">
            Eşleşen hasta bulunamadı
          </div>
        )}
      </div>

      {/* ── Ana grid ── */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        {/* Kişisel bilgiler */}
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex flex-col gap-4 border-b border-[#EEF2F6] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-xl font-black text-[#0F766E]">
                {patientInitials}
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F2B3D]">
                  {cap(patient.name)} {cap(patient.surname)}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {patient.status === 'active' ? 'Aktif hasta' : 'Pasif hasta'} · Kayıt: {regDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={printCard}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                title="Hasta kartını yazdır"
              >
                <IconPrint />
                Yazdır
              </button>
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-[#142536] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(15,35,54,0.14)] transition hover:-translate-y-0.5 hover:bg-[#1a3d52]"
              >
                <IconPencil />
                Düzenle
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DDF8F4] text-[#0F766E]">
              <IconUser />
            </span>
            <h3 className="text-sm font-black text-[#0F2B3D]">Kişisel & İletişim Bilgileri</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            <InfoRow label="Ad" value={cap(patient.name)} />
            <InfoRow label="Soyad" value={cap(patient.surname)} />
            <InfoRow label="Cinsiyet" value={genderLabel} />
            <InfoRow
              label="Doğum Tarihi"
              value={patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('tr-TR') : '—'}
            />
            <InfoRow label="Yaş" value={age !== null ? String(age) : '—'} />
            <InfoRow label="T.C. Kimlik No" value={tcLoading ? 'Yükleniyor...' : tcValue ?? 'Kayıt yok'} />
            <InfoRow label="Telefon 1" value={patient.phone1 ?? '—'} />
            <InfoRow label="Telefon 2" value={patient.phone2 ?? '—'} />
            <InfoRow label="E-posta" value={patient.email ?? '—'} />
            <InfoRow label="Protokol No" value={patient.protocol_no ?? '—'} />
            <div className="md:col-span-2 2xl:col-span-3">
              <InfoRow label="Adres" value={patient.address ?? '—'} />
            </div>
          </div>
        </div>

        {/* Yan panel */}
        <div className="space-y-4">
          {/* Hasta Bakiyesi */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#0F2B3D]">Hasta Bakiyesi</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-400">Finansal özet</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#0F766E]">
                <IconLira />
              </span>
            </div>
            {loadFinanceError ? (
              <div className="py-2">
                <p className="mb-2 text-sm font-semibold text-red-400">Yüklenemedi</p>
                <button
                  onClick={onRetryFinance}
                  className="rounded-lg bg-[#0F2B3D] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#1a3d52]"
                >
                  Yenile
                </button>
              </div>
            ) : loadingFinance ? (
              <p className="py-3 text-sm font-medium text-gray-400">Yükleniyor…</p>
            ) : (
              <div className="flex items-center gap-4">
                <DonutChart ratio={ratio} />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-slate-400">Kalan Borç</p>
                  <p className={`text-2xl font-black ${balance > 0 ? 'text-[#DC2626]' : 'text-green-600'}`}>
                    ₺{fmt(Math.max(balance, 0))}
                  </p>
                  <p className="text-[12px] font-semibold text-slate-400">Ödenen: ₺{fmt(totalPaid)}</p>
                  <p className="text-[12px] font-semibold text-slate-400">Toplam: ₺{fmt(totalOwed)}</p>
                </div>
              </div>
            )}
            {!loadFinanceError && !loadingFinance && (
              <button
                onClick={onPay}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E7ECF2] bg-white px-3 py-2 text-xs font-bold text-[#0F766E] transition hover:bg-[#E9FBF8]"
              >
                <IconCreditCard />
                Ödeme Al
              </button>
            )}
          </div>

          {/* Durum */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h3 className="mb-4 text-sm font-black text-[#0F2B3D]">Durum</h3>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${patient.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${patient.status === 'active' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                {patient.status === 'active' ? 'Aktif Hasta' : 'Pasif Hasta'}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-400">Kayıt: {regDate}</p>
            <UntrustedToggle patientId={patient.id} initial={patient.untrusted ?? false} />
          </div>

          <PatientQuickActions
            phone={patient.phone1}
            onPay={onPay}
            onAppointment={onGoToAppointments}
            onPrescription={() => onGoToTab('recete')}
            onKvkk={() => setShowKvkk(true)}
            onDigitalConsent={() => setShowOnam(true)}
          />
        </div>
      </div>

      {/* Anamnez (tam genişlik) */}
      <AnamnezBox
        patientId={patient.id}
        anamnesis={anamnesis}
        loading={loadingAnamnesis}
        onSaved={onAnamnesisSaved}
      />

      {/* Modaller */}
      {showKvkk && (
        <KvkkModal
          patient={patient}
          onClose={() => setShowKvkk(false)}
        />
      )}
      {showOnam && (
        <OnamModal
          patient={patient}
          onClose={() => setShowOnam(false)}
        />
      )}
    </div>
  )
}

// ---- Bileşenler ----
function InfoRow({ label, value }: { label: string; value: string }) {
  const missing = value === '—'
  return (
    <div className="rounded-[14px] border border-[#EEF2F6] bg-[#FAFBFC] px-3.5 py-3">
      <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${missing ? 'text-slate-400' : 'text-[#0F2B3D]'}`}>{value}</p>
    </div>
  )
}

// ---- KVKK Modal ----
function KvkkModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const fullName = `${cap(patient.name)} ${cap(patient.surname)}`
  const today = new Date().toLocaleDateString('tr-TR')

  const handleSmsSend = () => {
    if (!patient.phone1) { toast.error('Hastanın telefon kaydı bulunmuyor'); return }
    toast.success('KVKK onam SMS\'i hastaya iletildi (şablon)')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconShield />
            </span>
            <h2 className="text-base font-bold text-[#0F2B3D]">KVKK Kişisel Veri Onamı</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
{`KİŞİSEL VERİLERİN KORUNMASI KANUNU KAPSAMINDA
HASTA RIZA VE BİLGİLENDİRME METNİ

Sayın ${fullName},
Tarih: ${today}

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca aşağıdaki bilgiler tarafınıza sunulmaktadır.

■ İŞLENEN KİŞİSEL VERİLER
• Kimlik bilgileri (ad, soyad, T.C. kimlik numarası, doğum tarihi)
• İletişim bilgileri (telefon, e-posta, adres)
• Sağlık bilgileri (hastalık geçmişi, uygulanan tedaviler, ilaç kullanımı)
• Finansal bilgiler (tedavi ücretleri, ödeme bilgileri)

■ İŞLEME AMACI
• Sağlık hizmetinin sunulması ve takibi
• Yasal yükümlülüklerin yerine getirilmesi
• Fatura ve muhasebe işlemleri
• İletişim ve randevu hatırlatmaları

■ VERİLERİN SAKLANMASI
Kişisel verileriniz, ilgili mevzuat çerçevesinde güvenli ortamlarda saklanmakta; yetkisiz erişime karşı teknik ve idari tedbirler alınmaktadır.

■ HAKLARINIZ (KVKK Md. 11)
• Verilerinizin işlenip işlenmediğini öğrenme
• Yanlış verilerin düzeltilmesini talep etme
• Verilerin silinmesini veya yok edilmesini isteme
• Veri işlemeye itiraz etme

Yukarıdaki bilgileri okudum, anladım ve kişisel verilerimin belirtilen amaçlarla işlenmesine rıza veriyorum.`}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            Kapat
          </button>
          <button
            onClick={handleSmsSend}
            className="flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-5 py-2 text-sm font-bold text-white hover:bg-[#26b8a5] transition-colors"
          >
            <IconSms />
            SMS ile Gönder
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Dijital Onam Modal ----
function OnamModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const fullName = `${cap(patient.name)} ${cap(patient.surname)}`
  const today = new Date().toLocaleDateString('tr-TR')

  const handleSmsSend = () => {
    if (!patient.phone1) { toast.error('Hastanın telefon kaydı bulunmuyor'); return }
    toast.success('Tedavi onam formu SMS\'i hastaya iletildi (şablon)')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconClipboardCheck />
            </span>
            <h2 className="text-base font-bold text-[#0F2B3D]">Dijital Tedavi Onam Formu</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
{`TEDAVİ ONAM FORMU (DİJİTAL ŞABLON)

Hasta Adı: ${fullName}
Tarih: ${today}

Sayın Hastamız,

Planlanan diş hekimliği tedavisi hakkında aşağıdaki bilgiler tarafınızla paylaşılmıştır.

■ BİLGİLENDİRME
• Tedavi planı ve uygulanacak prosedürler hekiminiz tarafından açıklanmıştır.
• Tedavinin olası risk ve komplikasyonları hakkında bilgi verilmiştir.
• Alternatif tedavi seçenekleri değerlendirilmiştir.
• Tedavi sonrası bakım ve öneriler aktarılmıştır.

■ HASTA HAKLARI
• Tedaviyi kabul veya reddetme hakkınız bulunmaktadır.
• Herhangi bir aşamada tedaviyi durdurabilirsiniz.
• Tedavi sürecinde her türlü soruyu sorma hakkınız saklıdır.
• İkinci tıbbi görüş alma hakkınız mevcuttur.

■ ONAY
Bu formu onaylayarak;
• Tedavi planını anladığımı,
• Riskler konusunda bilgilendirildiğimi,
• Tedaviye gönüllü olarak onay verdiğimi

beyan ederim.

_________________________________
İmza / Onay

Not: Bu form SMS veya dijital iletişim kanalıyla
hastaya iletilerek onaylanacaktır.`}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            Kapat
          </button>
          <button
            onClick={handleSmsSend}
            className="flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-5 py-2 text-sm font-bold text-white hover:bg-[#26b8a5] transition-colors"
          >
            <IconSms />
            SMS ile Gönder
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Güvenilmez hasta toggle ----
function UntrustedToggle({ patientId, initial }: { patientId: number; initial: boolean }) {
  const [checked, setChecked] = useState(initial)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !checked
    setChecked(next)
    startTransition(async () => {
      const res = await setUntrusted(patientId, next)
      if (res.error) setChecked(!next)
    })
  }

  return (
    <label className={`mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition ${checked ? 'border-red-100 bg-red-50 text-red-500' : 'border-[#EEF2F6] bg-[#FAFBFC] text-slate-500'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        className="h-4 w-4 rounded accent-red-500"
      />
      {checked && <IconAlertTriangle />}
      <span className="text-xs font-bold">Güvenilmez hasta</span>
    </label>
  )
}

// ---- Print ----
function buildPrintHtml({ patient, tcValue, anamnesis, balance, totalOwed, totalPaid, regDate, age, genderLabel }: {
  patient: Patient
  tcValue: string
  anamnesis: Anamnesis
  balance: number
  totalOwed: number
  totalPaid: number
  regDate: string
  age: number | null
  genderLabel: string
}): string {
  const name = `${cap(patient.name)} ${cap(patient.surname)}`
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const diseases = anamnesis.diseases.join(', ') || '—'
  const meds = anamnesis.medications.join(', ') || '—'
  const fmtKurus = (k: number) => (k / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Hasta Kartı – ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 18px; font-weight: 800; color: #0F2B3D; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: 700; color: #0F2B3D; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .meta { font-size: 11px; color: #6b7280; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; }
  .field { margin-bottom: 2px; }
  .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; }
  .field-value { font-size: 12px; font-weight: 600; color: #1a1a1a; }
  .finance-row { display: flex; gap: 24px; }
  .finance-item { flex: 1; }
  .finance-value { font-size: 16px; font-weight: 800; }
  .red { color: #dc2626; }
  .green { color: #16a34a; }
  .notes { margin-top: 8px; font-size: 12px; color: #374151; white-space: pre-wrap; }
  .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>${name}</h1>
    <p class="meta">Protokol No: ${patient.protocol_no ?? '—'} &nbsp;|&nbsp; Kayıt: ${regDate}</p>
  </div>
  <div class="meta" style="text-align:right">
    <div>Hasta Kartı</div>
    <div>${today}</div>
  </div>
</div>

<h2>Kişisel Bilgiler</h2>
<div class="grid">
  <div class="field"><div class="field-label">T.C. Kimlik</div><div class="field-value">${tcValue}</div></div>
  <div class="field"><div class="field-label">Doğum Tarihi</div><div class="field-value">${patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('tr-TR') : '—'}</div></div>
  <div class="field"><div class="field-label">Yaş</div><div class="field-value">${age ?? '—'}</div></div>
  <div class="field"><div class="field-label">Cinsiyet</div><div class="field-value">${genderLabel}</div></div>
  <div class="field"><div class="field-label">Telefon</div><div class="field-value">${patient.phone1 ?? '—'}</div></div>
  <div class="field"><div class="field-label">E-posta</div><div class="field-value">${patient.email ?? '—'}</div></div>
  <div class="field" style="grid-column:1/-1"><div class="field-label">Adres</div><div class="field-value">${patient.address ?? '—'}</div></div>
</div>

<h2>Finansal Durum</h2>
<div class="finance-row">
  <div class="finance-item"><div class="field-label">Toplam Tedavi</div><div class="finance-value">₺${fmtKurus(totalOwed)}</div></div>
  <div class="finance-item"><div class="field-label">Ödenen</div><div class="finance-value green">₺${fmtKurus(totalPaid)}</div></div>
  <div class="finance-item"><div class="field-label">Kalan Borç</div><div class="finance-value ${balance > 0 ? 'red' : 'green'}">₺${fmtKurus(Math.max(balance, 0))}</div></div>
</div>

<h2>Anamnez / Sağlık Geçmişi</h2>
<div class="grid">
  <div class="field" style="grid-column:1/-1"><div class="field-label">Sistemik Hastalıklar</div><div class="field-value">${diseases}</div></div>
  <div class="field" style="grid-column:1/-1"><div class="field-label">Kullanılan İlaçlar</div><div class="field-value">${meds}</div></div>
</div>
${anamnesis.notes ? `<div class="notes"><span style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;">KLİNİK NOT:</span><br/>${anamnesis.notes}</div>` : ''}

<div class="footer">Bu belge DentSoft hasta yönetim sistemi tarafından oluşturulmuştur. ${today}</div>
</body></html>`
}

// ---- İkonlar ----
function IconPencil() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4Z" /></svg>
}
function IconPrint() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}
function IconUser() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
}
function IconLira() {
  return <span className="font-serif text-lg leading-none">₺</span>
}
function IconCreditCard() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
}
function IconSms() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
}
function IconShield() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}
function IconClipboardCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 12 2 2 4-4" /></svg>
}
function IconAlertTriangle() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}
function IconHeartPulse() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z" /><path d="M3.5 12H8l2-3 3 6 2-3h5.5" /></svg>
}
function IconLock() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}
function IconPill() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>
}

// ---- Anamnez kutusu ----
function AnamnezBox({
  patientId, anamnesis, loading, onSaved,
}: {
  patientId: number
  anamnesis: Anamnesis
  loading: boolean
  onSaved: (a: Anamnesis) => void
}) {
  const [draft, setDraft] = useState<Anamnesis>(anamnesis)
  const [medInput, setMedInput] = useState('')
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    queueMicrotask(() => { setDraft(anamnesis) })
  }, [anamnesis])

  const dirty =
    JSON.stringify(draft.diseases.slice().sort()) !== JSON.stringify(anamnesis.diseases.slice().sort()) ||
    JSON.stringify(draft.medications.slice().sort()) !== JSON.stringify(anamnesis.medications.slice().sort()) ||
    draft.notes !== anamnesis.notes

  const toggleDisease = (key: string) => {
    setDraft((d) => ({
      ...d,
      diseases: d.diseases.includes(key) ? d.diseases.filter((x) => x !== key) : [...d.diseases, key],
    }))
  }

  const addMed = (name: string) => {
    const v = name.trim()
    if (!v || draft.medications.some((m) => m.toLowerCase() === v.toLowerCase())) return
    setDraft((d) => ({ ...d, medications: [...d.medications, v] }))
    setMedInput('')
  }

  const removeMed = (name: string) => {
    setDraft((d) => ({ ...d, medications: d.medications.filter((m) => m !== name) }))
  }

  const save = () => {
    startTransition(async () => {
      const res = await updateAnamnesis(patientId, draft)
      if (res.success) {
        onSaved(draft)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        toast.success('Anamnez kaydedildi')
      } else if (res.error) {
        toast.error(`Anamnez kaydedilemedi: ${res.error}`)
      }
    })
  }

  const activeDiseases = DISEASES.filter((d) => draft.diseases.includes(d.key))
  const interactions = checkInteractions(draft.medications)
  const medSuggestions = DRUG_DATABASE.filter(
    (d) =>
      medInput &&
      d.name.toLowerCase().includes(medInput.toLowerCase()) &&
      !draft.medications.some((m) => m.toLowerCase() === d.name.toLowerCase())
  )

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-medium text-gray-400">Anamnez yükleniyor…</p>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#EEF2F6] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#0F766E]">
            <IconHeartPulse />
          </span>
          <div>
            <h2 className="text-base font-black text-[#0F2B3D]">Anamnez / Sağlık Geçmişi</h2>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
              <IconLock />
              Tıbbi bilgiler gizli saklanır
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">✓ Kaydedildi</span>}
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="rounded-xl bg-gradient-to-br from-[#5FD3C1] to-[#1EAEA0] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(31,174,160,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor…' : 'Anamnezi Kaydet'}
          </button>
        </div>
      </div>

      <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Sistemik Hastalıklar</h3>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {DISEASES.map((d) => {
          const active = draft.diseases.includes(d.key)
          return (
            <label
              key={d.key}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${active ? 'border-[#5FD3C1] bg-[#E6FFFA] text-[#0F766E]' : 'border-[#E7ECF2] bg-[#FAFBFC] text-slate-600 hover:border-[#5FD3C1]'}`}
            >
              <input type="checkbox" checked={active} onChange={() => toggleDisease(d.key)} className="h-4 w-4 rounded accent-[#2DD4BF]" />
              <span className="font-bold">{d.key}</span>
            </label>
          )
        })}
      </div>

      {activeDiseases.length > 0 && (
        <div className="space-y-1.5 mb-5">
          {activeDiseases.map((d) => {
            const s = LEVEL_STYLES[d.level]
            return (
              <div key={d.key} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${s.box}`}>
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className={s.text}><strong>{d.key}:</strong> {d.warning}</span>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Kullanılan İlaçlar</h3>
      <div className="relative mb-2 max-w-xl">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><IconPill /></span>
        <input
          type="text"
          value={medInput}
          onChange={(e) => setMedInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMed(medInput) } }}
          placeholder="İlaç adı yazıp Enter'a basın…"
          className="h-12 w-full rounded-[14px] border border-[#E7ECF2] bg-white pl-11 pr-4 text-sm font-medium text-[#0F2B3D] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
        />
        {medSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            {medSuggestions.map((d) => (
              <button key={d.name} onClick={() => addMed(d.name)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
                <span className="text-[#0F2B3D]">{d.name}</span>
                <span className="text-xs text-gray-400">{d.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {draft.medications.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {draft.medications.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
              {m}
              <button onClick={() => removeMed(m)} className="text-gray-400 hover:text-red-500">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {interactions.length > 0 && (
        <div className="space-y-1.5 mb-5">
          {interactions.map((it, i) => {
            const s = LEVEL_STYLES[it.level]
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${s.box}`}>
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className={s.text}><strong>{it.drugs.join(' + ')}:</strong> {it.risk}</span>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="mb-2 mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Klinik Not</h3>
      <textarea
        value={draft.notes}
        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        rows={4}
        placeholder="Anamnez ile ilgili serbest not…"
        className="min-h-[110px] w-full resize-none rounded-[14px] border border-[#E7ECF2] bg-white px-4 py-3 text-sm font-medium text-[#0F2B3D] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
      />
    </div>
  )
}

export default HastaKartiTab
