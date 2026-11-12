'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { addPrescription, deletePrescription, getPatientTc } from './actions'
import { escapeHtml, localDateValue, toTitleCase } from '@/lib/format'
import type { ClinicInfo, DoctorOption, DrugEntry, Patient, Prescription } from './types'
import { IconFileText, IconInfo, IconSearch, IconTrash } from '@/components/icons'

const DRUG_TABLE: DrugEntry[] = [
  // Topikal
  { name: 'Aftojel 5 gr Jel', ingredient: 'diklofenak + triamsinolon', category: 'Topikal Jel', usage: '3x1',
    template: 'Aftojel 5 gr Jel — 1B\n3x1\nGünde 3 kere, yemekten sonra ilgili bölgeye temiz parmaklarınızla sürünüz. Sürdükten sonra 1 saat herhangi bir şey yiyip içmeyiniz. 5 gün kullanınız.' },
  { name: 'Aklovir %5 Krem 10 gr', ingredient: 'asiklovir', category: 'Antiviral Krem', usage: '6x1',
    template: 'Aklovir %5 Krem 10 gr — 1B\n6x1\nGünde 6 kez ve 1 hafta süre ile uygulanır. Lezyonları örtecek şekilde sürülür.' },
  // Antibiyotikler
  { name: 'Aksef 500 mg 14 tb', ingredient: 'sefuroksim aksetil', category: 'Sefalosporin ATB', usage: '2x1',
    template: 'Aksef 500 mg 14 tb — 1B\n2x1\n12 saatte 1, yemeklerden yarım saat sonra tok karnına alınacak.' },
  { name: 'Amoklavin BID 1000 mg 14 tb', ingredient: 'amoksisilin + klavulanik asit', category: 'Penisilin ATB', usage: '2x1',
    template: 'Amoklavin BID 1000 mg 14 film tablet — 1B\n2x1\n12 saatte 1, yemekten sonra tok karnına içiniz.' },
  { name: 'Augmentin 1g BID 14 tb', ingredient: 'amoksisilin + klavulanik asit', category: 'Penisilin ATB', usage: '2x1',
    template: 'Augmentin 1g BID 14 tb — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. 7 gün kullanınız.' },
  { name: 'Augmentin 200 mg süsp', ingredient: 'amoksisilin + klavulanik asit', category: 'Penisilin ATB (çocuk)', usage: '2x1',
    template: 'Augmentin 200 mg süspansiyon — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiriniz. Bitene kadar kullanınız.' },
  { name: 'Augmentin 400 mg süsp', ingredient: 'amoksisilin + klavulanik asit', category: 'Penisilin ATB (çocuk)', usage: '2x1',
    template: 'Augmentin 400 mg süspansiyon — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra içiriniz. Bitene kadar kullanınız.' },
  { name: 'Azitro 250 mg 6 film tablet', ingredient: 'azitromisin', category: 'Makrolid ATB', usage: '2x1',
    template: 'Azitro 250 mg 6 film tablet — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz.' },
  { name: 'Azitro 5 ml 200 mg 30 ml süsp', ingredient: 'azitromisin', category: 'Makrolid ATB (çocuk)', usage: '1x1',
    template: 'Azitro 5 ml 200 mg 30 ml süspansiyon — 1B\n1x1\n24 saatte 1, tok karnına, 1 kaşık.' },
  { name: 'Flagyl 500 mg 20 tb', ingredient: 'metronidazol', category: 'Nitroimidazol ATB', usage: '2x1',
    template: 'Flagyl 500 mg 20 tb — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. Eğer mümkünse, ilk dozu operasyondan 1 saat önce alınız. Operasyon sonrası 5 gün daha kullanınız.' },
  { name: 'Klindan 150 mg 16 kapsül', ingredient: 'klindamisin', category: 'Linkozamid ATB', usage: '4x1',
    template: 'Klindan 150 mg 16 kapsül — 1B\n4x1\n6 saatte 1, bol su ile içiniz.' },
  { name: 'Klindan 600 mg amp', ingredient: 'klindamisin', category: 'Linkozamid ATB (IM)', usage: '2x1',
    template: 'Klindan 600 mg ampül — 4B\n2x1\nGünde 2 defa, sabah akşam, kalçadan, 2 gün kullanınız.' },
  // Ağrı kesici / NSAİİ
  { name: 'Apranax forte tb', ingredient: 'naproksen sodyum', category: 'NSAİİ', usage: '3x1',
    template: 'Apranax forte tb — 1B\n3x1' },
  { name: 'Aprol fort 10 tb', ingredient: 'naproksen sodyum', category: 'NSAİİ', usage: '2x1',
    template: 'Aprol fort 10 tb — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz.' },
  { name: 'Arveles tb 25 mg', ingredient: 'deksketoprofen', category: 'NSAİİ', usage: '2x1',
    template: 'Arveles tb 25 mg — 1B\n2x1\n12 saat ara ile günde 2 defa bol su ile içiniz. Kullanım sıklığı ağrı durumuna göre günde 4 adete kadar çıkılabilir.' },
  { name: 'Arveles amp 50 mg', ingredient: 'deksketoprofen', category: 'NSAİİ (IM)', usage: '2x1',
    template: 'Arveles amp 50 mg\n.' },
  { name: 'Calpol 120 mg 150 ml süsp', ingredient: 'parasetamol', category: 'Analjezik (çocuk)', usage: '3x1',
    template: 'Calpol 120 mg 150 ml süspansiyon — 1B\n3x1\n8 saatte 1, tok karnına içiriniz. 5 gün kullanınız.' },
  { name: 'Dikloron 75 mg IM 4 ampül', ingredient: 'diklofenak sodyum', category: 'NSAİİ (IM)', usage: '2x1',
    template: 'Dikloron 75 mg IM 4 ampül — 1B\n2x1' },
  { name: 'Muscoril 8 mg 10 tb', ingredient: 'tiyokolsikosid', category: 'Kas Gevşetici', usage: '2x1',
    template: 'Muscoril 8 mg 10 tb — 1B\n2x1\n12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. 5 gün kullanınız.' },
  { name: 'Parol 500 mg tb', ingredient: 'parasetamol', category: 'Analjezik', usage: '2x1',
    template: 'Parol 500 mg tb — 1B\n2x1\n12 saatte 1, bol su ile içiniz.' },
  { name: 'Tilcotil tb 100 mg', ingredient: 'tenoksikam', category: 'NSAİİ (oksikam)', usage: '1x1',
    template: 'Tilcotil tb 100 mg — 1B\n1x1' },
  // Steroid / Diğer
  { name: 'Lansor 30 mg 28 kapsül', ingredient: 'lansoprazol', category: 'Proton Pompası', usage: '1x1',
    template: 'Lansor 30 mg 28 kapsül — 1B\n1x1\nGünde bir kez, sabah aç karnına içiniz.' },
  { name: 'Prednol-L 40 mg 1 ampül', ingredient: 'metilprednizolon', category: 'Kortikosteroid (IM)', usage: '1x1',
    template: 'Prednol-L 40 mg 1 ampül\n1x1\nGünde bir defa kalçadan iğne şeklinde yaptırınız.' },
  // Gargara
  { name: 'Kloroben Gargara', ingredient: 'klorheksidin + benzidamin', category: 'Antiseptik Gargara', usage: '3x1',
    template: 'Kloroben Gargara — 1B\n3x1\n8 saatte 1, dişlerinizi fırçaladıktan sonra, gargarayı sulandırmadan, 1 dakika ağızda çalkalayınız, sonrasında yarım saat birşey yemeyiniz ve içmeyiniz. Operasyon günü kullanmayınız. Ertesi günden itibaren 7 gün kullanınız.' },
]

