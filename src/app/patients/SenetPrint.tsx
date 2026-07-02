'use client'

import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/format'
import { amountToTurkishWords } from '@/lib/turkishNumbers'
import { getPatientTc } from './actions'
import { triggerPrint } from './printTarget'
import type { ClinicInfo, Patient } from './types'

export interface SenetRow {
  dueDate: string
  amount: number
}

interface SenetPrintProps {
  patient: Patient
  clinic: ClinicInfo | null
  title: string
  rows: SenetRow[]
}

export function printSenetPlan(patientId: number): boolean {
  return triggerPrint(`senet-print-${patientId}`, 'senet')
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR')
}

export default function SenetPrint({ patient, clinic, title, rows }: SenetPrintProps) {
  const [tc, setTc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getPatientTc(patient.id).then((res) => {
      if (active) setTc(res.tc ?? null)
    })
    return () => {
      active = false
    }
  }, [patient.id])

  const issueDate = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div id={`senet-print-${patient.id}`} className="senet-print" aria-hidden="true">
        {rows.map((row, i) => (
          <article key={i} className="senet-block">
            <header className="senet-header">
              <span>SENET</span>
              <strong>Senet No: {i + 1}/{rows.length}</strong>
            </header>

            <p className="senet-amount">
              ₺{formatAmount(row.amount)}
              <span>({amountToTurkishWords(row.amount)})</span>
            </p>

            <p className="senet-body">
              İşbu senet karşılığında yukarıda yazılı <strong>{amountToTurkishWords(row.amount)}</strong> ({'₺'}
              {formatAmount(row.amount)}) tutarındaki borcumu, vadesinde, {clinic?.clinic_name || 'klinik'} yetkilisine
              veya emrivakiine, hiçbir itiraz ileri sürmeksizin nakden ve defaten ödemeyi kabul ve taahhüt ederim.
            </p>

            <section className="senet-grid">
              <div>
                <span>Düzenleme Tarihi</span>
                <strong>{formatDate(issueDate)}</strong>
              </div>
              <div>
                <span>Vade Tarihi</span>
                <strong>{formatDate(row.dueDate)}</strong>
              </div>
              <div>
                <span>Plan</span>
                <strong>{title}</strong>
              </div>
            </section>

            <section className="senet-parties">
              <div>
                <h3>Alacaklı</h3>
                <p>{clinic?.clinic_name || 'DentSoft Kliniği'}</p>
                <p>{clinic?.address || '—'}</p>
                <p>{[clinic?.phone, clinic?.email].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <div>
                <h3>Borçlu</h3>
                <p>{patient.name} {patient.surname}</p>
                <p>{patient.address || '—'}</p>
                <p>T.C. Kimlik No: {tc || '—'}</p>
                <p>{patient.phone1 || '—'}</p>
              </div>
            </section>

            <footer className="senet-signature">
              <div><strong>Borçlu İmzası</strong><span>{patient.name} {patient.surname}</span></div>
              <div><strong>Yetkili İmzası</strong><span>{clinic?.clinic_name || '—'}</span></div>
            </footer>
          </article>
        ))}
      </div>

      <style jsx global>{`
        .senet-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html[data-print-target="senet"] body * { visibility: hidden !important; }
          html[data-print-target="senet"] .senet-print,
          html[data-print-target="senet"] .senet-print * { visibility: visible !important; }
          html[data-print-target="senet"] .senet-print {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 190mm;
            color: #142536;
            background: white;
            font-family: Arial, sans-serif;
            font-size: 9pt;
          }
          .senet-block {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1.5px solid #0f766e;
            border-radius: 3mm;
            padding: 6mm;
            margin-bottom: 6mm;
          }
          .senet-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d9e4ea; padding-bottom: 3mm; margin-bottom: 4mm; }
          .senet-header span { font-size: 14pt; font-weight: 900; color: #0f766e; letter-spacing: 2px; }
          .senet-header strong { font-size: 9pt; color: #526579; }
          .senet-amount { margin: 0 0 4mm; font-size: 15pt; font-weight: 900; color: #0f2b3d; }
          .senet-amount span { margin-left: 3mm; font-size: 9pt; font-weight: 700; color: #526579; }
          .senet-body { margin: 0 0 4mm; line-height: 1.6; font-size: 8.5pt; text-align: justify; }
          .senet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 4mm; border: 1px solid #e7ecf2; border-radius: 2mm; padding: 3mm; }
          .senet-grid span { display: block; margin-bottom: 1mm; color: #7b8b9b; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; }
          .senet-grid strong { font-size: 8.5pt; }
          .senet-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 6mm; }
          .senet-parties h3 { margin: 0 0 1.5mm; font-size: 7.5pt; color: #0f766e; text-transform: uppercase; }
          .senet-parties p { margin: 0.5mm 0; font-size: 8pt; color: #315164; }
          .senet-signature { display: flex; justify-content: space-between; gap: 10mm; }
          .senet-signature div { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 2mm; }
          .senet-signature strong { display: block; font-size: 7.5pt; color: #526579; }
          .senet-signature span { display: block; margin-top: 1mm; font-size: 8pt; }
        }
      `}</style>
    </>
  )
}
