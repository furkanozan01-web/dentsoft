'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createPromissoryPlan } from './actions'
import { formatAmount } from '@/lib/format'
import SenetPrint, { printSenetPlan, type SenetRow } from './SenetPrint'
import type { ClinicInfo, Patient } from './types'
import { SectionHeader, IconPrint } from './accountShared'

// ---- Senet Robotu kartı ----
// Kurallar: taksit tutarları tam bin TL'ye aşağı yuvarlanır, biriken küsürat
// son taksite eklenir; vade farkı taksit sayısı kadar bileşikleşir.
export function buildInstallmentPreview(
  principalKurus: number,
  months: number,
  interestRate: number,
  startDate: Date
): SenetRow[] {
  const compoundTotal = Math.round(principalKurus * Math.pow(1 + interestRate / 100, months))
  const THOUSAND = 100_000 // 1.000 TL = 100.000 kuruş
  const base = Math.floor(compoundTotal / months / THOUSAND) * THOUSAND
  const shortfall = compoundTotal - base * months
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + i + 1)
    return {
      dueDate: d.toISOString().slice(0, 10),
      amount: base + (i === months - 1 ? shortfall : 0),
    }
  })
}
export function SenetRobotuCard({
  patientId,
  patient,
  clinic,
  balance,
  onChanged,
}: {
  patientId: number
  patient: Patient
  clinic: ClinicInfo | null
  balance: number
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [senetTitle, setSenetTitle] = useState('Senet Planı')
  const [senetMonths, setSenetMonths] = useState('3')
  const [senetRate, setSenetRate] = useState('0')
  const [senetPrincipal, setSenetPrincipal] = useState(() =>
    balance > 0 ? String(Math.round(balance / 100)) : ''
  )

  const senetPreview = (() => {
    const principal = parseFloat(senetPrincipal) * 100
    const months = parseInt(senetMonths, 10)
    const rate = parseFloat(senetRate)
    if (isNaN(principal) || isNaN(months) || isNaN(rate) || principal <= 0 || months < 1) return []
    return buildInstallmentPreview(principal, months, rate, new Date())
  })()

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handleSenet = () => {
    if (!senetPreview.length) {
      toast.error('Lütfen geçerli tutar, taksit sayısı ve oran girin')
      return
    }
    const rateBps = Math.round(parseFloat(senetRate) * 100)
    const rows = senetPreview.map((r) => ({ due_date: r.dueDate, amount: r.amount }))
    run(() => createPromissoryPlan(patientId, senetTitle, rateBps, rows))
  }

  const handlePrint = () => {
    if (!senetPreview.length) {
      toast.error('Önce geçerli bir senet planı oluşturun')
      return
    }
    if (!printSenetPlan(patient.id)) toast.error('Yazdırma alanı hazırlanamadı')
  }

  return (
    <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <SectionHeader
        icon={<IconRobot />}
        title="Senet Robotu"
        description="TC kanunlarına uygun, imzaya hazır senet planı oluşturun"
        iconClassName="bg-[#F3E8FF] text-[#7C3AED]"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Başlık</label>
          <input
            type="text"
            value={senetTitle}
            onChange={(e) => setSenetTitle(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Tutar (₺)</label>
          <input
            type="number"
            min={1}
            value={senetPrincipal}
            onChange={(e) => setSenetPrincipal(e.target.value)}
            placeholder="0"
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Taksit Sayısı</label>
          <input
            type="number"
            min={1}
            max={60}
            value={senetMonths}
            onChange={(e) => setSenetMonths(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Vade Farkı (% — bileşik)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={senetRate}
            onChange={(e) => setSenetRate(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
      </div>

      {senetPreview.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Önizleme (her taksit tam bin TL, küsürat son taksite eklenir)</p>
          <div className="overflow-x-auto rounded-[12px] border border-[#E9D5FF]">
            <table className="w-full min-w-[360px] text-xs">
              <thead className="bg-[#F3E8FF]">
                <tr className="h-9">
                  <th className="px-3 text-left font-black text-[#6D28D9]">#</th>
                  <th className="px-3 text-left font-black text-[#6D28D9]">Vade Tarihi</th>
                  <th className="px-3 text-left font-black text-[#6D28D9]">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {senetPreview.map((row, i) => (
                  <tr key={i} className="h-10 border-t border-[#E9D5FF]">
                    <td className="px-3 font-black text-[#142536]">{i + 1}</td>
                    <td className="px-3 text-slate-600">
                      {new Date(row.dueDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-3 font-black text-[#0F2B3D]">₺{formatAmount(row.amount)}</td>
                  </tr>
                ))}
                <tr className="h-10 border-t-2 border-[#C4B5FD] bg-[#F3E8FF]">
                  <td className="px-3 font-black text-[#6D28D9]" colSpan={2}>Toplam</td>
                  <td className="px-3 font-black text-[#6D28D9]">
                    ₺{formatAmount(senetPreview.reduce((s, r) => s + r.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSenet}
          disabled={pending || !senetPreview.length}
          className="rounded-[12px] bg-[#7C3AED] px-5 py-2 text-xs font-black text-white hover:bg-[#6D28D9] disabled:opacity-50"
        >
          Planı Oluştur
        </button>
        <button
          onClick={handlePrint}
          disabled={!senetPreview.length}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#E9D5FF] bg-white px-4 py-2 text-xs font-black text-[#7C3AED] hover:bg-[#FAF5FF] disabled:opacity-50"
        >
          <IconPrint />
          Yazdır
        </button>
      </div>

      <SenetPrint patient={patient} clinic={clinic} title={senetTitle} rows={senetPreview} />
    </section>
  )
}
export function IconRobot() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M12 11V7" /><circle cx="12" cy="5" r="2" /><path d="M7 15h.01M17 15h.01" /><path d="M9 19h6" /></svg>
}
