'use client'

import { formatAmount } from '@/lib/format'
import { triggerPrint } from './printTarget'
import type { ClinicInfo, Patient, Transaction } from './types'

interface PaymentHistoryPrintProps {
  patient: Patient
  clinic: ClinicInfo | null
  transactions: Transaction[]
}

export function printPaymentHistory(patientId: number): boolean {
  return triggerPrint(`payment-history-print-${patientId}`, 'payments')
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  firma_odemesi: 'Firma',
  other: 'Diğer',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR')
}

export default function PaymentHistoryPrint({ patient, clinic, transactions }: PaymentHistoryPrintProps) {
  const payments = transactions.filter((t) => t.type === 'payment')
  const total = payments.reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <div id={`payment-history-print-${patient.id}`} className="payment-history-print" aria-hidden="true">
        <header className="ph-header">
          <div>
            <h1>{clinic?.clinic_name || 'DentSoft Kliniği'}</h1>
            <p>{clinic?.address || 'Adres bilgisi tanımlanmamış'}</p>
          </div>
          <div className="ph-title">
            <span>ÖDEME GEÇMİŞİ</span>
            <strong>Tarih: {formatDate(new Date().toISOString())}</strong>
          </div>
        </header>

        <section className="ph-patient">
          <strong>{patient.name} {patient.surname}</strong>
          {patient.protocol_no && <span> · Protokol No: {patient.protocol_no}</span>}
        </section>

        <table className="ph-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tutar</th>
              <th>Yöntem</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={4} className="ph-empty">Ödeme kaydı bulunmuyor.</td></tr>
            ) : payments.map((tx) => (
              <tr key={tx.id}>
                <td>{formatDate(tx.transaction_date)}</td>
                <td><strong>₺{formatAmount(tx.amount)}</strong></td>
                <td>{METHOD_LABEL[tx.method ?? ''] ?? tx.method ?? '—'}</td>
                <td>{tx.description || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={1}><strong>Toplam</strong></td>
              <td colSpan={3}><strong>₺{formatAmount(total)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style jsx global>{`
        .payment-history-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html[data-print-target="payments"] body * { visibility: hidden !important; }
          html[data-print-target="payments"] .payment-history-print,
          html[data-print-target="payments"] .payment-history-print * { visibility: visible !important; }
          html[data-print-target="payments"] .payment-history-print {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 190mm;
            color: #142536;
            background: white;
            font-family: Arial, sans-serif;
            font-size: 9pt;
          }
          .ph-header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 2px solid #0f766e; padding-bottom: 4mm; }
          .ph-header h1 { margin: 0 0 1mm; font-size: 14pt; color: #0f2b3d; }
          .ph-header p { margin: 0; color: #526579; font-size: 8pt; }
          .ph-title { text-align: right; white-space: nowrap; }
          .ph-title span { display: block; color: #0f766e; font-size: 12pt; font-weight: 900; }
          .ph-title strong { display: block; margin-top: 2mm; font-size: 8pt; color: #64748b; }
          .ph-patient { margin: 4mm 0; font-size: 9pt; color: #315164; }
          .ph-table { width: 100%; border-collapse: collapse; }
          .ph-table th { padding: 2mm; border: 1px solid #d9e4ea; background: #eef7f6; color: #315164; text-align: left; font-size: 7pt; text-transform: uppercase; print-color-adjust: exact; }
          .ph-table td { padding: 2.2mm 2mm; border: 1px solid #e7ecf2; font-size: 8pt; }
          .ph-table tr { break-inside: avoid; }
          .ph-table tfoot td { border-top: 2px solid #0f766e; background: #eef7f6; print-color-adjust: exact; }
          .ph-empty { padding: 8mm !important; text-align: center; color: #7b8b9b; }
        }
      `}</style>
    </>
  )
}