// Hazır reçete kombinasyonları
const RX_QUICK: { label: string; content: string }[] = [
  {
    label: 'Standart Reçete',
    content:
      'Augmentin 1000 mg tablet — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. 7 gün kullanınız.\n\nArveles 25 mg tablet — 1B\n2x1 — 12 saat ara ile günde 2 defa bol su ile içiniz.\n\nKloroben Gargara — 1B\n3x1 — 8 saatte 1, dişlerinizi fırçaladıktan sonra, gargarayı sulandırmadan 1 dakika ağızda çalkalayınız. Operasyon günü kullanmayınız. Ertesi günden itibaren 7 gün kullanınız.',
  },
  {
    label: 'Ameliyat Reçetesi',
    content:
      'Prednol-L 40 mg 1 ampül\n1x1 — Günde bir defa kalçadan iğne şeklinde yaptırınız.\n\nDikloron 75 mg IM 4 ampül\n2x1',
  },
  {
    label: 'Çocuk — 20 kg altı',
    content:
      'Augmentin 200 mg süspansiyon — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiriniz. Bitene kadar kullanınız.\n\nCalpol 120 mg 150 ml süspansiyon — 1B\n3x1 — 8 saatte 1, tok karnına içiriniz. 5 gün kullanınız.',
  },
  {
    label: 'Çocuk — 20 kg üstü',
    content:
      'Augmentin 400 mg süspansiyon — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra içiriniz. Bitene kadar kullanınız.\n\nCalpol 120 mg 150 ml süspansiyon — 1B\n3x1 — 8 saatte 1, tok karnına içiriniz. 5 gün kullanınız.',
  },
  {
    label: 'Mide Probleminde',
    content:
      'Augmentin 1000 mg tablet — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. 7 gün kullanınız.\n\nArveles 25 mg tablet — 1B\n2x1 — 12 saat ara ile günde 2 defa bol su ile içiniz.\n\nLansor 30 mg 28 kapsül — 1B\n1x1 — Günde bir kez, sabah aç karnına içiniz.',
  },
  {
    label: 'Penisilin Alerjisinde',
    content:
      'Klindan 150 mg 16 kapsül — 1B\n4x1 — 6 saatte 1, bol su ile içiniz.\n\nArveles 25 mg tablet — 1B\n2x1 — 12 saat ara ile günde 2 defa bol su ile içiniz.',
  },
  {
    label: 'Böbrek Probleminde',
    content:
      'Klindan 150 mg 16 kapsül — 1B\n4x1 — 6 saatte 1, bol su ile içiniz.\n\nKloroben Gargara — 1B\n3x1 — 8 saatte 1, dişlerinizi fırçaladıktan sonra, gargarayı sulandırmadan 1 dakika ağızda çalkalayınız.\n\nParol 500 mg tb — 1B\n2x1 — 12 saatte 1, bol su ile içiniz.',
  },
  {
    label: 'Kombine Antibiyotik',
    content:
      'Augmentin 1000 mg tablet — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz. 7 gün kullanınız.\n\nFlagyl 500 mg 20 tb — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz.\n\nArveles 25 mg tablet — 1B\n2x1 — 12 saat ara ile günde 2 defa bol su ile içiniz.\n\nKloroben Gargara — 1B\n3x1 — 8 saatte 1, dişlerinizi fırçaladıktan sonra, gargarayı sulandırmadan 1 dakika ağızda çalkalayınız. Operasyon günü kullanmayınız. Ertesi günden itibaren 7 gün kullanınız.',
  },
  {
    label: 'I.M Antibiyotik',
    content:
      'Aprol fort 10 tb — 1B\n2x1 — 12 saatte 1, yemekten yarım saat sonra, bol su ile içiniz.\n\nKlindan 600 mg ampül IM — 3B\n1x1 — Günde bir kez, kalçadan uygulanır.',
  },
]

