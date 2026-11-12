'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { localDateValue, cleanMoney } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { distributeBranchProfit } from './actions'
import type { FinBranch, FinDoctor, FinDoctorShare, FinTx } from './FinanceClient'

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function dateText(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR')
}
function parseAmount(value: string) {
  const parsed = Number(cleanMoney(value))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export default function KasaDashboard({
  branches, txs, totals, doctorShares, doctors, onChanged,
}: {
  branches: FinBranch[]
  txs: FinTx[]
  /** Şube → tüm zamanlar gelir/gider toplamı (finance_totals RPC'si; satır sınırından bağımsız). */
  totals: Record<string, { income: number; expense: number }>
  doctorShares: FinDoctorShare[]
  doctors: FinDoctor[]
  onChanged: () => void
}) {
  const defaultBranchId = branches.find((b) => b.is_default)?.id ?? branches[0]?.id ?? null
  const [persistedBranchId, setPersistedBranchId] = usePersistedPreference<number | null>('dentsoft:last-branch-filter-kasa', defaultBranchId)
  const branchId = persistedBranchId !== null && branches.some((b) => b.id === persistedBranchId) ? persistedBranchId : defaultBranchId
  const [showPay, setShowPay] = useState(false)

  const branchTxs = useMemo(() => txs.filter((t) => t.branch_id === branchId), [txs, branchId])
  const income = branchId !== null ? totals[branchId]?.income ?? 0 : 0
  const expense = branchId !== null ? totals[branchId]?.expense ?? 0 : 0
  const balance = income - expense
  const recentTxs = useMemo(() => [...branchTxs].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).slice(0, 20), [branchTxs])

  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors])
  const today = localDateValue()
  const shareholders = useMemo(
    () => doctorShares.filter((s) =>
      s.branch_id === branchId && s.is_active &&
      (!s.start_date || s.start_date <= today) && (!s.end_date || s.end_date >= today)
    ),
    [doctorShares, branchId, today]
  )

  if (branches.length === 0) {
    return <div className="rounded-[24px] border border-slate-200/90 bg-white p-8 text-center text-sm font-bold text-slate-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">Henüz şube tanımlanmadı. Ayarlar &gt; Klinik&apos;ten şube ekleyin.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Şube</span>
          <select
            value={branchId ?? ''}
            onChange={(e) => setPersistedBranchId(Number(e.target.value))}
            className="h-11 rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-sm font-bold text-[#0F2B3D] outline-none focus:border-[#2DD4BF]"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowPay(true)}
          disabled={shareholders.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          title={shareholders.length === 0 ? 'Bu şubede aktif hissedar yok' : undefined}
        >
          Kâr Payı Öde
        </button>
      </div>

      <div className="rounded-[24px] border border-slate-200/90 bg-white p-8 text-center shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Kasa Bakiyesi (Kümülatif)</p>
        <p className={`mt-2 text-4xl font-black ${balance >= 0 ? 'text-[#0F766E]' : 'text-red-600'}`}>{money(balance)}</p>
        <div className="mt-4 flex justify-center gap-6 text-sm font-bold">
          <span className="text-emerald-600">Toplam Gelir: {money(income)}</span>
          <span className="text-red-500">Toplam Gider: {money(expense)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#EEF2F6] px-6 py-5">
            <h2 className="text-base font-black text-[#142536]">Son Hareketler</h2>
            <p className="mt-1 text-sm font-medium text-slate-400">Bu şubeye ait son 13 aydan en yeni 20 kayıt (bakiye tüm zamanları kapsar)</p>
          </div>
          {recentTxs.length === 0 ? (
            <div className="p-8 text-center text-sm font-bold text-slate-400">Bu şubede henüz hareket yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[#FAFBFC]">
                  <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Tarih</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Açıklama</th>
                    <th className="px-5 text-right text-xs font-black uppercase tracking-wide">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxs.map((t) => (
                    <tr key={t.id} className="h-14 border-b border-[#EEF2F6] last:border-0">
                      <td className="px-5 text-slate-500">{dateText(t.transaction_date)}</td>
                      <td className="px-5 font-bold text-[#142536]">{t.description || t.category || '—'}</td>
                      <td className={`px-5 text-right font-black ${t.type === 'payment' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'payment' ? '+' : '-'}{money(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <h3 className="text-base font-black text-[#142536]">Hissedarlar</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Bu şubedeki aktif hisse sahipleri</p>
          {shareholders.length === 0 ? (
            <p className="mt-4 text-xs font-bold text-slate-400">Bu şubede aktif hissedar yok. Ayarlar &gt; Diş Hekimi&apos;nden ekleyin.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {shareholders.map((s) => {
                const doctor = doctorMap.get(s.doctor_id)
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2.5">
                    <span className="truncate text-sm font-black text-[#142536]">Dt. {doctor?.name ?? `#${s.doctor_id}`}</span>
                    <span className="shrink-0 text-sm font-black text-[#0F766E]">%{(s.rate_bps / 100).toLocaleString('tr-TR')}</span>
                  </div>
                )
              })}
            </div>
          )}
        </aside>
      </div>

      {showPay && branchId !== null && (
        <DistributeModal
          branchId={branchId}
          branchName={branches.find((b) => b.id === branchId)?.name ?? ''}
          shareholders={shareholders}
          doctorMap={doctorMap}
          onClose={() => setShowPay(false)}
          onSuccess={() => { setShowPay(false); onChanged() }}
        />
      )}
    </div>
  )
}

function DistributeModal({
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
          <h2 className="text-sm font-black text-[#0F2B3D]">{branchName} — Kâr Payı Öde</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500">Toplam tutar (₺)
            <input value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} autoFocus />
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
