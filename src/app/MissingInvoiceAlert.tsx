'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconFileText } from '@/components/icons'

export interface MissingInvoiceRow {
  id: number
  patient_id: number | null
  patient_name: string
  amount: number
  transaction_date: string
}

function fmt(kurus: number) {
  return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
}

/** "Fatura kontrolü" uyarısı: tıklanınca mini pencerede faturası eksik ödemeleri listeler; hasta adı hastanın fatura sekmesine gider. */
export default function MissingInvoiceAlert({ count, rows }: { count: number; rows: MissingInvoiceRow[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-[#EEF2F6] bg-white px-4 py-3 text-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:grid-cols-[auto_1fr_auto_auto]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IconFileText /></span>
          <div className="min-w-0">
            <p className="font-bold text-[#0F2B3D]">Fatura kontrolü</p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500">{count} ödeme için fatura bilgisi eksik görünüyor.</p>
          </div>
          <span className="col-start-2 w-fit shrink-0 rounded-full bg-[#FFF3D8] px-2.5 py-1 text-[11px] font-bold text-[#B76B00] sm:col-start-auto">Fatura</span>
          <span className="hidden text-slate-300 sm:block" aria-hidden="true">›</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div role="dialog" aria-modal="true" aria-label="Faturası eksik ödemeler" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F2B3D]">Faturası eksik ödemeler</h3>
                <p className="mt-0.5 text-xs text-gray-400">Hasta adına tıklayarak fatura penceresini açın.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 text-lg leading-none text-gray-400 hover:text-gray-600" aria-label="Kapat">×</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">Liste yüklenemedi.</p>
              ) : rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-gray-50 px-5 py-3 last:border-0">
                  <div className="min-w-0">
                    {r.patient_id ? (
                      <Link href={`/patients?patient_id=${r.patient_id}&tab=fatura`} className="block truncate text-sm font-semibold text-[#0D9488] hover:underline">{r.patient_name}</Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-gray-500">{r.patient_name}</span>
                    )}
                    <p className="text-xs text-gray-400">{new Date(r.transaction_date).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#0F2B3D]">₺{fmt(r.amount)}</span>
                </div>
              ))}
            </div>
            {count > rows.length && (
              <p className="border-t border-gray-100 px-5 py-2.5 text-center text-xs text-gray-400">
                İlk {rows.length} kayıt gösteriliyor · toplam {count}. Tamamı için <Link href="/finance?tab=defter" className="font-semibold text-[#0D9488] hover:underline">Defter</Link>.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
