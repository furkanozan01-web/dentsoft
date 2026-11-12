'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { getNextInvoiceNo, getPatientTc, sendInvoiceToInstitution } from './actions'
import { escapeHtml, toTitleCase, formatAmount, cleanMoney } from '@/lib/format'
import type { ClinicInfo, Patient, Transaction, Treatment } from './types'
import { IconFileText, IconInfo } from '@/components/icons'

function parseKurus(value: string): number {
  const raw = cleanMoney(value)
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function inputMoney(kurus: number): string {
  return (kurus / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function defaultTreatmentDescription(treatments: Treatment[]): string {
  const names = Array.from(new Set(treatments.map((t) => t.treatment_name).filter(Boolean)))
  return names.length > 0 ? names.join(', ') : 'Diş tedavi hizmeti'
}

// ---- Fatura Tab ----
function FaturaTab({
  patient,
  treatments,
  transactions,
  clinic,
  loading,
  onChanged,
}: {
  patient: Patient
  treatments: Treatment[]
  transactions: Transaction[]
  clinic: ClinicInfo | null
  loading: boolean
  onChanged: () => void
}) {
  const [tcNo, setTcNo] = useState<string | null>(null)
  const [generatedInvoice, setGeneratedInvoice] = useState<{ patientId: number; invoiceNo: string | null } | null>(null)
  const [invoiceNoDraft, setInvoiceNoDraft] = useState<string | null>(null)
  const [lineDescriptionDraft, setLineDescriptionDraft] = useState<string | null>(null)
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const payments = useMemo(
    () => transactions.filter((tx) => tx.type === 'payment'),
    [transactions]
  )
  const openPayments = useMemo(
    () => payments.filter((tx) => !tx.invoice_no),
    [payments]
  )
  const invoicePayments = openPayments.length > 0 ? openPayments : payments
  const transactionIds = invoicePayments.map((tx) => tx.id)
  const paidTotal = invoicePayments.reduce((sum, tx) => sum + (tx.amount ?? 0), 0)
  const generatedInvoiceNo =
    generatedInvoice?.patientId === patient.id ? generatedInvoice.invoiceNo : null
  const invoiceNo = invoiceNoDraft ?? generatedInvoiceNo ?? ''
  const lineDescription = lineDescriptionDraft ?? defaultTreatmentDescription(treatments)
  const amountStr = amountDraft ?? inputMoney(paidTotal)

  useEffect(() => {
    let active = true
    getPatientTc(patient.id).then((res) => {
      if (!active) return
      setTcNo(res.tc ?? null)
    })
    return () => {
      active = false
    }
  }, [patient])

  useEffect(() => {
    let active = true
    getNextInvoiceNo().then((res) => {
      if (!active) return
      if (res.error) {
        toast.error(res.error)
        return
      }
      setGeneratedInvoice({ patientId: patient.id, invoiceNo: res.invoiceNo ?? null })
    })
    return () => {
      active = false
    }
  }, [patient.id])

  const vatBps = clinic?.vat_rate ?? 1000
  const vatPercent = vatBps / 100
  const grossTotal = parseKurus(amountStr)
  const kdvMatrah = Math.round((grossTotal * 10000) / (10000 + vatBps))
  const kdvTutar = grossTotal - kdvMatrah
  const today = new Date().toLocaleDateString('tr-TR')
  const institution = clinic?.invoice_institution?.trim() || ''
  const canSend = Boolean(institution) && transactionIds.length > 0 && grossTotal > 0 && !pending

  const printInvoice = () => {
    const patientName = escapeHtml(`${toTitleCase(patient.name)} ${toTitleCase(patient.surname)}`)
    const clinicName = escapeHtml(clinic?.clinic_name ?? 'Klinik')
    const clinicAddress = escapeHtml(clinic?.address)
    const clinicPhone = escapeHtml(clinic?.phone)
    const clinicTaxNo = escapeHtml(clinic?.tax_no)
    const clinicTaxOffice = escapeHtml(clinic?.tax_office)
    const logoUrl = escapeHtml(clinic?.logo_url)
    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Fatura - ${patientName}</title>
      <style>
        body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;padding:32px;max-width:760px;margin:0 auto}
        h2{color:#0f2b3d;margin:0}
        .head{display:flex;justify-content:space-between;margin-bottom:24px}
        .muted{color:#64748b;font-size:13px;margin:2px 0}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
        th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}
        th{color:#64748b;font-size:12px}
        .totals{margin-top:16px;margin-left:auto;width:300px;font-size:14px}
        .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .totals .grand{font-weight:700;border-top:2px solid #0f2b3d;margin-top:4px;padding-top:8px;color:#0f2b3d}
        hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}
      </style></head><body>
      <div class="head">
        <div style="display:flex;align-items:flex-start;gap:12px">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:48px;width:auto;object-fit:contain;flex-shrink:0" />` : ''}
          <div>
            <h2>${clinicName}</h2>
            <p class="muted">${clinicAddress}</p>
            <p class="muted">${clinicPhone ? 'Tel: ' + clinicPhone : ''}</p>
            <p class="muted">${clinicTaxNo ? 'Vergi No: ' + clinicTaxNo : ''} ${clinicTaxOffice ? '· ' + clinicTaxOffice : ''}</p>
          </div>
        </div>
        <div style="text-align:right">
          <p class="muted"><strong>Tarih:</strong> ${today}</p>
          <p class="muted"><strong>Protokol No:</strong> ${escapeHtml(patient.protocol_no) || '-'}</p>
          <p class="muted"><strong>Fatura No:</strong> ${escapeHtml(invoiceNo) || '-'}</p>
          <p class="muted"><strong>T.C. Kimlik:</strong> ${escapeHtml(tcNo) || '-'}</p>
        </div>
      </div>
      <hr>
      <p class="muted"><strong>Hasta:</strong> ${patientName}</p>
      <p class="muted"><strong>Telefon:</strong> ${escapeHtml(patient.phone1) || '-'}</p>
      <p class="muted"><strong>Adres:</strong> ${escapeHtml(patient.address) || '-'}</p>
      <table>
        <thead><tr><th>İşlem</th><th style="text-align:right">Alınan Ücret</th></tr></thead>
        <tbody><tr><td>${escapeHtml(lineDescription) || 'Diş tedavi hizmeti'}</td><td style="text-align:right">₺${formatAmount(grossTotal)}</td></tr></tbody>
      </table>
      <div class="totals">
        <div><span>KDV Matrahı</span><span>₺${formatAmount(kdvMatrah)}</span></div>
        <div><span>KDV (%${vatPercent})</span><span>₺${formatAmount(kdvTutar)}</span></div>
        <div class="grand"><span>Genel Toplam</span><span>₺${formatAmount(grossTotal)}</span></div>
      </div>
      <hr>
      <p class="muted" style="text-align:center">Teşekkür ederiz · ${clinicName}</p>
      </body></html>`

    const w = window.open('', '_blank', 'width=820,height=900')
    if (!w) {
      toast.error('Yazdırma penceresi açılamadı. Tarayıcı açılır pencere engelini kontrol edin.')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 250)
  }

  const sendInvoice = () => {
    if (!institution) {
      toast.error('Ayarlar > Klinik bölümünde e-fatura gönderim kurumu tanımlayın.')
      return
    }
    if (transactionIds.length === 0 || grossTotal <= 0) {
      toast.error('Faturalanacak ödeme kaydı bulunamadı.')
      return
    }
    startTransition(async () => {
      const res = await sendInvoiceToInstitution({
        patientId: patient.id,
        transactionIds,
        invoiceNo,
        lineDescription,
        amountKurus: grossTotal,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      setGeneratedInvoice({ patientId: patient.id, invoiceNo: res.invoiceNo ?? null })
      setInvoiceNoDraft(null)
      toast.success(`${res.invoiceNo} numaralı fatura ${res.institution} için kayda alındı.`)
      onChanged()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-slate-200/90 bg-white py-16 text-sm font-semibold text-slate-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        Yükleniyor...
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            icon={<IconReceipt />}
            title="Fatura Bilgileri"
            description="Hastaya ait fatura ve gönderim bilgilerini düzenleyin."
            iconClassName="bg-[#DDF8F4] text-[#0F766E]"
          />
          <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">
            Taslak
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Fatura No">
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNoDraft(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-[15px] font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
          </Field>
          <Field label="Alınan Ücret (₺)">
            <input
              value={amountStr}
              onChange={(e) => setAmountDraft(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-[15px] font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Yapılan İşlem">
              <input
                value={lineDescription}
                onChange={(e) => setLineDescriptionDraft(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-[15px] font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3.5 lg:flex-row lg:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F766E] shadow-sm">
            <IconCalculator />
          </span>
          <div className="min-w-0 flex-1 text-xs font-semibold leading-5 text-slate-500">
            <p>
              KDV dahil hesaplanır: matrah <strong className="text-[#142536]">₺{formatAmount(kdvMatrah)}</strong> · KDV %{vatPercent}{' '}
              <strong className="text-[#142536]">₺{formatAmount(kdvTutar)}</strong>
            </p>
            <p>
              Gönderim kurumu:{' '}
              <strong className={institution ? 'text-[#142536]' : 'text-amber-700'}>
                {institution || 'Tanımlı değil'}
              </strong>
            </p>
          </div>
          {!institution && (
            <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">
              Kurum tanımlı değil
            </span>
          )}
        </div>

        {!institution && (
          <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[#FED7AA] bg-[#FFF7E6] px-3.5 py-3 text-xs font-semibold leading-5 text-[#B45309]">
            <IconAlertTriangle />
            <span>Gönderim kurumu tanımlı değil. Faturayı göndermek için kurum entegrasyonu yapılandırılmalı.</span>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={printInvoice}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-[18px] text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
          >
            <IconPrinter />
            Yazdır
          </button>
          <button
            onClick={sendInvoice}
            disabled={!canSend}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-[18px] text-sm font-black text-slate-400 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 enabled:text-[#142536]"
          >
            <IconSend />
            {pending ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            icon={<IconFileText />}
            title="Fatura Önizleme"
            description="Yazdırılacak fatura dokümanı"
            iconClassName="bg-[#EAF7FF] text-[#0284C7]"
          />
          <div className="rounded-2xl bg-[#FAFBFC] px-4 py-2 text-xs font-bold text-slate-500">
            <span className="text-slate-400">Tarih:</span> {today} · <span className="text-slate-400">Fatura No:</span> {invoiceNo || '—'}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-5xl rounded-[22px] border border-[#EEF2F6] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E6FFFA] text-[#0F766E]">
                  <IconBuilding />
                </span>
                <div>
                  <h2 className="text-xl font-black text-[#0F2B3D]">{clinic?.clinic_name ?? 'Klinik'}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Diş kliniği / sağlık hizmetleri</p>
                  {clinic?.address && <p className="mt-2 max-w-xl text-xs font-medium leading-5 text-slate-500">{clinic.address}</p>}
                  {clinic?.phone && <p className="text-xs font-medium text-slate-500">Tel: {clinic.phone}</p>}
                  {(clinic?.tax_no || clinic?.tax_office) && (
                    <p className="text-xs font-medium text-slate-500">
                      {clinic?.tax_no && `Vergi No: ${clinic.tax_no}`}
                      {clinic?.tax_office && ` · ${clinic.tax_office}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-[240px] rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] p-4 text-xs">
                <PreviewMeta label="Tarih" value={today} />
                <PreviewMeta label="Protokol No" value={patient.protocol_no ?? '—'} />
                <PreviewMeta label="Fatura No" value={invoiceNo || '—'} />
                <PreviewMeta label="T.C. Kimlik" value={tcNo ?? '—'} />
              </div>
            </div>

            <div className="my-6 h-px bg-[#EEF2F6]" />

            <div className="rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoItem label="Hasta" value={`${toTitleCase(patient.name)} ${toTitleCase(patient.surname)}`} />
                <InfoItem label="Telefon" value={patient.phone1 ?? '—'} />
                <InfoItem label="Adres" value={patient.address ?? '—'} />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#EEF2F6]">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr className="h-12 border-b border-[#EEF2F6]">
                    <th className="px-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">İşlem</th>
                    <th className="px-4 text-right text-xs font-black uppercase tracking-wide text-slate-500">Alınan Ücret</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-16 border-b border-[#EEF2F6] last:border-0">
                    <td className="px-4 font-semibold text-[#0F2B3D]">{lineDescription || 'Diş tedavi hizmeti'}</td>
                    <td className="px-4 text-right font-black text-[#142536]">₺{formatAmount(grossTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="text-xs text-slate-400">
                {invoicePayments.length > 0 ? (
                  <div className="rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] p-4">
                    <p className="mb-2 font-black text-slate-600">Bağlı ödeme kayıtları</p>
                    <div className="space-y-1">
                      {invoicePayments.map((tx) => (
                        <p key={tx.id} className="font-semibold text-slate-500">
                          {new Date(tx.transaction_date).toLocaleDateString('tr-TR')} · ₺{formatAmount(tx.amount)}
                          {tx.invoice_no ? ` · ${tx.invoice_no}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-3.5 py-3 text-xs font-semibold text-slate-500">
                    <IconInfo />
                    <span>Faturalandırılacak ödeme kaydı yok.</span>
                  </div>
                )}
              </div>

              <div className="w-full rounded-[18px] border border-[#EEF2F6] bg-[#FAFBFC] p-4 text-sm lg:w-80">
                <TotalLine label="KDV Matrahı" value={`₺${formatAmount(kdvMatrah)}`} />
                <TotalLine label={`KDV (%${vatPercent})`} value={`₺${formatAmount(kdvTutar)}`} />
                <div className="mt-3 flex justify-between border-t-2 border-[#5FD3C1] pt-3 text-[17px] font-black text-[#142536]">
                  <span>Genel Toplam</span>
                  <span>₺{formatAmount(grossTotal)}</span>
                </div>
              </div>
            </div>
          </div>
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
      <span className="mb-2 block text-[13px] font-bold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#EEF2F6] py-1.5 last:border-0">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className="text-right font-black text-[#142536]">{value}</span>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#142536]">{value}</p>
    </div>
  )
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 font-semibold text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function IconReceipt() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2v20l3-2 3 2 3-2 3 2 4-2V2z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></svg>
}

function IconCalculator() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>
}

function IconAlertTriangle() {
  return <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function IconPrinter() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
}

function IconSend() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
}

function IconBuilding() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h.01" /><path d="M9 13h.01" /><path d="M9 17h.01" /></svg>
}

export default FaturaTab
