'use client'

import { useState, useMemo, useEffect, useActionState, useTransition, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { localDateValue } from '@/lib/format'
import { computeSummary } from '@/lib/finance/hakedis'
import LedgerDashboard from './LedgerDashboard'
import BalanceDashboard from './BalanceDashboard'
import EarningsDashboard from './EarningsDashboard'
import PartnersDashboard from './PartnersDashboard'
import {
  addExpense,
  deleteTransaction,
  addDoctorPayment,
  deleteDoctorPayment,
  addBusinessPartner,
  updateBusinessPartner,
  deleteBusinessPartner,
  addClinicDebt,
  updateClinicDebt,
  payClinicDebt,
  deleteClinicDebt,
} from './actions'

export interface FinTx {
  id: number
  transaction_date: string
  amount: number
  method: string | null
  type: string
  description: string | null
  patient_id: number | null
  category: string | null
  invoice_no: string | null
  recurring: string | null
  partner_id: number | null
  treatment_id: number | null
  doctor_id: number | null
  account_name: string | null
  invoice_status: string | null
  payment_status: string | null
  source_type: string | null
  partner_service_id: number | null
  branch_id: number | null
  original_currency: string | null
  original_amount: number | null
  exchange_rate: number | null
}
export interface FinTreatment {
  id: number
  treatment_date: string | null
  fee: number
  cost: number
  doctor_id: number | null
  status: string
  treatment_name: string
  patient_id: number | null
}
export interface FinDoctor {
  id: number
  name: string
  color: string | null
  commission_rate_bps: number | null
  payment_model: string | null // salary | commission | hybrid | null
  monthly_salary: number | null // kuruş
  is_mesul_mudur: boolean
  specialty: string | null
  guarantee_amount: number | null
  bonus_amount: number | null
  per_transaction_amount: number | null
  salary_day: number | null
  payment_account: string | null
  guarantee_active: boolean
  guarantee_period: string
  guarantee_method: string
  guarantee_note: string | null
  share_active: boolean
  share_rate_bps: number
  share_start_date: string | null
  share_end_date: string | null
  share_branch_id: number | null
  share_period: string
  share_note: string | null
  profit_distribution_type: string
}
export interface ClinicDebt {
  id: number
  title: string
  total_amount: number
  paid_amount: number
  due_date: string | null
  recurrence: string
  notes: string | null
  status: string
  created_at: string
  payment_day: number | null
  payment_method: string | null
  account_name: string | null
  last_paid_at: string | null
}
export interface FinPatient {
  id: number
  name: string
  surname: string
  created_at: string
}
export interface FinInstallment {
  id: number
  patient_id: number | null
  due_date: string
  amount: number
  paid: boolean
}
export interface FinBusinessPartner {
  id: number
  name: string
  partner_type: string
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  address: string | null
  tax_info: string | null
  bank_info: string | null
}
export interface PartnerService {
  id: number
  partner_id: number
  service_name: string
  patient_id: number | null
  doctor_id: number | null
  service_date: string
  due_date: string | null
  amount: number
  vat_status: string
  invoice_status: string
  payment_status: string
  description: string | null
  attachment_url: string | null
}
export interface DoctorPayment {
  id: number
  doctor_id: number
  amount: number
  payment_type: string
  method: string | null
  payment_date: string
  note: string | null
  transaction_id: number | null
  account_name: string | null
  created_by: string | null
  created_by_name?: string | null
  earning_period: string | null
}

const PAYTYPE_LABEL: Record<string, string> = {
  maas: 'Maaş',
  ara_odeme: 'Ara ödeme',
  mahsuplasma: 'Ay sonu mahsuplaşma',
  avans: 'Avans',
  prim: 'Prim',
  duzeltme: 'Düzeltme',
}
const PAYMENT_MODEL_LABEL: Record<string, string> = {
  salary: 'Sabit Maaş',
  commission: 'Komisyon',
  hybrid: 'Sabit + Komisyon',
  guarantee: 'Garantör Sistem',
  bonus: 'Prim Bazlı',
  per_transaction: 'İşlem Bazlı',
  revenue: 'Ciro Bazlı',
}

type Tab = 'bilgi' | 'defter' | 'bakiye' | 'hakedis' | 'borclar' | 'ortaklar'
const TABS: { id: Tab; label: string }[] = [
  { id: 'bilgi', label: 'Bilgi' },
  { id: 'defter', label: 'Defter' },
  { id: 'bakiye', label: 'Bakiye' },
  { id: 'hakedis', label: 'Hakediş' },
  { id: 'borclar', label: 'Borçlar' },
  { id: 'ortaklar', label: 'İş Ortaklarımız' },
]
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

function fmt(k: number): string {
  return (k / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmt0(k: number): string {
  return Math.round(k / 100).toLocaleString('tr-TR')
}

export default function FinanceClient({
  txs,
  treatments,
  doctors,
  patients,
  doctorPayments,
  installments,
  businessPartners: initialPartners,
  clinicDebts: initialDebts,
  isAdmin,
  currentDoctorId,
  isMesulMudur,
  clinicName,
  partnerServices,
  profitByMonth,
}: {
  txs: FinTx[]
  treatments: FinTreatment[]
  doctors: FinDoctor[]
  patients: FinPatient[]
  doctorPayments: DoctorPayment[]
  installments: FinInstallment[]
  businessPartners: FinBusinessPartner[]
  clinicDebts: ClinicDebt[]
  isAdmin: boolean
  currentDoctorId: number | null
  isMesulMudur: boolean
  clinicName: string
  partnerServices: PartnerService[]
  profitByMonth: Record<string, number>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'bilgi'
  const now = useMemo(() => new Date(), [])
  const [tab, setTab] = useState<Tab>(initialTab)
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [showExpense, setShowExpense] = useState(false)

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  const patientMap = useMemo(() => {
    const m = new Map<number, string>()
    patients.forEach((p) => m.set(p.id, `${p.name} ${p.surname}`))
    return m
  }, [patients])

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()])
    txs.forEach((t) => t.transaction_date && set.add(Number(t.transaction_date.slice(0, 4))))
    return Array.from(set).sort((a, b) => b - a)
  }, [txs, now])

  // Dönem hesapları (kuruş)
  const monthTxs = txs.filter((t) => t.transaction_date?.startsWith(monthKey))
  const monthIncome = monthTxs.filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = monthIncome - monthExpense

  // Hakediş (dönem KPI) — modele göre: komisyon + sabit maaş
  const monthTreatments = treatments.filter((t) => t.treatment_date?.startsWith(monthKey))
  const hakedisByDoctor = doctors.map((d) => {
    const mine = monthTreatments.filter((t) => t.doctor_id === d.id)
    const ciro = mine.reduce((s, t) => s + (t.fee ?? 0), 0)
    const maliyet = mine.reduce((s, t) => s + (t.cost ?? 0), 0)
    const netKar = ciro - maliyet
    const summary = computeSummary(d, treatments, patients, txs, doctorPayments, monthKey, profitByMonth[`${d.share_branch_id ?? 'all'}:${monthKey}`])
    return { doctor: d, ciro, maliyet, netKar, hakedis: summary.entitlement, count: mine.length }
  })
  const totalHakedis = hakedisByDoctor.reduce((s, h) => s + h.hakedis, 0)

  // Hakediş KASA (kümülatif) — modele göre komisyon/maaş ayrı tutulur
  const hakedisKasa = useMemo(
    () =>
      doctors.map((d) => {
        const mineAll = treatments.filter((t) => t.doctor_id === d.id)
        const ciro = mineAll.reduce((s, t) => s + (t.fee ?? 0), 0)
        const maliyet = mineAll.reduce((s, t) => s + (t.cost ?? 0), 0)
        const netKar = ciro - maliyet
        const ciroMonth = mineAll
          .filter((t) => t.treatment_date?.startsWith(monthKey))
          .reduce((s, t) => s + (t.fee ?? 0), 0)
        const model = d.payment_model
        const komisyonHakedis = model === 'commission' || model === 'hybrid'
          ? Math.round((netKar * (d.commission_rate_bps ?? 0)) / 10000)
          : model === 'revenue' ? Math.round((ciro * (d.commission_rate_bps ?? 0)) / 10000)
          : model === 'per_transaction' ? mineAll.filter((t) => t.status === 'completed').length * (d.per_transaction_amount ?? 0)
          : model === 'bonus' ? (d.bonus_amount ?? 0)
          : model === 'guarantee' ? (d.guarantee_amount ?? 0)
          : 0
        const aylikMaas = model === 'salary' || model === 'hybrid' ? (d.monthly_salary ?? 0) : 0
        const odenen = doctorPayments
          .filter((p) => p.doctor_id === d.id)
          .reduce((s, p) => s + p.amount, 0)
        const odenenAy = doctorPayments
          .filter((p) => p.doctor_id === d.id && p.payment_date?.startsWith(monthKey))
          .reduce((s, p) => s + p.amount, 0)
        return {
          doctor: d,
          model,
          ciro,
          ciroMonth,
          maliyet,
          netKar,
          komisyonHakedis,
          aylikMaas,
          odenen,
          odenenAy,
          kasadaKalan: komisyonHakedis - odenen,
          count: mineAll.length,
        }
      }),
    [doctors, treatments, doctorPayments, monthKey]
  )

  // Hakediş görünüm yetkisi: admin veya mesul müdür tüm hekimleri görür, diğerleri sadece kendini
  const canSeeAllHakedis = isAdmin || isMesulMudur
  const visibleKasa = canSeeAllHakedis
    ? hakedisKasa
    : hakedisKasa.filter((r) => r.doctor.id === currentDoctorId)

  // Aktif borçlar özeti (vadesi geçmiş kontrol için)
  const activeDebts = initialDebts.filter((d) => d.status === 'active')
  const totalDebt = activeDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const overdueDebts = activeDebts.filter(
    (d) => d.due_date && d.due_date < new Date().toISOString().slice(0, 10)
  )

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 pt-7 pb-0">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#5FD3C1]/15 text-[#1EAEA0]">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F2B3D]">Finans Yönetimi</h1>
              <p className="text-xs font-medium text-slate-400">Gelir, gider, alacak ve hakediş takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-[42px] rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-xs font-bold text-[#142536] outline-none transition hover:border-[#BFEFE8] focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]">
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-[42px] rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-xs font-bold text-[#142536] outline-none transition hover:border-[#BFEFE8] focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-[#E7ECF2]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-bold transition-colors ${
                tab === t.id ? 'border-[#2DD4BF] text-[#142536]' : 'border-transparent text-slate-400 hover:text-[#142536]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-8 py-6">
        {tab === 'bilgi' && (
          <BilgiTab
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            netProfit={netProfit}
            totalHakedis={totalHakedis}
            totalDebt={totalDebt}
            overdueDebtCount={overdueDebts.length}
            monthTxs={monthTxs}
            patientMap={patientMap}
            allTxs={txs}
            allTreatments={treatments}
            onHakedisClick={() => setTab('hakedis')}
            onBorclarClick={() => setTab('borclar')}
          />
        )}
        {tab === 'defter' && (
          <LedgerDashboard
            key={monthKey}
            txs={txs}
            treatments={treatments}
            doctors={doctors}
            patients={patients}
            doctorPayments={doctorPayments}
            installments={installments}
            partners={initialPartners}
            debts={initialDebts}
            initialStart={`${monthKey}-01`}
            initialEnd={localDateValue(new Date(year, month + 1, 0))}
            onPatientClick={(id) => router.push(`/patients?patient_id=${id}&tab=hesap`)}
            onChanged={() => router.refresh()}
          />
        )}
        {tab === 'bakiye' && (
          <BalanceDashboard
            treatments={treatments}
            txs={txs}
            installments={installments}
            patients={patients}
            doctors={doctors}
            clinicName={clinicName}
            onPatientClick={(id) => router.push(`/patients?patient_id=${id}&tab=hesap`)}
            onPayClick={(id) => router.push(`/patients?patient_id=${id}&tab=hesap&pay=1`)}
          />
        )}
        {tab === 'hakedis' && (
          <EarningsDashboard
            doctors={visibleKasa.map((row) => row.doctor)}
            treatments={treatments}
            patients={patients}
            txs={txs}
            payments={doctorPayments}
            installments={installments}
            profitByMonth={profitByMonth}
            monthKey={monthKey}
            canSeeAll={canSeeAllHakedis}
            canManagePayments={canSeeAllHakedis}
            currentDoctorId={currentDoctorId}
            onChanged={() => router.refresh()}
            onPatientClick={(id) => router.push(`/patients?patient_id=${id}&tab=hesap`)}
          />
        )}
        {tab === 'borclar' && (
          <BorclarTab
            debts={initialDebts}
            onChanged={() => router.refresh()}
          />
        )}
        {tab === 'ortaklar' && (
          <PartnersDashboard
            partners={initialPartners}
            services={partnerServices}
            txs={txs}
            patients={patients}
            doctors={doctors}
            onChanged={() => {
              router.refresh()
            }}
          />
        )}
      </div>

      {showExpense && (
        <ExpenseModal
          onClose={() => setShowExpense(false)}
          onSuccess={() => {
            setShowExpense(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}


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

function BilgiTab({
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
      return { ay: MONTHS[d.getMonth()], Gelir: gelir, Gider: gider }
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
  const methodLabel: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale', other: 'Diğer' }

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
                          {t.type === 'expense' ? '−' : '+'}₺{fmt(t.amount)}
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
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{typeof value === 'number' ? `₺${fmt0(value)}` : value}</p>
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

function IconScale() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 16 3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1Z" /><path d="m2 16 3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h18" /></svg>
}

function IconUserRound() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
}

function IconPlus() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}

function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>
}

function IconCreditCard() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
}

function IconClock() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
}

function IconCheckCircle() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m22 4-10 10.01-3-3" /></svg>
}

function IconAlertTriangle() {
  return <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18.3-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function IconAlertTriangleSmall() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18.3-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function IconPercent() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
}

function IconInfo() {
  return <svg className="mt-0.5 shrink-0" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
}

function LedgerSummaryCard({
  title,
  value,
  description,
  tone,
  icon,
}: {
  title: string
  value: string
  description: string
  tone: 'green' | 'red' | 'blue' | 'amber' | 'violet'
  icon: ReactNode
}) {
  const toneClass = {
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  }[tone]
  const valueClass = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-[#0284C7]',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  }[tone]

  return (
    <div className="rounded-[22px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <span className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>
    </div>
  )
}

function LedgerEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        {icon}
      </span>
      <h3 className="text-sm font-black text-[#142536]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs font-medium text-slate-400">{description}</p>
      {action}
    </div>
  )
}

