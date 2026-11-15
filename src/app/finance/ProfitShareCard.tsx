'use client'

import { useMemo, useState } from 'react'
import { localDateValue } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { DistributeModal } from './KasaDashboard'
import type { DoctorPayment, FinBranch, FinDoctor, FinDoctorShare } from './FinanceClient'

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function dateText(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR')
}

/**
 * Hakediş sekmesi — "Kâr Payı Dağıtımı" kutusu.
 * Şube seçilir; o şubenin hissedarları ve oranları görünür; girilen tutar oranlara göre hissedarlara dağıtılır
 * (Kasa sekmesindeki "Kâr Payı Öde" ile aynı işlem). Dağıtımlar hakediş alacağına sayılmaz.
 */
export default function ProfitShareCard({
  branches, doctors, doctorShares, payments, profitByMonth, monthKey, onChanged,
}: {
  branches: FinBranch[]
  doctors: FinDoctor[]
  doctorShares: FinDoctorShare[]
  payments: DoctorPayment[]
  profitByMonth: Record<string, number>
  monthKey: string
  onChanged: () => void
}) {
  const defaultBranchId = branches.find((b) => b.is_default)?.id ?? branches[0]?.id ?? null
  const [persistedBranchId, setPersistedBranchId] = usePersistedPreference<number | null>('dentsoft:last-branch-filter-karpayi', defaultBranchId)
  const branchId = persistedBranchId !== null && branches.some((b) => b.id === persistedBranchId) ? persistedBranchId : defaultBranchId
  const [showPay, setShowPay] = useState(false)
  const today = localDateValue()

  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors])
  const shareholders = useMemo(
    () => doctorShares.filter((s) =>
      s.branch_id === branchId && s.is_active &&
      (!s.start_date || s.start_date <= today) && (!s.end_date || s.end_date >= today)
    ),
    [doctorShares, branchId, today]
  )
  const shareholderIds = useMemo(() => new Set(shareholders.map((s) => s.doctor_id)), [shareholders])
  const history = useMemo(
    () => payments.filter((p) => p.payment_type === 'kar_payi' && shareholderIds.has(p.doctor_id)).slice(0, 10),
    [payments, shareholderIds]
  )
  const monthProfit = branchId !== null ? profitByMonth[`${branchId}:${monthKey}`] ?? 0 : 0

  if (branches.length === 0) return null

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-[#142536]">Kâr Payı Dağıtımı</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Şubenin hissedarlarına, hisse oranlarına göre kâr payı dağıtılır. Kâr payı, hakediş alacağından ayrıdır.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={branchId ?? ''}
            onChange={(e) => setPersistedBranchId(Number(e.target.value))}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowPay(true)}
            disabled={shareholders.length === 0}
            title={shareholders.length === 0 ? 'Bu şubede aktif hissedar yok' : undefined}
            className="h-10 rounded-xl bg-[#1EAEA0] px-4 text-xs font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kâr Payı Dağıt
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Hissedarlar</p>
          {shareholders.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">Bu şubede aktif hissedar yok. Ayarlar → Klinik bölümünden hissedar ekleyin.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {shareholders.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2.5">
                  <span className="truncate text-sm font-black text-[#142536]">Dt. {doctorMap.get(s.doctor_id)?.name ?? `#${s.doctor_id}`}</span>
                  <span className="shrink-0 text-sm font-black text-[#0F766E]">%{(s.rate_bps / 100).toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] font-semibold text-slate-400">Bu ay şube net kârı: <span className={`font-black ${monthProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(monthProfit)}</span></p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Son Dağıtımlar</p>
          {history.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">Bu şubede henüz kâr payı dağıtılmadı.</p>
          ) : (
            <table className="mt-3 w-full text-xs">
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2 font-semibold text-slate-500">{dateText(p.payment_date)}</td>
                    <td className="py-2 font-bold text-slate-700">Dt. {doctorMap.get(p.doctor_id)?.name ?? `#${p.doctor_id}`}</td>
                    <td className="py-2 text-right font-black text-red-600">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
    </section>
  )
}
