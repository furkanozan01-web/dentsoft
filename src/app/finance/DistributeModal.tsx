'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { localDateValue, cleanMoney } from '@/lib/format'
import { distributeBranchProfit } from './actions'
import type { FinDoctor, FinDoctorShare } from './FinanceClient'

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function parseAmount(value: string) {
  const parsed = Number(cleanMoney(value))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function DistributeModal({
  branchId, branchName, shareholders, doctorMap, onClose, onSuccess,
}: {
  branchId: number
  branchName: string
  shareholders: FinDoctorShare[]
  doctorMap: Map<number, FinDoctor>
  onClose: () => void
  onSuccess: () => void
}) {
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(localDateValue())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const amount = parseAmount(amountStr)
  const preview = shareholders.map((s) => ({
    doctorId: s.doctor_id,
    name: doctorMap.get(s.doctor_id)?.name ?? `#${s.doctor_id}`,
    rateBps: s.rate_bps,
    share: Math.floor((amount * s.rate_bps) / 10000),
  }))
  const totalDistributed = preview.reduce((s, p) => s + p.share, 0)

  const submit = () => {
    setError(null)
    if (amount <= 0) { setError('Geçerli bir tutar girin'); return }
    startTransition(async () => {
      const res = await distributeBranchProfit({ branchId, amount: amountStr, date, note })
      if (res.error) { setError(res.error); toast.error(res.error); return }
      toast.success('Kâr payı dağıtıldı')
      onSuccess()
    })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-[#0F2B3D]">{branchName} — Kâr Payı Dağıt</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500">Toplam tutar (₺)
            <input data-money value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} autoFocus />
          </label>
          <label className="block text-xs font-bold text-slate-500">Tarih
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="block text-xs font-bold text-slate-500">Açıklama (opsiyonel)
            <input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
        </div>
        {amount > 0 && (
          <div className="mt-4 space-y-1.5 rounded-xl border border-[#EEF2F6] bg-[#FAFBFC] p-3">
            <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">Dağıtım Önizlemesi</p>
            {preview.map((p) => (
              <div key={p.doctorId} className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Dt. {p.name} · %{(p.rateBps / 100).toLocaleString('tr-TR')}</span>
                <span className="text-[#0F766E]">{money(p.share)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-[#E7ECF2] pt-2 text-xs font-black text-[#142536]">
              <span>Dağıtılan Toplam</span>
              <span>{money(totalDistributed)}</span>
            </div>
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">İptal</button>
          <button type="button" onClick={submit} disabled={pending || amount <= 0} className="flex-1 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-sm font-semibold text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60">{pending ? 'Dağıtılıyor…' : 'Onayla ve Dağıt'}</button>
        </div>
      </div>
    </div>
  )
}
