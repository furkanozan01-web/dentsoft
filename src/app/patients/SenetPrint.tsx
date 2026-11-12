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

/** Klinik adresinin sonundaki "İlçe / İl" bölümünden yer adı (yoksa son kelime) */
function placeFromAddress(address?: string | null): string {
  const a = (address ?? '').trim().replace(/[\s.,;]+$/, '')
  if (!a) return ''
  const m = a.match(/([\p{L}]+(?:\s[\p{L}]+)?)\s*\/\s*([\p{L}]+)\s*$/u)
  if (m) return `${m[1]} / ${m[2]}`
  return a.split(/[\s,]+/).pop() ?? ''
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
  }, [patient])

  const issueDate = new Date().toISOString().slice(0, 10)
  const place = placeFromAddress(clinic?.address)
  const creditor = clinic?.clinic_name || 'DentSoft Kliniği'

  return (
    <>
      <div id={`senet-print-${patient.id}`} className="senet-print" aria-hidden="true">
        {rows.map((row, i) => {
          const lira = Math.floor(row.amount / 100)
          const kurus = row.amount % 100
          return (
            <article key={i} className="senet-block">
              <div className="sn-top">
                <div><b>Ödeme tarihi</b><span>{formatDate(row.dueDate)}</span></div>
                <div><b>Türk Lirası</b><span>{lira.toLocaleString('tr-TR')}</span></div>
                <div><b>Kuruş</b><span>{String(kurus).padStart(2, '0')}</span></div>
                <div><b>No</b><span>{i + 1}/{rows.length}</span></div>
              </div>
              <div className="sn-h"><h3>BONO</h3><span className="sn-plan">{title}</span><span className="nama">NAMA YAZILIDIR</span></div>
              <p className="sn-text">
                İşbu nama muharrer bonomun mukabilinde <b>{formatDate(row.dueDate)}</b> tarihinde Sayın <b>{creditor}</b> yetkilisine
                veya emrivakiine yukarıda yazılı yalnız <b>#{amountToTurkishWords(row.amount)}#</b> (₺{formatAmount(row.amount)}) kayıtsız
                ve şartsız ödeyeceğim. İşbu bono emre değildir; ciro yoluyla başkasına devredilemez.
              </p>
              <div className="sn-ln">
                <span>Ödeme yeri: <b>{place || '—'}</b></span>
                <span>Düzenleme yeri: <b>{place || '—'}</b></span>
                <span>Düzenleme tarihi: <b>{formatDate(issueDate)}</b></span>
              </div>
              <div className="sn-parties">
                <div>
                  <div className="hd">Borçlu</div>
                  Ad soyad: <b>{patient.name} {patient.surname}</b><br />
                  T.C. no: {tc || '—'} · Tel: {patient.phone1 || '—'}<br />
                  Adres: {patient.address || '—'}<br />
                  İmza:
                </div>
                <div>
                  <div className="hd">Aval veren <span className="kn">(düzenleyen lehine aval içindir)</span></div>
                  Ad soyad:<br />
                  T.C. no: &nbsp; Tel:<br />
                  Adres:<br />
                  İmza:
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <style jsx global>{`
        .senet-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 8mm 10mm; }
          html[data-print-target="senet"] body * { visibility: hidden !important; }
          html[data-print-target="senet"] .senet-print,
          html[data-print-target="senet"] .senet-print * { visibility: visible !important; }
          html[data-print-target="senet"] .senet-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 190mm;
            color: #111c22;
            background: white;
            font-family: "Segoe UI", Arial, sans-serif;
            font-size: 7.6pt;
            line-height: 1.3;
          }
          .senet-block {
            box-sizing: border-box;
            height: 66mm;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1pt solid #111c22;
            padding: 2.2mm 4mm;
            margin-bottom: 3mm;
          }
          .senet-block:nth-child(4n) { break-after: page; page-break-after: always; margin-bottom: 0; }
          .senet-block .sn-top { display: grid; grid-template-columns: 1.3fr 1.5fr .7fr .8fr; border: .7pt solid #111c22; margin-bottom: 1.6mm; }
          .senet-block .sn-top > div { padding: .3mm 1.2mm; border-right: .7pt solid #111c22; text-align: center; }
          .senet-block .sn-top > div:last-child { border-right: 0; }
          .senet-block .sn-top b { display: block; font-size: 5.8pt; text-transform: uppercase; letter-spacing: .05em; color: #4a5a62; font-weight: 600; }
          .senet-block .sn-top span { font-size: 8.6pt; font-weight: 500; }
          .senet-block .sn-h { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .8mm; }
          .senet-block .sn-h h3 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; letter-spacing: .06em; }
          .senet-block .sn-plan { font-size: 6.6pt; color: #4a5a62; }
          .senet-block .nama { font-size: 6pt; font-weight: 700; letter-spacing: .1em; border: .7pt solid #111c22; padding: .2mm 1.6mm; }
          .senet-block .sn-text { margin: 0 0 1.2mm; text-align: justify; line-height: 1.38; }
          .senet-block .sn-ln { display: flex; justify-content: space-between; gap: 3mm; margin-bottom: 1.4mm; }
          .senet-block .sn-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 2.6mm; }
          .senet-block .sn-parties > div { border: .5pt solid #9fb0b6; padding: .8mm 2mm; font-size: 7pt; line-height: 1.5; height: 19mm; overflow: hidden; }
          .senet-block .sn-parties .hd { font-weight: 700; text-transform: uppercase; letter-spacing: .05em; font-size: 6.2pt; }
          .senet-block .sn-parties .kn { font-weight: 400; text-transform: none; letter-spacing: 0; color: #4a5a62; }
        }
      `}</style>
    </>
  )
}
