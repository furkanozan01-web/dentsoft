'use client'

import { useMemo, type ReactNode } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { formatAmount, formatAmountRounded, MONTHS_TR } from '@/lib/format'
import type { FinTx, FinTreatment } from './FinanceClient'

// ---- Bilgi ----
const PIE_COLORS = ['#2DD4BF', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#EC4899']

function BarTip({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const gelir = payload.find((p) => p.name === 'Gelir')?.value ?? 0
  const gider = payload.find((p) => p.name === 'Gider')?.value ?? 0
  const net = gelir - gider
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#0F2B3D] mb-1">{label}</p>
      <p className="text-[#2DD4BF]">Gelir: ₺{gelir.toLocaleString('tr-TR')}</p>
      <p className="text-red-400">Gider: ₺{gider.toLocaleString('tr-TR')}</p>
      <p className={`border-t border-gray-100 mt-1 pt-1 font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        Net Kâr: ₺{net.toLocaleString('tr-TR')}
      </p>
    </div>
  )
}

export default function BilgiTab({
  monthIncome,
  monthExpense,
  netProfit,
  totalHakedis,
  totalDebt,
  overdueDebtCount,
  monthTxs,
  patientMap,
  allTxs,
  allTreatments,
  onHakedisClick,
  onBorclarClick,
}: {
  monthIncome: number
  monthExpense: number
  netProfit: number
  totalHakedis: number
  totalDebt: number
  overdueDebtCount: number
  monthTxs: FinTx[]
  patientMap: Map<number, string>
  allTxs: FinTx[]
  allTreatments: FinTreatment[]
  onHakedisClick: () => void
  onBorclarClick: () => void
}) {
  const now = useMemo(() => new Date(), [])

  const sixMonthData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mTxs = allTxs.filter((t) => t.transaction_date?.startsWith(key))
      const gelir = mTxs.filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0) / 100
      const gider = mTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / 100
      return { ay: MONTHS_TR[d.getMonth()], Gelir: gelir, Gider: gider }
    })
  }, [allTxs, now])

  const treatmentDist = useMemo(() => {
    const m = new Map<string, number>()
    allTreatments.forEach((t) => m.set(t.treatment_name, (m.get(t.treatment_name) ?? 0) + 1))
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, value }))
  }, [allTreatments])

  const recent = monthTxs.slice(0, 10)
  const methodLabel: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale', senet: 'Senet', firma_odemesi: 'Firma', check: 'Çek', other: 'Diğer' }

  const totalTreatments = treatmentDist.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Bu Ay Gelir" value={monthIncome} description="Seçili ay toplam geliri" tone="blue" icon={<IconTrendingUp />} />
        <Kpi label="Bu Ay Gider" value={monthExpense} description="Seçili ay gider toplamı" tone="red" icon={<IconTrendingDown />} />
        <Kpi label="Net Kâr" value={netProfit} description="Gelir - gider farkı" tone="green" icon={<IconWallet />} />
        <button type="button" onClick={onHakedisClick} className="text-left cursor-pointer rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:border-violet-200 hover:shadow-[0_8px_24px_rgba(139,92,246,0.12)]">
          <Kpi label="Toplam Hakediş" value={totalHakedis} description="Hakediş sekmesine git →" tone="violet" icon={<IconReceipt />} noBorder />
        </button>
        <button type="button" onClick={onBorclarClick} className={`text-left cursor-pointer rounded-[20px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition ${overdueDebtCount > 0 ? 'border-red-200 hover:shadow-[0_8px_24px_rgba(239,68,68,0.12)]' : 'border-slate-200/90 hover:border-orange-200 hover:shadow-[0_8px_24px_rgba(234,88,12,0.12)]'}`}>
          <Kpi label="Borç Panosu" value={totalDebt} description={overdueDebtCount > 0 ? `${overdueDebtCount} vadesi geçmiş borç` : 'Borçlar sekmesine git →'} tone={overdueDebtCount > 0 ? 'red' : 'orange'} icon={<IconCreditCard />} noBorder />
        </button>
      </div>

      {/* 6 Aylık Gelir-Gider Grafiği */}
      <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon={<IconBarChart />}
            title="Son 6 Ay Gelir / Gider"
            description="Aylık gelir ve gider karşılaştırması"
            iconClassName="bg-[#E6FFFA] text-[#0F766E]"
          />
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6FFFA] px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-[#2DD4BF]" />Gelir</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-[#F87171]" />Gider</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sixMonthData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
            <XAxis dataKey="ay" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₺${Math.round(v).toLocaleString('tr-TR')}`} width={76} />
            <Tooltip content={<BarTip />} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey="Gelir" fill="#2DD4BF" radius={[10, 10, 0, 0]} maxBarSize={38} />
            <Bar dataKey="Gider" fill="#F87171" radius={[10, 10, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tedavi dağılımı — pie/doughnut */}
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <SectionTitle
            icon={<IconPie />}
            title="En Çok Uygulanan Tedaviler"
            description="Seçili dönemde en sık uygulanan işlemler"
            iconClassName="bg-[#F3E8FF] text-[#7C3AED]"
          />
          {treatmentDist.length === 0 ? (
            <EmptyCard text="Tedavi kaydı yok." />
          ) : (
            <>
              <div className="relative mt-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={treatmentDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {treatmentDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} adet`, '']}
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 12px 24px rgba(15,23,42,0.08)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-black text-[#142536]">{totalTreatments}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">Tedavi</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {treatmentDist.map((item, i) => (
                  <span key={item.name} className="inline-flex items-center gap-1.5 rounded-full border border-[#E7ECF2] bg-[#FAFBFC] px-2.5 py-1 text-xs font-bold text-slate-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Son işlemler */}
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <SectionTitle
            icon={<IconList />}
            title="Son İşlemler"
            description="Son gelir ve gider kayıtları"
            iconClassName="bg-[#FFF7E6] text-[#B45309]"
          />
          {recent.length === 0 ? (
            <EmptyCard text="Bu dönem işlem yok." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-[#FAFBFC]">
                  <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
                    <th className="px-4 text-left font-black uppercase tracking-wide">Tarih</th>
                    <th className="px-4 text-left font-black uppercase tracking-wide">Açıklama</th>
                    <th className="px-4 text-right font-black uppercase tracking-wide">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => {
                    const title = t.type === 'expense'
                      ? t.description ?? 'Gider'
                      : t.patient_id
                      ? patientMap.get(t.patient_id) ?? 'Ödeme'
                      : t.description ?? 'Ödeme'
                    const method = t.type !== 'expense' && t.method ? methodLabel[t.method] ?? t.method : null
                    return (
                      <tr key={t.id} className="h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                        <td className="px-4 font-semibold text-slate-500">
                          {new Date(t.transaction_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4">
                          <span className="font-black text-[#142536]">{title}</span>
                          {method && (
                            <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              {method}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 text-right font-black ${t.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>
                          {t.type === 'expense' ? '−' : '+'}₺{formatAmount(t.amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  description,
  tone,
  icon,
  noBorder,
}: {
  label: string
  value: number | string
  description: string
  tone: 'mint' | 'blue' | 'red' | 'green' | 'violet' | 'orange'
  icon: ReactNode
  noBorder?: boolean
}) {
  const toneClass = {
    mint: 'bg-[#E6FFFA] text-[#0F766E]',
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-[#F3E8FF] text-[#7C3AED]',
    orange: 'bg-orange-50 text-orange-600',
  }[tone]
  const valueClass = {
    mint: 'text-[#0F766E]',
    blue: 'text-[#0284C7]',
    red: 'text-red-600',
    green: 'text-green-600',
    violet: 'text-[#7C3AED]',
    orange: 'text-orange-600',
  }[tone]

  const inner = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
        <span className="rounded-full bg-[#FAFBFC] px-2.5 py-1 text-[10px] font-black text-slate-400">Dönem</span>
      </div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{typeof value === 'number' ? `₺${formatAmountRounded(value)}` : value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>
    </>
  )

  if (noBorder) return <div className="min-h-[120px]">{inner}</div>
  return (
    <div className="min-h-[120px] rounded-[22px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.07)]">
      {inner}
    </div>
  )
}

function SectionTitle({
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

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  )
}


function IconTrendingUp() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m23 6-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>
}

function IconTrendingDown() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m23 18-9.5-9.5-5 5L1 6" /><path d="M17 18h6v-6" /></svg>
}

function IconWallet() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" /><path d="M16 12h6v5h-6a2.5 2.5 0 0 1 0-5z" /></svg>
}

function IconReceipt() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2v20l3-2 3 2 3-2 3 2 4-2V2z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></svg>
}

function IconBarChart() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-3" /></svg>
}

function IconPie() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M12 3a9 9 0 0 1 9 9h-9z" /></svg>
}

function IconList() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
}

function IconCreditCard() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
}