function MiniStat({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'red' }) {
  const valueClass = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-[#142536]'
  return (
    <div className="rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
    </div>
  )
}

// ---- Önceki Defter görünümü (geçiş sürecinde referans olarak tutuluyor) ----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DefterTab({
  monthTxs,
  patientMap,
  onAddExpense,
  onPatientClick,
  onChanged,
}: {
  monthTxs: FinTx[]
  patientMap: Map<number, string>
  onAddExpense: () => void
  onPatientClick: (id: number) => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const income = monthTxs.filter((t) => t.type === 'payment')
  const expense = monthTxs.filter((t) => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0)

  const del = async (id: number) => {
    const ok = await confirm({
      title: 'Kaydı Sil',
      message: 'Bu gider kaydı silinecek. Emin misiniz?',
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    const res = await deleteTransaction(id)
    if (res?.error) toast.error(res.error)
    else { toast.success('Gider silindi'); onChanged() }
  }

  const net = totalIncome - totalExpense
  const maxIncome = income.reduce((max, t) => Math.max(max, t.amount), 0)
  const maxExpense = expense.reduce((max, t) => Math.max(max, t.amount), 0)
  const methodLabel: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale', other: 'Diğer' }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LedgerSummaryCard
          title="Toplam Gelir"
          value={`₺${fmt(totalIncome)}`}
          description="Seçili ay gelir kayıtları"
          tone="green"
          icon={<IconTrendingUp />}
        />
        <LedgerSummaryCard
          title="Toplam Gider"
          value={`₺${fmt(totalExpense)}`}
          description="Seçili ay gider kayıtları"
          tone="red"
          icon={<IconTrendingDown />}
        />
        <LedgerSummaryCard
          title="Net Durum"
          value={`₺${fmt(net)}`}
          description="Gelir - gider farkı"
          tone={net >= 0 ? 'blue' : 'red'}
          icon={<IconScale />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionTitle
              icon={<IconWallet />}
              title="Gelirler"
              description="Seçili döneme ait tahsilatlar"
              iconClassName="bg-green-50 text-green-600"
            />
            <span className="inline-flex w-fit rounded-full bg-green-50 px-3 py-1.5 text-sm font-black text-green-700">
              Toplam: ₺{fmt(totalIncome)}
            </span>
          </div>

          {income.length === 0 ? (
            <LedgerEmpty
              icon={<IconWallet />}
              title="Bu dönemde gelir kaydı yok."
              description="Hasta ödemeleri alındığında burada görünür."
            />
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
              {income.map((t) => {
                const method = t.method ? methodLabel[t.method] ?? t.method : null
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-green-100 border-l-4 border-l-green-500 bg-green-50/70 px-4 py-3.5 text-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(22,163,74,0.08)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-green-600 shadow-sm">
                        <IconUserRound />
                      </span>
                      <div className="min-w-0">
                        {t.patient_id ? (
                          <button
                            onClick={() => onPatientClick(t.patient_id!)}
                            className="block truncate text-left font-black text-[#142536] transition hover:text-[#0F766E] hover:underline"
                          >
                            {patientMap.get(t.patient_id) ?? 'Ödeme'}
                          </button>
                        ) : (
                          <span className="block truncate font-black text-[#142536]">{t.description ?? 'Ödeme'}</span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
                          <span>{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</span>
                          {method && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{method}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-base font-black text-green-600">+₺{fmt(t.amount)}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 border-t border-[#EEF2F6] pt-3 text-xs font-bold text-slate-400">
            Toplam {income.length} gelir kaydı
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <SectionTitle
                icon={<IconReceipt />}
                title="Giderler"
                description="Seçili döneme ait gider kayıtları"
                iconClassName="bg-red-50 text-red-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-red-700">
                Toplam: ₺{fmt(totalExpense)}
              </span>
              <button
                onClick={onAddExpense}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"
              >
                <IconPlus />
                Gider Ekle
              </button>
            </div>
          </div>

          {expense.length === 0 ? (
            <LedgerEmpty
              icon={<IconReceipt />}
              title="Bu dönemde gider kaydı yok."
              description="Gider ekleyerek defteri güncel tutabilirsiniz."
              action={
                <button
                  onClick={onAddExpense}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#BFEFE8] bg-[#E9FBF8] px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#DDF8F4]"
                >
                  <IconPlus />
                  Gider Ekle
                </button>
              }
            />
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
              {expense.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-red-100 border-l-4 border-l-red-500 bg-red-50/70 px-4 py-3.5 text-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(239,68,68,0.08)]"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-black text-[#142536]">{t.description ?? 'Gider'}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
                      {t.partner_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                          🏢 Firma
                        </span>
                      )}
                      {t.category && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">{t.category}</span>
                      )}
                      {t.recurring && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                          {t.recurring === 'monthly' ? 'Aylık' : 'Yıllık'}
                        </span>
                      )}
                      <span>{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-base font-black text-red-600">−₺{fmt(t.amount)}</span>
                    <button
                      onClick={() => del(t.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                      title="Sil"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-[#EEF2F6] pt-3 text-xs font-bold text-slate-400">
            Toplam {expense.length} gider kaydı
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <SectionTitle
          icon={<IconList />}
          title="Aylık Defter Özeti"
          description="Seçili dönemin gelir, gider ve net durum kırılımı"
          iconClassName="bg-[#EAF7FF] text-[#0284C7]"
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Gelir kayıt sayısı" value={String(income.length)} />
          <MiniStat label="Gider kayıt sayısı" value={String(expense.length)} />
          <MiniStat label="Net durum" value={`₺${fmt(net)}`} tone={net >= 0 ? 'green' : 'red'} />
          <MiniStat label="En yüksek gelir" value={`₺${fmt(maxIncome)}`} tone="green" />
          <MiniStat label="En yüksek gider" value={`₺${fmt(maxExpense)}`} tone="red" />
        </div>
      </section>
    </div>
  )
}

// ---- Bakiye (alacak takibi) ----
function agingBadge(days: number): { label: string; cls: string } | null {
  if (days >= 90) return { label: '90+ gün gecikmiş', cls: 'bg-red-100 text-red-600' }
  if (days >= 60) return { label: '60 gün gecikmiş', cls: 'bg-orange-100 text-orange-600' }
  if (days >= 30) return { label: '30 gün gecikmiş', cls: 'bg-amber-100 text-amber-600' }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BakiyeTab({
  treatments,
  txs,
  installments,
  patientMap,
  onPatientClick,
  onPayClick,
}: {
  treatments: FinTreatment[]
  txs: FinTx[]
  installments: FinInstallment[]
  patientMap: Map<number, string>
  onPatientClick: (id: number) => void
  onPayClick: (id: number) => void
}) {
  const now = useMemo(() => new Date(), [])
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = localDateValue(now)

  const rows = useMemo(() => {
    const owed = new Map<number, number>()
    const paid = new Map<number, number>()
    const lastActivity = new Map<number, string>() // en son işlem (ödeme veya tedavi) tarihi
    const note = (id: number, date: string | null) => {
      if (!date) return
      const cur = lastActivity.get(id)
      if (!cur || date > cur) lastActivity.set(id, date)
    }
    treatments.forEach((t) => {
      if (t.patient_id) {
        owed.set(t.patient_id, (owed.get(t.patient_id) ?? 0) + (t.fee ?? 0))
        note(t.patient_id, t.treatment_date)
      }
    })
    txs.forEach((t) => {
      if (t.type === 'payment' && t.patient_id) {
        paid.set(t.patient_id, (paid.get(t.patient_id) ?? 0) + t.amount)
        note(t.patient_id, t.transaction_date)
      }
    })
    const ids = new Set<number>([...owed.keys(), ...paid.keys()])
    return Array.from(ids)
      .map((id) => {
        const o = owed.get(id) ?? 0
        const p = paid.get(id) ?? 0
        const last = lastActivity.get(id) ?? null
        const days = last
          ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000)
          : 0
        return { id, name: patientMap.get(id) ?? `#${id}`, owed: o, paid: p, balance: o - p, days }
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance)
  }, [treatments, txs, patientMap, now])

  const totalReceivable = rows.reduce((s, r) => s + r.balance, 0)
  const collectedThisMonth = txs
    .filter((t) => t.type === 'payment' && t.transaction_date?.startsWith(curMonthKey))
    .reduce((s, t) => s + t.amount, 0)
  const overdue = installments
    .filter((i) => !i.paid && i.due_date < todayStr)
    .reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LedgerSummaryCard
          title="Toplam Alacak"
          value={`₺${fmt(totalReceivable)}`}
          description="Kalan borcu bulunan hastalar"
          tone="red"
          icon={<IconWallet />}
        />
        <LedgerSummaryCard
          title="Bu Ay Tahsil Edilen"
          value={`₺${fmt(collectedThisMonth)}`}
          description="Seçili ayda alınan ödemeler"
          tone="green"
          icon={<IconCreditCard />}
        />
        <LedgerSummaryCard
          title="Vadesi Geçen"
          value={`₺${fmt(overdue)}`}
          description="Gecikmiş taksitler ve ödemeler"
          tone="amber"
          icon={<IconClock />}
        />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 border-b border-[#EEF2F6] px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle
            icon={<IconReceipt />}
            title="Alacak Takibi"
            description="Kalan borcu bulunan hastalar ve tahsilat durumları"
            iconClassName="bg-red-50 text-red-600"
          />
          <span className="inline-flex w-fit rounded-full bg-red-100 px-3 py-2 text-sm font-black text-red-700">
            Toplam: ₺{fmt(totalReceivable)}
          </span>
        </div>

        <div className="border-b border-[#EEF2F6] px-6 py-4">
          <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-[#FAFBFC] px-3 py-1.5">{rows.length} borçlu hasta</span>
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-700">₺{fmt(collectedThisMonth)} tahsil edildi</span>
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">₺{fmt(totalReceivable)} kalan alacak</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-green-600 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <IconCheckCircle />
              </span>
              <h3 className="text-sm font-black text-[#142536]">Kalan borcu olan hasta bulunmuyor.</h3>
              <p className="mt-1 max-w-md text-xs font-medium text-slate-400">
                Seçili dönemde tüm ödemeler tamamlanmış görünüyor.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[#FAFBFC]">
                <tr className="h-14 border-b border-[#EEF2F6]">
                  {['Hasta', 'Toplam Borç', 'Ödenen', 'Kalan', 'Tahsilat Oranı', 'İşlem'].map((h, i) => (
                    <th key={h} className={`px-5 text-xs font-black uppercase tracking-wide text-slate-400 ${i === 0 ? 'text-left' : i === 5 ? 'text-right' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = agingBadge(r.days)
                  const ratio = r.owed > 0 ? Math.min(Math.max(r.paid / r.owed, 0), 1) : 0
                  const percent = Math.round(ratio * 100)
                  const progressColor = percent < 20 ? 'bg-red-500' : percent < 70 ? 'bg-amber-400' : 'bg-green-500'
                  const initials = r.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()
                  const statusText = r.paid > 0 ? 'Kısmi ödeme alınmış' : 'Kalan borç yüksek'
                  return (
                    <tr key={r.id} className="h-20 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                      <td className="px-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-sm font-black text-[#0F766E]">
                            {initials || '#'}
                          </span>
                          <div className="min-w-0">
                            <button
                              onClick={() => onPatientClick(r.id)}
                              className="block truncate text-left font-black text-[#142536] transition hover:text-[#0F766E] hover:underline"
                            >
                              {r.name}
                            </button>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
                              <span>{statusText}</span>
                              {badge && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 text-right font-black text-[#142536]">₺{fmt(r.owed)}</td>
                      <td className="px-5 text-right font-black text-green-600">₺{fmt(r.paid)}</td>
                      <td className="px-5 text-right">
                        <span className="rounded-full bg-red-50 px-3 py-1.5 font-black text-red-600">₺{fmt(r.balance)}</span>
                      </td>
                      <td className="px-5">
                        <div className="ml-auto w-40">
                          <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
                            <span>%{percent}</span>
                            <span>tahsil edildi</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#E7ECF2]">
                            <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.max(percent, 2)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => onPayClick(r.id)}
                          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                        >
                          <IconCreditCard />
                          Ödeme Al
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#EEF2F6] px-6 py-4 text-xs font-bold text-slate-500">
          <span>Toplam {rows.length} hasta listeleniyor</span>
          <span>Sayfa 1 / 1</span>
        </div>
      </section>
    </div>
  )
}

// ---- Hakediş (kasa + ödeme) ----
interface KasaRow {
  doctor: FinDoctor
  model: string | null
  ciro: number
  ciroMonth: number
  maliyet: number
  netKar: number
  komisyonHakedis: number
  aylikMaas: number
  odenen: number
  odenenAy: number
  kasadaKalan: number
  count: number
}

function HakedisLine({
  label,
  value,
  tone = 'slate',
  strong = false,
}: {
  label: string
  value: number
  tone?: 'slate' | 'blue' | 'violet' | 'teal' | 'red' | 'green'
  strong?: boolean
}) {
  const valueClass = {
    slate: 'text-[#142536]',
    blue: 'text-[#0284C7]',
    violet: 'text-violet-600',
    teal: 'text-[#0F766E]',
    red: 'text-red-600',
    green: 'text-green-600',
  }[tone]

  return (
    <div className={`flex items-center justify-between gap-4 border-b border-[#EEF2F6] px-4 py-3 text-xs last:border-0 ${strong ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
      <span className="font-bold text-slate-500">{label}</span>
      <strong className={`${strong ? 'text-sm' : ''} ${valueClass}`}>
        ₺{fmt(value)}
      </strong>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HakedisTab({
  kasa,
  payments,
  doctors,
  canSeeAll,
  onChanged,
}: {
  kasa: KasaRow[]
  payments: DoctorPayment[]
  doctors: FinDoctor[]
  canSeeAll: boolean
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [payDoctor, setPayDoctor] = useState<KasaRow | null>(null)
  const [pending, startTransition] = useTransition()

  const doctorName = (id: number) => doctors.find((d) => d.id === id)?.name ?? `#${id}`

  if (kasa.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7FF] text-[#0284C7] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <IconUserRound />
        </span>
        <h3 className="text-base font-black text-[#142536]">
          {canSeeAll ? 'Hakediş için hekim kaydı gerekli' : 'Hakedişiniz bulunamadı'}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-400">
          {canSeeAll
            ? 'Ayarlar → Diş Hekimi bölümünden hekim ve ödeme modelini tanımladığınızda bu panel otomatik olarak dolacaktır.'
            : 'Profil hesabınız bir hekim kaydıyla eşleştirilmemişse bu ekranda veri görünmez. Yöneticinize başvurun.'}
        </p>
      </div>
    )
  }

  const totalHakedis = kasa.reduce((s, r) => s + r.komisyonHakedis, 0)
  const totalOdenen = kasa.reduce((s, r) => s + r.odenen, 0)
  const totalKasa = kasa.reduce((s, r) => s + r.kasadaKalan, 0)

  const delPayment = async (id: number) => {
    const ok = await confirm({
      title: 'Ödeme Kaydını Sil',
      message: 'Bu hakediş ödeme kaydı silinecek. Emin misiniz?',
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteDoctorPayment(id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Ödeme kaydı silindi'); onChanged() }
    })
  }

  const undefinedModelNames = kasa.filter((r) => !r.model).map((r) => `Dt. ${r.doctor.name}`)

  return (
    <div className="space-y-6">
      {undefinedModelNames.length > 0 && (
        <div className="flex items-start gap-3 rounded-[18px] border border-[#FED7AA] bg-[#FFF7E6] px-4 py-3.5 text-sm font-semibold text-[#B45309]">
          <IconAlertTriangle />
          <span>
            {undefinedModelNames.join(', ')} için henüz ödeme modeli tanımlanmadı. Ayarlar → Diş Hekimi bölümünden ayarlayın.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LedgerSummaryCard
          title="Komisyon Hakediş"
          value={`₺${fmt(totalHakedis)}`}
          description="Seçili dönemde hesaplanan toplam"
          tone="violet"
          icon={<IconPercent />}
        />
        <LedgerSummaryCard
          title="Toplam Ödenen"
          value={`₺${fmt(totalOdenen)}`}
          description="Hekimlere yapılan hakediş ödemeleri"
          tone="red"
          icon={<IconCreditCard />}
        />
        <LedgerSummaryCard
          title="Kasada Bekleyen"
          value={`₺${fmt(totalKasa)}`}
          description="Ödenmeyi bekleyen komisyon"
          tone="green"
          icon={<IconWallet />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {kasa.map((r) => {
          const rate = r.doctor.commission_rate_bps ?? 0
          const payableBase = Math.max(r.komisyonHakedis, 0)
          const paidRatio = payableBase > 0 ? Math.min(Math.max(r.odenen / payableBase, 0), 1) : 0
          return (
            <section key={r.doctor.id} className="flex min-h-[330px] flex-col rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black text-white shadow-sm"
                  style={{ background: r.doctor.color ?? 'linear-gradient(135deg,#5FD3C1,#1EAEA0)' }}
                >
                  {r.doctor.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-[#0F2B3D]">Dt. {r.doctor.name}</h3>
                    {r.model ? (
                      <span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[11px] font-black text-[#7C3AED]">
                        {PAYMENT_MODEL_LABEL[r.model] ?? r.model}
                        {(r.model === 'commission' || r.model === 'hybrid') && ` · %${(rate / 100).toLocaleString('tr-TR')}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7E6] px-2.5 py-1 text-[11px] font-black text-[#B45309]">
                        <IconAlertTriangleSmall />
                        Model tanımsız
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {r.model ? `${r.count} işlem üzerinden hesaplandı` : 'Hakediş için ödeme modeli gerekli'}
                  </p>
                </div>
              </div>

              {!r.model ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#FED7AA] bg-[#FFF7E6] px-5 py-8 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#B45309] shadow-sm">
                    <IconAlertTriangle />
                  </span>
                  <h4 className="text-sm font-black text-[#142536]">Ödeme modeli tanımlanmadı</h4>
                  <p className="mt-1 max-w-sm text-xs font-semibold leading-5 text-[#B45309]">
                    Hakediş hesaplamak için hekim ödeme modelini ayarlayın.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-[18px] border border-[#E7ECF2]">
                    {(r.model === 'commission' || r.model === 'hybrid') && (
                      <>
                        <HakedisLine label="Bu ayki ciro" value={r.ciroMonth} tone="blue" />
                        <HakedisLine label="Net kâr" value={r.netKar} />
                        <HakedisLine label="Komisyon hakediş" value={r.komisyonHakedis} tone="violet" />
                      </>
                    )}
                    {(r.model === 'salary' || r.model === 'hybrid') && (
                      <>
                        <HakedisLine label="Aylık maaş" value={r.aylikMaas} tone="teal" />
                        <HakedisLine label="Bu ay ödenen" value={r.odenenAy} tone="red" />
                        <HakedisLine label="Bu ay kalan maaş" value={Math.max(r.aylikMaas - r.odenenAy, 0)} tone="green" />
                      </>
                    )}
                    <HakedisLine label="Toplam ödenen" value={r.odenen} tone="red" />
                    {(r.model === 'commission' || r.model === 'hybrid') && (
                      <HakedisLine label="Kasada bekleyen" value={r.kasadaKalan} tone={r.kasadaKalan >= 0 ? 'green' : 'red'} strong />
                    )}
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[#E7ECF2] bg-[#FAFBFC] p-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Ödeme durumu</span>
                      <span>₺{fmt(r.odenen)} / ₺{fmt(payableBase)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E7ECF2]">
                      <div className="h-full rounded-full bg-[#5FD3C1]" style={{ width: `${Math.round(paidRatio * 100)}%` }} />
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => setPayDoctor(r)}
                disabled={!r.model}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#CCFBF1] disabled:text-slate-400 disabled:opacity-65"
              >
                <IconCreditCard />
                Ödeme Yap
              </button>
            </section>
          )
        })}
      </div>

      <div className="flex items-start gap-3 rounded-[16px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3.5 text-xs font-semibold text-slate-500">
        <IconInfo />
        <span>Komisyon hakedişleri, seçili dönemde tamamlanan ve tahsil edilen işlemler üzerinden hesaplanır.</span>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#EEF2F6] px-6 py-5">
          <SectionTitle
            icon={<IconReceipt />}
            title="Hakediş Ödeme Geçmişi"
            description="Hekimlere yapılan hakediş ödeme kayıtları"
            iconClassName="bg-[#EAF7FF] text-[#0284C7]"
          />
        </div>
        {payments.length === 0 ? (
          <div className="p-6">
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <IconReceipt />
              </span>
              <h3 className="text-sm font-black text-[#142536]">Henüz hakediş ödemesi yapılmadı.</h3>
              <p className="mt-1 max-w-md text-xs font-medium text-slate-400">Hekimlere yapılan ödemeler burada görüntülenir.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-[#FAFBFC]">
                <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
                  {['Tarih', 'Hekim', 'Ödeme Türü', 'Tutar', 'Açıklama', 'İşlem'].map((h, i) => (
                    <th key={h} className={`px-5 font-black uppercase tracking-wide ${i === 3 || i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                    <td className="px-5 font-semibold text-slate-500">{new Date(p.payment_date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-5 font-black text-[#142536]">Dt. {doctorName(p.doctor_id)}</td>
                    <td className="px-5">
                      <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 font-bold text-slate-600">
                        {PAYTYPE_LABEL[p.payment_type] ?? p.payment_type}
                      </span>
                    </td>
                    <td className="px-5 text-right font-black text-red-600">₺{fmt(p.amount)}</td>
                    <td className="max-w-[220px] truncate px-5 font-semibold text-slate-500" title={p.note ?? ''}>{p.note || '—'}</td>
                    <td className="px-5 text-right">
                      <button
                        onClick={() => delPayment(p.id)}
                        disabled={pending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Sil"
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payDoctor && (
        <DoctorPaymentModal
          row={payDoctor}
          onClose={() => setPayDoctor(null)}
          onSuccess={() => {
            setPayDoctor(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function DoctorPaymentModal({
  row,
  onClose,
  onSuccess,
}: {
  row: KasaRow
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState(
    row.model === 'salary' || row.model === 'hybrid' ? 'maas' : 'avans'
  )
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(() => localDateValue())
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const amountKurus = Math.round(
    (parseFloat((amount || '0').replace(/\./g, '').replace(',', '.')) || 0) * 100
  )
  const sonra = row.kasadaKalan - amountKurus

  const save = () => {
    startTransition(async () => {
      const res = await addDoctorPayment({
        doctorId: row.doctor.id,
        amount,
        paymentType,
        method,
        date,
        note,
      })
      if (res?.error) toast.error(res.error)
      else onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#0F2B3D]">Hakediş Ödemesi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Dt. {row.doctor.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tutar (₺)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Ödeme Türü</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
                <option value="maas">Maaş</option>
                <option value="avans">Avans</option>
                <option value="prim">Prim</option>
                <option value="duzeltme">Düzeltme</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Ödeme Şekli</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
                <option value="cash">Nakit</option>
                <option value="transfer">Banka transferi</option>
                <option value="check">Çek</option>
                <option value="other">Diğer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Not (isteğe bağlı)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="örn. Mayıs ayı 1. ara ödeme" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>

          {/* Canlı önizleme — modele göre */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1">
            {row.model === 'salary' ? (
              <>
                <div className="flex justify-between"><span>Aylık maaş:</span><strong>₺{fmt(row.aylikMaas)}</strong></div>
                <div className="flex justify-between"><span>Bu ay ödenen:</span><strong>₺{fmt(row.odenenAy)}</strong></div>
                <div className="flex justify-between border-t border-gray-200 pt-1"><span>Bu ödeme:</span><strong className="text-red-500">₺{fmt(amountKurus)}</strong></div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span>Kasadaki komisyon hakediş:</span><strong>₺{fmt(row.kasadaKalan)}</strong></div>
                <div className="flex justify-between"><span>Ödenecek:</span><strong className="text-red-500">₺{fmt(amountKurus)}</strong></div>
                <div className="flex justify-between border-t border-gray-200 pt-1">
                  <span>Ödeme sonrası:</span>
                  <strong className={sonra >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ₺{fmt(sonra)} {sonra < 0 ? '(fazla ödeme!)' : ''}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              İptal
            </button>
            <button onClick={save} disabled={pending || amountKurus <= 0} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-50">
              {pending ? 'Kaydediliyor…' : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Gider modalı ----
type ExpResult = { error?: string; success?: boolean } | null
function ExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [state, action, pending] = useActionState(
    async (_prev: ExpResult, formData: FormData): Promise<ExpResult> => {
      return addExpense({
        amount: formData.get('amount') as string,
        date: formData.get('date') as string,
        description: formData.get('description') as string,
        category: formData.get('category') as string,
        invoiceNo: formData.get('invoice_no') as string,
        recurring: formData.get('recurring') as string,
      })
    },
    null as ExpResult
  )

  useEffect(() => {
    if ((state as ExpResult)?.success) onSuccess()
  }, [state, onSuccess])

  const today = localDateValue()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0F2B3D]">Gider Ekle</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form action={action} className="p-6 space-y-4">
          {(state as ExpResult)?.error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{(state as ExpResult)!.error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Kategori</label>
              <select name="category" defaultValue="Diğer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
                {['Lab', 'Malzeme', 'Personel', 'Kira', 'Elektrik&Su', 'Reklam', 'Diğer'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tutar (₺) *</label>
              <input name="amount" required placeholder="1500" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Açıklama *</label>
            <input name="description" required placeholder="örn. Diş laboratuvarı fatura ödemesi" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
              <input name="date" type="date" defaultValue={today} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fatura No</label>
              <input name="invoice_no" placeholder="opsiyonel" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tekrarlayan Gider</label>
            <select name="recurring" defaultValue="" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
              <option value="">Hayır (tek seferlik)</option>
              <option value="monthly">Aylık</option>
              <option value="yearly">Yıllık</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">İşaretlenir; otomatik ileri tarih oluşturma sonra eklenecek.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              İptal
            </button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
              {pending ? 'Kaydediliyor…' : 'Gider Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── İş Ortaklarımız Sekmesi ───────────────────────────────────────────────────

// ---- Borçlar ----

function BorclarTab({
  debts,
  onChanged,
}: {
  debts: ClinicDebt[]
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm] = useState(false)
  const [editDebt, setEditDebt] = useState<ClinicDebt | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payStr, setPayStr] = useState('')
  const [pending, startTransition] = useTransition()

  const activeDebts = debts.filter((d) => d.status === 'active')
  const paidDebts = debts.filter((d) => d.status === 'paid')

  const totalRemaining = activeDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const overdueCount = activeDebts.filter((d) => d.due_date && d.due_date < today).length

  const handlePay = (debtId: number) => {
    const amountTL = parseFloat(payStr.replace(',', '.'))
    if (isNaN(amountTL) || amountTL <= 0) { toast.error('Geçerli bir tutar girin'); return }
    const amountKurus = Math.round(amountTL * 100)
    startTransition(async () => {
      const res = await payClinicDebt(debtId, amountKurus)
      if (res?.error) toast.error(res.error)
      else { toast.success('Ödeme kaydedildi'); setPayingId(null); setPayStr(''); onChanged() }
    })
  }

  const handleDelete = async (d: ClinicDebt) => {
    const ok = await confirm({ title: 'Borcu İptal Et', message: `"${d.title}" borcu iptal edilecek. Emin misiniz?`, confirmText: 'İptal Et' })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteClinicDebt(d.id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Borç iptal edildi'); onChanged() }
    })
  }

  const RECURRENCE_LABEL: Record<string, string> = { tek_seferlik: 'Tek Seferlik', aylik: 'Aylık', yillik: 'Yıllık' }

  return (
    <div className="space-y-6">
      {/* Özet KPI'lar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Kalan Borç</p>
          <p className="mt-1 text-2xl font-black text-orange-600">₺{fmt0(totalRemaining)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{activeDebts.length} aktif borç kalemi</p>
        </div>
        <div className={`rounded-[20px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${overdueCount > 0 ? 'border-red-200' : 'border-slate-200/90'}`}>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vadesi Geçmiş</p>
          <p className={`mt-1 text-2xl font-black ${overdueCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>{overdueCount}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">ödeme yapılmamış borç</p>
        </div>
        <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ödendi</p>
          <p className="mt-1 text-2xl font-black text-green-600">{paidDebts.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">kapatılan borç</p>
        </div>
      </div>

      {/* Başlık + Ekle butonu */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-[#0F2B3D]">Aktif Borçlar</h2>
        <button
          type="button"
          onClick={() => { setEditDebt(null); setShowForm(true) }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          Borç Ekle
        </button>
      </div>

      {activeDebts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-400">Aktif borç kaydı bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDebts.map((d) => {
            const remaining = d.total_amount - d.paid_amount
            const paidPct = d.total_amount > 0 ? Math.round((d.paid_amount / d.total_amount) * 100) : 0
            const isOverdue = d.due_date ? d.due_date < today : false
            const isPaying = payingId === d.id
            return (
              <div key={d.id} className={`rounded-[20px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition ${isOverdue ? 'border-red-200' : 'border-slate-200/90'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#0F2B3D]">{d.title}</p>
                      {isOverdue && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">Vadesi Geçti</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{RECURRENCE_LABEL[d.recurrence] ?? d.recurrence}</span>
                    </div>
                    {d.due_date && (
                      <p className={`mt-0.5 text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                        Vade: {new Date(d.due_date).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                    {d.notes && <p className="mt-1 text-xs text-slate-400">{d.notes}</p>}
                    {/* İlerleme çubuğu */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>₺{fmt0(d.paid_amount)} ödendi</span>
                        <span>₺{fmt0(remaining)} kalan / ₺{fmt0(d.total_amount)} toplam</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-[#2DD4BF] transition-all" style={{ width: `${paidPct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setPayingId(isPaying ? null : d.id); setPayStr('') }}
                      className="h-8 rounded-lg bg-[#2DD4BF]/10 px-3 text-xs font-black text-[#0F766E] hover:bg-[#2DD4BF]/20 transition-colors"
                    >
                      Öde
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditDebt(d); setShowForm(true) }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      disabled={pending}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  </div>
                </div>

                {/* Ödeme inline formu */}
                {isPaying && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] px-4 py-3">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₺</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={payStr}
                        onChange={(e) => setPayStr(e.target.value)}
                        placeholder={`Maks. ₺${fmt0(remaining)}`}
                        className="w-full rounded-lg border border-[#E7ECF2] bg-white py-2 pl-7 pr-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePay(d.id)}
                      disabled={pending}
                      className="h-9 rounded-lg bg-[#2DD4BF] px-4 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60 transition-colors"
                    >
                      {pending ? '…' : 'Kaydet'}
                    </button>
                    <button type="button" onClick={() => setPayingId(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-slate-400 hover:bg-slate-100 transition-colors">İptal</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kapatılan borçlar */}
      {paidDebts.length > 0 && (
        <details className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <summary className="cursor-pointer text-sm font-black text-slate-500 select-none">
            Kapatılan Borçlar ({paidDebts.length})
          </summary>
          <div className="mt-4 space-y-2">
            {paidDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-500 line-through">{d.title}</span>
                <span className="text-xs font-black text-green-600">₺{fmt0(d.total_amount)} — Ödendi</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Borç Ekleme/Düzenleme Modalı */}
      {showForm && (
        <DebtFormModal
          debt={editDebt}
          onClose={() => { setShowForm(false); setEditDebt(null) }}
          onSaved={() => { setShowForm(false); setEditDebt(null); onChanged() }}
        />
      )}
    </div>
  )
}

function DebtFormModal({
  debt,
  onClose,
  onSaved,
}: {
  debt: ClinicDebt | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = debt !== null
  const [title, setTitle] = useState(debt?.title ?? '')
  const [amountStr, setAmountStr] = useState(debt ? String(debt.total_amount / 100) : '')
  const [dueDate, setDueDate] = useState(debt?.due_date ?? '')
  const [recurrence, setRecurrence] = useState(debt?.recurrence ?? 'tek_seferlik')
  const [notes, setNotes] = useState(debt?.notes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inputCls = 'w-full rounded-xl border border-[#E7ECF2] bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  const submit = () => {
    const amountTL = parseFloat(amountStr.replace(',', '.'))
    if (!title.trim()) { setErr('Başlık zorunludur'); return }
    if (isNaN(amountTL) || amountTL <= 0) { setErr('Geçerli bir tutar girin'); return }
    setErr(null)
    const totalAmount = Math.round(amountTL * 100)
    startTransition(async () => {
      const input = { title: title.trim(), totalAmount, dueDate: dueDate || null, recurrence, notes: notes.trim() || null }
      const res = isEdit ? await updateClinicDebt(debt!.id, input) : await addClinicDebt(input)
      if (res?.error) { setErr(res.error); return }
      toast.success(isEdit ? 'Borç güncellendi' : 'Borç eklendi')
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-black text-[#0F2B3D]">{isEdit ? 'Borcu Düzenle' : 'Yeni Borç Ekle'}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {err && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">{err}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Başlık *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Ekipman kredisi" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Toplam Tutar (₺) *</label>
            <input type="text" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="50000" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Vade Tarihi</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Tekrar</label>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputCls}>
                <option value="tek_seferlik">Tek Seferlik</option>
                <option value="aylik">Aylık</option>
                <option value="yillik">Yıllık</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Notlar</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsiyonel açıklama" className={inputCls} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">İptal</button>
          <button type="button" onClick={submit} disabled={pending} className="h-9 rounded-xl bg-[#2DD4BF] px-5 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60 transition-colors">
            {pending ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PARTNER_TYPE_LABEL: Record<string, string> = {
  laboratuvar: 'Laboratuvar',
  tedarikci: 'Tedarikçi',
  firma_odeme: 'Firma Ödeme Kanalı',
  diger: 'Diğer',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OrtaklarTab({
  partners,
  txs,
  patientMap,
  onChanged,
}: {
  partners: FinBusinessPartner[]
  txs: FinTx[]
  patientMap: Map<number, string>
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [showAdd, setShowAdd] = useState(false)
  const [editPartner, setEditPartner] = useState<FinBusinessPartner | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const partnerMonthTotal = (partnerId: number) => {
    return txs
      .filter((t) => t.partner_id === partnerId && t.transaction_date?.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0)
  }

  const partnerTxs = (partnerId: number) =>
    txs
      .filter((t) => t.partner_id === partnerId)
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))

  const handleDelete = async (p: FinBusinessPartner) => {
    const ok = await confirm({
      title: 'İş Ortağını Sil',
      message: `"${p.name}" pasife alınacak ve listeden kaldırılacak. Mevcut işlem kayıtları korunur. Emin misiniz?`,
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    const res = await deleteBusinessPartner(p.id)
    if (res?.error) toast.error(res.error)
    else { toast.success('İş ortağı silindi'); onChanged() }
  }

  const activePartners = partners.filter((p) => p.is_active)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-[#0F2B3D]">İş Ortaklarımız</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Laboratuvar, tedarikçi ve firma ödeme kanalları</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"
        >
          <IconPlus />
          İş Ortağı Ekle
        </button>
      </div>

      {activePartners.length === 0 ? (
        <LedgerEmpty
          icon={<IconBuilding />}
          title="Henüz iş ortağı eklenmedi."
          description="Laboratuvar, tedarikçi veya firma ödeme kanallarını buradan yönetebilirsiniz."
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#BFEFE8] bg-[#E9FBF8] px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#DDF8F4]"
            >
              <IconPlus />
              İş Ortağı Ekle
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#FAFBFC]">
              <tr className="h-12 border-b border-[#EEF2F6]">
                {['Ad', 'Tür', 'Yetkili', 'Telefon', 'Bu Ay İşlem', ''].map((h) => (
                  <th key={h} className="px-5 text-left text-xs font-black uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePartners.map((p) => {
                const monthTotal = partnerMonthTotal(p.id)
                const isExpanded = expanded === p.id
                const pTxs = partnerTxs(p.id)
                return (
                  <>
                    <tr
                      key={p.id}
                      className="h-16 cursor-pointer border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]"
                      onClick={() => setExpanded(isExpanded ? null : p.id)}
                    >
                      <td className="px-5 font-black text-[#0F2B3D]">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 text-base">🏢</span>
                          {p.name}
                        </div>
                      </td>
                      <td className="px-5">
                        <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-bold text-[#142536]">
                          {PARTNER_TYPE_LABEL[p.partner_type] ?? p.partner_type}
                        </span>
                      </td>
                      <td className="px-5 font-semibold text-slate-500">{p.contact_person || '—'}</td>
                      <td className="px-5 font-semibold text-slate-500">{p.phone || '—'}</td>
                      <td className="px-5 font-black text-[#0F2B3D]">{monthTotal > 0 ? `₺${fmt(monthTotal)}` : '—'}</td>
                      <td className="px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditPartner(p) }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#0F2B3D]"
                            title="Düzenle"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Sil"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-expand`} className="border-b border-[#EEF2F6] bg-[#FAFBFC]">
                        <td colSpan={6} className="px-5 py-4">
                          {p.notes && (
                            <p className="mb-3 text-xs font-semibold text-slate-500 italic">Not: {p.notes}</p>
                          )}
                          {pTxs.length === 0 ? (
                            <p className="text-xs font-semibold text-slate-400">Bu ortak için henüz işlem kaydı yok.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[560px] text-xs">
                                <thead>
                                  <tr className="h-9 border-b border-[#EEF2F6]">
                                    {['Tarih', 'Hasta', 'Tutar', 'Tür', 'Açıklama'].map((h) => (
                                      <th key={h} className="px-3 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pTxs.map((t) => (
                                    <tr key={t.id} className="h-12 border-b border-[#EEF2F6] last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                                      <td className="px-3 font-semibold text-slate-500">
                                        {new Date(t.transaction_date).toLocaleDateString('tr-TR')}
                                      </td>
                                      <td className="px-3 font-semibold text-slate-500">
                                        {t.patient_id ? patientMap.get(t.patient_id) ?? `#${t.patient_id}` : '—'}
                                      </td>
                                      <td className={`px-3 font-black ${t.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                        {t.type === 'expense' ? '−' : '+'}₺{fmt(t.amount)}
                                      </td>
                                      <td className="px-3">
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.type === 'expense' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                          {t.type === 'expense' ? 'Gider' : 'Gelir'}
                                        </span>
                                      </td>
                                      <td className="max-w-[200px] truncate px-3 font-medium text-slate-400" title={t.description ?? ''}>
                                        {t.description || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <PartnerModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); onChanged() }}
        />
      )}
      {editPartner && (
        <PartnerModal
          partner={editPartner}
          onClose={() => setEditPartner(null)}
          onSuccess={() => { setEditPartner(null); onChanged() }}
        />
      )}
    </div>
  )
}

function PartnerModal({
  partner,
  onClose,
  onSuccess,
}: {
  partner?: FinBusinessPartner
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(partner?.name ?? '')
  const [partnerType, setPartnerType] = useState(partner?.partner_type ?? 'diger')
  const [contactPerson, setContactPerson] = useState(partner?.contact_person ?? '')
  const [phone, setPhone] = useState(partner?.phone ?? '')
  const [email, setEmail] = useState(partner?.email ?? '')
  const [notes, setNotes] = useState(partner?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Ad zorunludur'); return }
    setError(null)
    startTransition(async () => {
      const input = { name, partnerType, contactPerson, phone, email, notes }
      const res = partner
        ? await updateBusinessPartner(partner.id, input)
        : await addBusinessPartner(input)
      if (res?.error) setError(res.error)
      else { toast.success(partner ? 'İş ortağı güncellendi' : 'İş ortağı eklendi'); onSuccess() }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#0F2B3D]">{partner ? 'İş Ortağını Düzenle' : 'İş Ortağı Ekle'}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ad *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="İş ortağı adı" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tür</label>
            <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className={inputCls}>
              <option value="laboratuvar">Laboratuvar</option>
              <option value="tedarikci">Tedarikçi</option>
              <option value="firma_odeme">Firma Ödeme Kanalı</option>
              <option value="diger">Diğer</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Yetkili Kişi</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Ad Soyad" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 123 45 67" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@firma.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Not</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="İsteğe bağlı not..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              İptal
            </button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
              {pending ? 'Kaydediliyor…' : partner ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function IconBuilding() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /><path d="M3 15h6" /><path d="M12 9h9" /><path d="M12 15h9" /></svg>
}

function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="m18.5 2.5 2 2L12 13l-4 1 1-4Z" /></svg>
}