function ReceteTab({
  patient,
  prescriptions,
  doctors,
  clinic,
  loading,
  onChanged,
}: {
  patient: Patient
  prescriptions: Prescription[]
  doctors: DoctorOption[]
  clinic: ClinicInfo | null
  loading: boolean
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [content, setContent] = useState('')
  const [doctorId, setDoctorId] = useState<number | null>(doctors[0]?.id ?? null)
  const [indication, setIndication] = useState('')
  const [tc, setTc] = useState('')
  // Hasta kartındaki T.C. otomatik gelir (elle değiştirilebilir)
  useEffect(() => {
    let active = true
    getPatientTc(patient.id).then((res) => {
      if (active && res.tc) setTc(res.tc)
    })
    return () => { active = false }
  }, [patient])
  const [printDate, setPrintDate] = useState(() => localDateValue())
  const [drugSearch, setDrugSearch] = useState('')
  const [pending, startTransition] = useTransition()

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId])

  const filteredDrugs = useMemo(() => {
    if (!drugSearch.trim()) return DRUG_TABLE
    const q = drugSearch.toLowerCase()
    return DRUG_TABLE.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.ingredient.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    )
  }, [drugSearch])

  const appendDrug = (drug: DrugEntry) => {
    setContent((c) => (c ? c + '\n\n' + drug.template : drug.template))
  }

  const applyQuick = (idx: number) => {
    const text = RX_QUICK[idx]?.content ?? ''
    if (text) setContent((c) => (c ? c + '\n\n' + text : text))
  }

  const save = () => {
    startTransition(async () => {
      const res = await addPrescription(patient.id, content, doctorId)
      if (res.error) toast.error(res.error)
      else { setContent(''); onChanged() }
    })
  }

  const remove = async (id: number) => {
    const ok = await confirm({ title: 'Reçeteyi Sil', message: 'Bu reçete kalıcı olarak silinecek. Emin misiniz?', confirmText: 'Evet, Sil' })
    if (!ok) return
    startTransition(async () => {
      const res = await deletePrescription(id)
      if (res.error) toast.error(res.error)
      else { toast.success('Reçete silindi'); onChanged() }
    })
  }

  const buildPrintHtml = (
    rxContent: string,
    rxDate: string,
    rxTc?: string,
    rxIndication?: string,
    doctorName?: string,
  ) => {
    const dateStr = new Date(rxDate).toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const patientName = escapeHtml(`${toTitleCase(patient.name)} ${toTitleCase(patient.surname)}`)
    const clinicName = escapeHtml(clinic?.clinic_name ?? 'Klinik')
    const clinicContact = [clinic?.phone, clinic?.email].filter(Boolean).map((item) => escapeHtml(item)).join(' · ')
    const medicationItems = rxContent
      .trim()
      .split(/\n\s*\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `<li><div class="medication">${escapeHtml(item).replace(/\n/g, '<br>')}</div></li>`)
      .join('')
    return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Reçete — ${patientName}</title>
<style>
@page{size:A5 portrait;margin:13mm 14mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#17212b;background:#fff;line-height:1.45}
.doctor-header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #17212b;padding-bottom:10px}
.doctor-name{font-size:16pt;font-weight:700;color:#111827}
.doctor-label{font-size:8pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:2px}
.clinic{text-align:right;font-size:9pt;color:#475569;line-height:1.5}
.clinic strong{display:block;font-size:10pt;color:#1f2937}
.document-title{margin:13px 0 9px;font-size:9pt;font-weight:700;letter-spacing:.16em;text-align:center;color:#64748b}
.patient-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cbd5e1;border-radius:4px;overflow:hidden}
.patient-item{min-height:48px;padding:7px 9px;border-bottom:1px solid #e2e8f0}
.patient-item:nth-child(odd){border-right:1px solid #e2e8f0}
.patient-item:nth-last-child(-n+2){border-bottom:0}
.label{display:block;margin-bottom:3px;font-size:7.5pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.value{font-size:10pt;font-weight:600;color:#17212b;overflow-wrap:anywhere}
.medications{margin-top:16px}
.medications-title{padding-bottom:6px;border-bottom:1px solid #cbd5e1;font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569}
ol{margin:9px 0 0 24px;padding:0}
li{padding:0 0 9px 5px;font-size:11pt;font-weight:700;color:#0f172a;break-inside:avoid}
.medication{font-weight:500;line-height:1.55;white-space:normal}
.footer{display:flex;justify-content:flex-end;margin-top:20px;padding-top:8px}
.sign-box{width:165px;text-align:center}
.sign-space{height:42px;border-bottom:1px solid #64748b}
.sign-lbl{margin-top:4px;font-size:8pt;color:#64748b}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="doctor-header">
  <div>
    <div class="doctor-label">Reçeteyi Düzenleyen Hekim</div>
    <div class="doctor-name">Dt. ${escapeHtml(doctorName ?? '—')}</div>
  </div>
  <div class="clinic">
    <strong>${clinicName}</strong>
    ${clinicContact ? `<span>${clinicContact}</span>` : ''}
  </div>
</div>
<div class="document-title">REÇETE</div>
<div class="patient-grid">
  <div class="patient-item"><span class="label">Hasta Adı Soyadı</span><span class="value">${patientName}</span></div>
  <div class="patient-item"><span class="label">Tarih</span><span class="value">${dateStr}</span></div>
  <div class="patient-item"><span class="label">T.C. Kimlik No</span><span class="value">${escapeHtml(rxTc || '—')}</span></div>
  <div class="patient-item"><span class="label">Tanı</span><span class="value">${escapeHtml(rxIndication || '—')}</span></div>
</div>
<div class="medications">
  <div class="medications-title">İlaçlar ve Kullanım Bilgileri</div>
  <ol>${medicationItems}</ol>
</div>
<div class="footer">
  <div class="sign-box">
    <div class="sign-space"></div>
    <div class="sign-lbl">Hekim İmza / Kaşe</div>
  </div>
</div>
</body></html>`
  }

  const printNew = () => {
    if (!content.trim()) return
    const w = window.open('', '_blank', 'width=680,height=960')
    if (!w) return
    w.document.write(
      buildPrintHtml(content, printDate, tc || undefined, indication || undefined, selectedDoctor?.name),
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const printRx = (rx: Prescription) => {
    const w = window.open('', '_blank', 'width=680,height=960')
    if (!w) return
    w.document.write(buildPrintHtml(rx.content, rx.created_at, undefined, undefined, rx.doctor?.name))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <SectionHeader
            icon={<IconClipboard />}
            title="Yeni Reçete"
            description="Hasta için reçete oluşturun ve ilaçları listeden ekleyin."
            iconClassName="bg-[#DDF8F4] text-[#0F766E]"
          />

          <div className="mt-5 rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] p-[18px]">
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#142536]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E6FFFA] text-[#0F766E]">
                <IconUser />
              </span>
              {toTitleCase(patient.name)} {toTitleCase(patient.surname)}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="T.C. No">
                <input
                  type="text"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  placeholder="TC kimlik girin"
                  maxLength={11}
                  className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white px-3.5 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                />
              </Field>
              <Field label="Tarih">
                <input
                  type="date"
                  value={printDate}
                  onChange={(e) => setPrintDate(e.target.value)}
                  className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white px-3.5 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Tanı">
                  <input
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="Örn: Çekim sonrası ağrı ve enfeksiyon profilaksisi"
                    className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white px-3.5 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-black text-[#142536]">Hazır Şablonlar</p>
              <div className="flex flex-wrap gap-2">
                {RX_QUICK.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => applyQuick(i)}
                    className="rounded-full border border-[#FED7AA] bg-[#FFF7E6] px-3 py-2 text-xs font-bold text-[#B45309] transition hover:bg-[#FEF3C7]"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            {doctors.length > 0 && (
              <div className="relative w-full lg:w-64">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IconUser />
                </span>
                <select
                  value={doctorId ?? ''}
                  onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}
                  className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white pl-10 pr-3 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>Dt. {d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-black text-[#142536]">Reçete İçeriği</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'İlaç adı, doz ve kullanım talimatları...\n\nSağdaki tablodan ilaç seçerek ekleyebilirsiniz.'}
              className="min-h-[300px] w-full resize-y rounded-[18px] border border-[#E7ECF2] bg-white px-4 py-4 text-sm font-medium leading-7 text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
            <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-3.5 py-3 text-xs font-semibold text-slate-500">
              <IconInfo />
              <span>Reçete içeriği hekim kontrolü gerektirir. İlaç listesinde + butonuna basarak içerik otomatik eklenir.</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={save}
              disabled={pending || !content.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-[18px] text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#CCFBF1] disabled:text-slate-500 disabled:opacity-70"
            >
              <IconSave />
              {pending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              onClick={printNew}
              disabled={!content.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#E7ECF2] bg-white px-[18px] text-sm font-black text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconPrinter />
              Yazdır
            </button>
            {content.trim() && (
              <button
                onClick={() => setContent('')}
                className="h-11 rounded-[14px] px-4 text-xs font-bold text-slate-400 transition hover:text-slate-600"
              >
                Temizle
              </button>
            )}
          </div>
        </section>

        <section className="flex max-h-[720px] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#EEF2F6] p-5">
            <SectionHeader
              icon={<IconPill />}
              title="İlaç Listesi"
              description="Reçeteye eklemek için ilacı seçin."
              iconClassName="bg-[#EAF7FF] text-[#0284C7]"
            />
            <div className="relative mt-4">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </span>
              <input
                type="text"
                value={drugSearch}
                onChange={(e) => setDrugSearch(e.target.value)}
                placeholder="İlaç adı veya etken madde ara..."
                className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-[#FAFBFC] pl-10 pr-3 text-sm font-medium text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:bg-white focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_86px_54px_34px] gap-2 rounded-xl bg-[#FAFBFC] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
              <span>İlaç</span>
              <span>Sınıf</span>
              <span className="text-center">Doz</span>
              <span />
            </div>
            <div className="mt-2 space-y-1">
              {filteredDrugs.map((drug, i) => (
                <button
                  key={i}
                  onClick={() => appendDrug(drug)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_86px_54px_34px] items-center gap-2 rounded-xl border-b border-[#EEF2F6] px-3 py-3 text-left transition hover:bg-[#5FD3C1]/[0.06]"
                  title={`Ekle: ${drug.name}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black text-[#142536]">{drug.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">{drug.ingredient}</span>
                  </span>
                  <span className="truncate rounded-full bg-[#F1F5F9] px-2 py-1 text-[10px] font-bold text-slate-500" title={drug.category}>
                    {drug.category}
                  </span>
                  <span className="text-center text-xs font-black text-[#142536]">{drug.usage}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E6FFFA] text-[#0F766E] transition group-hover:bg-[#5FD3C1] group-hover:text-white">
                    <IconPlus />
                  </span>
                </button>
              ))}
              {filteredDrugs.length === 0 && (
                <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#FAFBFC] px-4 py-8 text-center text-xs font-semibold text-slate-400">
                  &quot;{drugSearch}&quot; için sonuç bulunamadı
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3 text-center text-[11px] font-semibold text-slate-400">
            Satıra tıklayarak reçeteye ekle
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <SectionHeader
          icon={<IconFileText />}
          title="Reçete Geçmişi"
          description="Hastaya daha önce yazılan reçeteler"
          iconClassName="bg-[#F3E8FF] text-[#7C3AED]"
        />
        <div className="mt-5">
          {loading ? (
            <div className="rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-5 text-sm font-semibold text-slate-400">
              Yükleniyor...
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <IconFileText />
              </span>
              <h3 className="text-sm font-black text-[#142536]">Henüz reçete geçmişi yok.</h3>
              <p className="mt-1 max-w-sm text-xs font-medium text-slate-400">Kaydedilen reçeteler burada görüntülenir.</p>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
              {prescriptions.map((rx) => (
                <article
                  key={rx.id}
                  className="rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-400">
                      <IconCalendar />
                      <span className="truncate">
                        {new Date(rx.created_at).toLocaleDateString('tr-TR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </span>
                      {rx.doctor?.name && <span className="hidden sm:inline">· Dt. {rx.doctor.name}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => printRx(rx)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E]"
                        title="Yazdır"
                      >
                        <IconPrinter />
                      </button>
                      <button
                        onClick={() => remove(rx.id)}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Sil"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                  <pre className="line-clamp-4 whitespace-pre-wrap font-sans text-sm font-medium leading-6 text-[#142536]">
                    {rx.content}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
  iconClassName,
}: {
  icon: ReactNode
  title: string
  description: string
  iconClassName: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
        {icon}
      </span>
      <div>
        <h2 className="text-base font-black text-[#0F2B3D]">{title}</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function IconClipboard() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14h6" /><path d="M9 18h4" /><path d="M14 10l2 2 4-4" /></svg>
}

function IconUser() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
}

function IconSave() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>
}

function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
}

function IconPill() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>
}

function IconPlus() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}

function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
}

export default ReceteTab
