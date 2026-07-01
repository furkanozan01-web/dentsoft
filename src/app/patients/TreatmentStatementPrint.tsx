'use client'

import { useMemo } from 'react'
import { FDI } from './constants'
import { formatAmount } from '@/lib/format'
import ToothChart, { classifyTreatment, type ToothFlags } from './ToothChart'
import type { ClinicInfo, Installment, Patient, Transaction, Treatment } from './types'

type TreatmentStatementPrintProps = {
  patient: Patient
  treatments: Treatment[]
  transactions: Transaction[]
  clinic: ClinicInfo | null
  installments?: Installment[]
}

export function printTreatmentStatement(patientId: number): boolean {
  const statement = document.getElementById(`treatment-statement-${patientId}`)
  if (!statement) return false
  window.print()
  return true
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR')
}

function signedMoney(value: number): string {
  if (value === 0) return '₺0,00'
  return `${value > 0 ? '+' : '-'}₺${formatAmount(Math.abs(value))}`
}

export default function TreatmentStatementPrint({
  patient,
  treatments,
  transactions,
  clinic,
  installments = [],
}: TreatmentStatementPrintProps) {
  const toothStates = useMemo(() => {
    const states = new Map<number, ToothFlags>()
    for (const treatment of treatments) {
      if (!treatment.tooth) continue
      const kind = classifyTreatment(treatment.treatment_name)
      if (!kind) continue
      const flags = states.get(treatment.tooth) ?? {}
      flags[kind] = true
      states.set(treatment.tooth, flags)
    }
    return states
  }, [treatments])

  const originalTotal = treatments.reduce(
    (sum, treatment) => sum + (treatment.original_fee ?? treatment.fee),
    0
  )
  const netTotal = treatments.reduce((sum, treatment) => sum + treatment.fee, 0)
  const adjustmentTotal = netTotal - originalTotal
  const discountRate = originalTotal > 0
    ? Math.abs(adjustmentTotal / originalTotal) * 100
    : 0
  const payments = transactions.filter((transaction) => transaction.type === 'payment')
  const paidTotal = payments.reduce((sum, transaction) => sum + transaction.amount, 0)
  const balance = netTotal - paidTotal
  const registrationDate = patient.reg_date ?? patient.created_at
  const doctors = Array.from(
    new Set(treatments.map((treatment) => treatment.doctor?.name).filter(Boolean))
  ).join(', ')

  const doctorBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const t of treatments) {
      const name = t.doctor?.name ?? 'Atanmamış'
      const cur = map.get(name) ?? { count: 0, total: 0 }
      map.set(name, { count: cur.count + 1, total: cur.total + t.fee })
    }
    return Array.from(map.entries())
      .map(([name, { count, total }]) => ({ name, count, total }))
      .sort((a, b) => b.total - a.total)
  }, [treatments])

  return (
    <>
      <div
        id={`treatment-statement-${patient.id}`}
        className="treatment-statement-print"
        aria-hidden="true"
      >
        <header className="statement-header">
          <div className="statement-clinic">
            {clinic?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logo_url} alt="Klinik logosu" className="statement-logo" />
            ) : null}
            <div>
              <h1>{clinic?.clinic_name || 'DentSoft Kliniği'}</h1>
              <p>{clinic?.address || 'Adres bilgisi tanımlanmamış'}</p>
              <p>{[clinic?.phone, clinic?.email].filter(Boolean).join(' · ') || 'İletişim bilgisi tanımlanmamış'}</p>
            </div>
          </div>
          <div className="statement-title">
            <span>TEDAVİ DÖKÜMÜ</span>
            <strong>Tarih: {formatDate(new Date().toISOString())}</strong>
          </div>
        </header>

        <section className="statement-patient-grid">
          <StatementField label="Hasta" value={`${patient.name} ${patient.surname}`} />
          <StatementField label="Protokol No" value={patient.protocol_no || '—'} />
          <StatementField label="Kayıt Tarihi" value={formatDate(registrationDate)} />
          <StatementField label="T.C. Kimlik No" value="Gizli" />
          <StatementField label="Telefon" value={patient.phone1 || '—'} />
          <StatementField label="Hekim" value={doctors || '—'} />
        </section>

        <section className="statement-section statement-chart-section">
          <h2>Diş Şeması</h2>
          <div className="statement-chart">
            <ToothChart
              upperTeeth={FDI.upperPermanent}
              lowerTeeth={FDI.lowerPermanent}
              selected={null}
              states={toothStates}
              onSelect={() => undefined}
            />
          </div>
        </section>

        <section className="statement-section">
          <h2>Tedavi Kalemleri</h2>
          <table className="statement-table">
            <thead>
              <tr>
                <th>Diş</th>
                <th>Tedavi</th>
                <th>Tarih</th>
                <th>Liste Fiyatı</th>
                <th>İndirim</th>
                <th>Net Tutar</th>
              </tr>
            </thead>
            <tbody>
              {treatments.length === 0 ? (
                <tr><td colSpan={6} className="statement-empty">Tedavi kaydı bulunmuyor.</td></tr>
              ) : treatments.map((treatment) => {
                const originalFee = treatment.original_fee ?? treatment.fee
                return (
                  <tr key={treatment.id}>
                    <td>{treatment.tooth ?? '—'}</td>
                    <td>
                      <strong>{treatment.treatment_name}</strong>
                      {treatment.is_closed && <span className="statement-closed">KPL</span>}
                    </td>
                    <td>{formatDate(treatment.treatment_date)}</td>
                    <td>₺{formatAmount(originalFee)}</td>
                    <td className={treatment.fee - originalFee < 0 ? 'statement-discount' : ''}>
                      {signedMoney(treatment.fee - originalFee)}
                    </td>
                    <td><strong>₺{formatAmount(treatment.fee)}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        {doctorBreakdown.length > 1 && (
          <section className="statement-section">
            <h2>Hekim Payı / Oran</h2>
            <table className="statement-table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>Hekim</th>
                  <th style={{ width: '18%' }}>Tedavi</th>
                  <th style={{ width: '26%' }}>Net Toplam</th>
                  <th style={{ width: '18%' }}>Pay (%)</th>
                </tr>
              </thead>
              <tbody>
                {doctorBreakdown.map((row) => {
                  const pct = netTotal > 0 ? (row.total / netTotal) * 100 : 0
                  return (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.count} kalem</td>
                      <td>₺{formatAmount(row.total)}</td>
                      <td>%{pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {installments.length > 0 && (
          <section className="statement-section">
            <h2>Ödeme Planı / Taksitler</h2>
            <table className="statement-table">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>#</th>
                  <th style={{ width: '30%' }}>Vade Tarihi</th>
                  <th style={{ width: '30%' }}>Tutar</th>
                  <th style={{ width: '32%' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((it, i) => (
                  <tr key={it.id}>
                    <td>{i + 1}</td>
                    <td>{formatDate(it.due_date)}</td>
                    <td>₺{formatAmount(it.amount)}</td>
                    <td>
                      <span className={it.paid ? 'statement-badge-paid' : 'statement-badge-pending'}>
                        {it.paid ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="statement-summary">
          <div className="statement-note">
            <strong>Senet ve Taahhüt</strong>
            <p>Yukarıda belirtilen tedavi ücretlerini ödemeyi kabul ve taahhüt ederim.</p>
          </div>
          <div className="statement-totals">
            <SummaryLine label="Toplam (orijinal)" value={`₺${formatAmount(originalTotal)}`} />
            {adjustmentTotal !== 0 && (
              <>
                <SummaryLine
                  label={adjustmentTotal > 0 ? 'Toplam Artırım' : 'Toplam İndirim'}
                  value={signedMoney(adjustmentTotal)}
                />
                <SummaryLine label={adjustmentTotal > 0 ? 'Artırım Oranı' : 'İndirim Oranı'} value={`%${discountRate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`} />
              </>
            )}
            <SummaryLine label="İndirimli Toplam" value={`₺${formatAmount(netTotal)}`} strong />
            <SummaryLine label="Yapılan Ödemeler" value={`₺${formatAmount(paidTotal)}`} />
            <SummaryLine label="Kalan Bakiye" value={`₺${formatAmount(balance)}`} strong />
          </div>
        </section>

        <footer className="statement-promise">
          <div><strong>Tarih:</strong> ___/___/______</div>
          <div className="statement-patient-signature">
            <strong>Hasta İmzası:</strong> ____________________
            <span>{patient.name} {patient.surname}</span>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        .treatment-statement-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          .treatment-statement-print,
          .treatment-statement-print * { visibility: visible !important; }
          .treatment-statement-print {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 190mm;
            color: #142536;
            background: white;
            font-family: Arial, sans-serif;
            font-size: 9pt;
          }
          .statement-header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 2px solid #0f766e; padding-bottom: 4mm; }
          .statement-clinic { display: flex; align-items: center; gap: 4mm; min-width: 0; }
          .statement-clinic h1 { margin: 0 0 1mm; font-size: 15pt; color: #0f2b3d; }
          .statement-clinic p { margin: .5mm 0; color: #526579; font-size: 8pt; }
          .statement-logo { width: 18mm; height: 18mm; object-fit: contain; }
          .statement-title { text-align: right; white-space: nowrap; }
          .statement-title span { display: block; color: #0f766e; font-size: 13pt; font-weight: 900; }
          .statement-title strong { display: block; margin-top: 2mm; font-size: 8pt; color: #64748b; }
          .statement-patient-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin: 4mm 0; border: 1px solid #d9e4ea; border-radius: 2mm; overflow: hidden; }
          .statement-field { min-width: 0; padding: 2.5mm 3mm; border-right: 1px solid #e7ecf2; border-bottom: 1px solid #e7ecf2; }
          .statement-field:nth-child(3n) { border-right: 0; }
          .statement-field:nth-last-child(-n+3) { border-bottom: 0; }
          .statement-field span { display: block; margin-bottom: 1mm; color: #7b8b9b; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; }
          .statement-field strong { display: block; overflow-wrap: anywhere; font-size: 8.5pt; }
          .statement-section { margin-top: 4mm; }
          .statement-section h2 { margin: 0 0 2mm; color: #0f2b3d; font-size: 10pt; }
          .statement-chart-section { break-inside: avoid; }
          .statement-chart { height: 68mm; overflow: hidden; zoom: .7; pointer-events: none; }
          .statement-chart > div { border: 0 !important; border-radius: 0 !important; background: white !important; box-shadow: none !important; padding: 0 !important; }
          .statement-chart button { color-adjust: exact; print-color-adjust: exact; }
          .statement-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .statement-table th { padding: 2mm; border: 1px solid #d9e4ea; background: #eef7f6; color: #315164; text-align: left; font-size: 7pt; text-transform: uppercase; print-color-adjust: exact; }
          .statement-table td { padding: 2.2mm 2mm; border: 1px solid #e7ecf2; vertical-align: top; font-size: 8pt; }
          .statement-table th:nth-child(1) { width: 8%; }
          .statement-table th:nth-child(2) { width: 32%; }
          .statement-table th:nth-child(3) { width: 15%; }
          .statement-table th:nth-child(n+4) { width: 15%; }
          .statement-table tr { break-inside: avoid; }
          .statement-empty { padding: 8mm !important; text-align: center; color: #7b8b9b; }
          .statement-closed { display: inline-block; margin-left: 2mm; border: 1px solid #94a3b8; border-radius: 2mm; padding: .3mm 1.3mm; color: #64748b; font-size: 6pt; }
          .statement-discount { color: #15803d; }
          .statement-summary { display: grid; grid-template-columns: 1fr 72mm; gap: 6mm; margin-top: 4mm; break-inside: avoid; }
          .statement-note { border-left: 2px solid #5fd3c1; padding: 2mm 3mm; color: #526579; font-size: 7.5pt; line-height: 1.5; }
          .statement-note strong { color: #0f2b3d; }
          .statement-note p { margin: 1mm 0 0; }
          .statement-totals { border: 1px solid #d9e4ea; border-radius: 2mm; overflow: hidden; }
          .statement-summary-line { display: flex; justify-content: space-between; gap: 4mm; padding: 1.7mm 2.5mm; border-bottom: 1px solid #e7ecf2; font-size: 7.5pt; }
          .statement-summary-line:last-child { border-bottom: 0; }
          .statement-summary-line.is-strong { background: #eef7f6; color: #0f2b3d; font-size: 8.5pt; print-color-adjust: exact; }
          .statement-promise { display: flex; justify-content: space-between; gap: 15mm; margin-top: 10mm; color: #315164; font-size: 8pt; break-inside: avoid; }
          .statement-patient-signature { min-width: 65mm; }
          .statement-patient-signature span { display: block; margin-top: 2mm; padding-left: 24mm; color: #526579; }
          .statement-badge-paid { display: inline-block; border-radius: 99px; padding: .2mm 2mm; background: #dcfce7; color: #15803d; font-size: 7pt; font-weight: 700; print-color-adjust: exact; }
          .statement-badge-pending { display: inline-block; border-radius: 99px; padding: .2mm 2mm; background: #fef3c7; color: #b45309; font-size: 7pt; font-weight: 700; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}

function StatementField({ label, value }: { label: string; value: string }) {
  return <div className="statement-field"><span>{label}</span><strong>{value}</strong></div>
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`statement-summary-line${strong ? ' is-strong' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}
