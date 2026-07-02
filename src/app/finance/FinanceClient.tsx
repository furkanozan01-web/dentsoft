'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { localDateValue, MONTHS_TR } from '@/lib/format'
import { computeSummary } from '@/lib/finance/hakedis'
import LedgerDashboard from './LedgerDashboard'
import BalanceDashboard from './BalanceDashboard'
import EarningsDashboard from './EarningsDashboard'
import PartnersDashboard from './PartnersDashboard'
import BilgiTab from './BilgiTab'
import ExpenseModal from './ExpenseModal'
import BorclarTab from './BorclarTab'

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

type Tab = 'bilgi' | 'defter' | 'bakiye' | 'hakedis' | 'borclar' | 'ortaklar'
const TABS: { id: Tab; label: string }[] = [
  { id: 'bilgi', label: 'Bilgi' },
  { id: 'defter', label: 'Defter' },
  { id: 'bakiye', label: 'Bakiye' },
  { id: 'hakedis', label: 'Hakediş' },
  { id: 'borclar', label: 'Borçlar' },
  { id: 'ortaklar', label: 'İş Ortaklarımız' },
]

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
              {MONTHS_TR.map((m, i) => (
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


