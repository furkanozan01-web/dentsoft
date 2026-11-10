import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import FinanceClient from './FinanceClient'
import type {
  FinTx,
  FinTreatment,
  FinDoctor,
  FinDoctorShare,
  FinBranch,
  FinPatient,
  DoctorPayment,
  FinInstallment,
  FinBusinessPartner,
  ClinicDebt,
  PartnerService,
} from './FinanceClient'
import { getPermissions, canSeeAyarlarNav, canSeeAllHakedis as getCanSeeAllHakedis } from '@/lib/permissions'

export const metadata = { title: 'Finans — DentSoft' }

export default async function FinancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, clinic_id, doctor_id')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) redirect('/login')
  const clinicId = profile.clinic_id
  const isAdmin = profile.role === 'bashekim'
  // İşlem satırları son 13 ay ile sınırlıdır; daha eskisi istemciden getTransactionsRange ile yüklenir.
  // Tüm zamanlar toplamları (Kasa, hisse kâr tabanı) satırdan değil finance_totals RPC'sinden gelir.
  const windowStart = new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1).toLocaleDateString('en-CA')

  const [
    { data: clinic },
    { canView: canSeeFinans },
    canSeeAyarlar,
    hasHakedisPermission,
    { data: txs },
    { data: treatments },
    { data: doctors },
    { data: patients },
    { data: doctorPayments },
    { data: paymentCreators },
    { data: installments },
    { data: businessPartners },
    { data: clinicDebts },
    { data: partnerServices },
    { data: doctorShares },
    { data: branches },
    { data: totalsRaw },
  ] = await Promise.all([
    supabase.from('clinic_settings').select('clinic_name').eq('id', clinicId).single(),
    getPermissions('finans_bilgi'),
    canSeeAyarlarNav(),
    getCanSeeAllHakedis(),
    supabase
      .from('transactions')
      .select('id, transaction_date, amount, method, type, description, patient_id, treatment_id, doctor_id, category, invoice_no, recurring, partner_id, partner_service_id, account_name, invoice_status, payment_status, source_type, original_currency, original_amount, exchange_rate, branch_id')
      .eq('clinic_id', clinicId)
      .gte('transaction_date', windowStart)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('treatments')
      .select('id, treatment_date, fee, cost, doctor_id, status, treatment_name, patient_id')
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled'),
    supabase
      .from('doctors')
      .select('id, name, specialty, color, commission_rate_bps, payment_model, monthly_salary, guarantee_amount, bonus_amount, per_transaction_amount, salary_day, payment_account, is_mesul_mudur, guarantee_active, guarantee_period, guarantee_method, guarantee_note')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('patients')
      .select('id, name, surname, created_at')
      .eq('clinic_id', clinicId),
    supabase
      .from('doctor_payments')
      .select('id, doctor_id, amount, payment_type, method, payment_date, note, transaction_id, account_name, created_by, earning_period')
      .eq('clinic_id', clinicId)
      .order('payment_date', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('clinic_id', clinicId),
    supabase
      .from('payment_plans')
      .select('id, patient_id, due_date, amount, paid')
      .eq('clinic_id', clinicId)
      .eq('paid', false),
    supabase
      .from('business_partners')
      .select('id, name, partner_type, contact_person, phone, email, notes, is_active, created_at, address, tax_info, bank_info')
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('clinic_debts')
      .select('id, title, total_amount, paid_amount, due_date, recurrence, notes, status, created_at, payment_day, payment_method, account_name, last_paid_at')
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('partner_services')
      .select('id, partner_id, service_name, patient_id, doctor_id, service_date, due_date, amount, vat_status, invoice_status, payment_status, description, attachment_url')
      .eq('clinic_id', clinicId)
      .order('service_date', { ascending: false }),
    supabase
      .from('doctor_shares')
      .select('id, doctor_id, branch_id, rate_bps, start_date, end_date, period, profit_distribution_type, note, is_active')
      .eq('clinic_id', clinicId)
      .eq('is_active', true),
    supabase
      .from('branches')
      .select('id, name, is_default')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name'),
    supabase.rpc('finance_totals'),
  ])

  // Mevcut kullanıcının doktor kaydını bul, is_mesul_mudur belirle
  const currentDoctorRecord = profile.doctor_id
    ? (doctors ?? []).find((d) => d.id === profile.doctor_id) ?? null
    : null
  const isMesulMudur = currentDoctorRecord?.is_mesul_mudur === true
  // hakedis_tum izni (rol şablonu + kişisel override) VEYA doctors.is_mesul_mudur bayrağı
  const canSeeAllHakedis = isAdmin || isMesulMudur || hasHakedisPermission
  const safeDoctors = canSeeAllHakedis
    ? (doctors ?? [])
    : (doctors ?? []).map((doctor) => doctor.id === profile.doctor_id ? doctor : ({
        ...doctor,
        commission_rate_bps: null,
        payment_model: null,
        monthly_salary: null,
        guarantee_amount: null,
        bonus_amount: null,
        per_transaction_amount: null,
        guarantee_active: false,
        guarantee_note: null,
      }))
  const safeDoctorShares = canSeeAllHakedis
    ? (doctorShares ?? [])
    : (doctorShares ?? []).filter((share) => share.doctor_id === profile.doctor_id)
  const safeTreatments = canSeeAllHakedis
    ? (treatments ?? [])
    : (treatments ?? []).map((treatment) => treatment.doctor_id === profile.doctor_id
        ? treatment
        : ({ ...treatment, doctor_id: null, cost: 0, fee: 0 }))
  const creatorNames = new Map((paymentCreators ?? []).map((creator) => [creator.id, creator.full_name]))
  const namedDoctorPayments = (doctorPayments ?? []).map((payment) => ({
    ...payment,
    created_by_name: payment.created_by ? creatorNames.get(payment.created_by) ?? null : null,
  }))
  const safeDoctorPayments = canSeeAllHakedis
    ? namedDoctorPayments
    : namedDoctorPayments.filter((payment) => payment.doctor_id === profile.doctor_id)

  // Kendi hastası = bu hekimin en az bir treatment kaydı olan hasta
  const myPatientIds = !canSeeAllHakedis && profile.doctor_id
    ? new Set(
        (treatments ?? [])
          .filter((t) => t.doctor_id === profile.doctor_id && t.patient_id != null)
          .map((t) => t.patient_id as number)
      )
    : null
  // Tx maskeleme: transaction'da doctor_id varsa onu kullan; yoksa patient_id üzerinden hekim eşleştir
  const safeTransactions = canSeeAllHakedis
    ? (txs ?? [])
    : (txs ?? []).filter((tx) => {
        if (tx.doctor_id != null) return tx.doctor_id === profile.doctor_id
        if (tx.patient_id != null) return myPatientIds?.has(tx.patient_id) ?? false
        return false
      })
  // Toplamlar satırlardan değil finance_totals RPC'sinden: PostgREST satır sınırından bağımsız.
  const totals = (totalsRaw ?? []) as { branch_id: number | null; month: string; type: string; total: number }[]
  const profitByMonth: Record<string, number> = {}
  const kasaTotals: Record<string, { income: number; expense: number }> = {}
  const yearSet = new Set<number>([new Date().getFullYear()])
  for (const row of totals) {
    const signed = row.type === 'payment' ? row.total : -row.total
    const allKey = `all:${row.month}`
    profitByMonth[allKey] = (profitByMonth[allKey] ?? 0) + signed
    if (row.branch_id) {
      const branchKey = `${row.branch_id}:${row.month}`
      profitByMonth[branchKey] = (profitByMonth[branchKey] ?? 0) + signed
      // Kasa yalnızca hakediş yetkisi olanlara açık (satır maskeleme kuralıyla aynı)
      if (canSeeAllHakedis) {
        const k = (kasaTotals[row.branch_id] ??= { income: 0, expense: 0 })
        if (row.type === 'payment') k.income += row.total
        else if (row.type === 'expense' || row.type === 'refund') k.expense += row.total
      }
    }
    yearSet.add(Number(row.month.slice(0, 4)))
  }
  const years = Array.from(yearSet).sort((a, b) => b - a)

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile.full_name ?? ''} role={profile.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />
      <main className="flex-1 overflow-y-auto">
        <FinanceClient
          txs={safeTransactions as FinTx[]}
          treatments={safeTreatments as FinTreatment[]}
          doctors={safeDoctors as FinDoctor[]}
          doctorShares={safeDoctorShares as FinDoctorShare[]}
          branches={(branches ?? []) as FinBranch[]}
          patients={(patients ?? []) as FinPatient[]}
          doctorPayments={safeDoctorPayments as DoctorPayment[]}
          installments={(installments ?? []) as FinInstallment[]}
          businessPartners={(businessPartners ?? []) as FinBusinessPartner[]}
          clinicDebts={(clinicDebts ?? []) as ClinicDebt[]}
          isAdmin={isAdmin}
          currentDoctorId={profile.doctor_id ?? null}
          isMesulMudur={isMesulMudur}
          clinicName={clinic?.clinic_name ?? 'Klinik'}
          partnerServices={(partnerServices ?? []) as PartnerService[]}
          profitByMonth={profitByMonth}
          kasaTotals={kasaTotals}
          years={years}
          windowStart={windowStart}
        />
      </main>
    </div>
  )
}
