import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './Sidebar'
import DashboardBell from './DashboardBell'
import MissingInvoiceAlert, { type MissingInvoiceRow } from './MissingInvoiceAlert'
import DashboardNewPatientButton from './DashboardNewPatientButton'
import { computeSummary } from '@/lib/finance/hakedis'
import { getPermissions, canSeeAyarlarNav } from '@/lib/permissions'

interface AppointmentRow {
  id: number
  scheduled_at: string
  duration_min: number
  status: string
  treatment_note: string | null
  patient_id: number | null
  patient: { name: string; surname: string } | null
  doctor: { name: string; color: string | null } | null
}

interface OverduePlanRow {
  id: number
  due_date: string
  amount: number
  patient: { id: number; name: string; surname: string } | null
}

interface PatientRow {
  id: number
  name: string
  surname: string
  birth_date: string | null
  phone1: string | null
  status: string
}

interface DoctorRow {
  id: number
  name: string
  color: string | null
  specialty: string | null
  commission_rate_bps: number | null
  payment_model: string | null
  monthly_salary: number | null
  is_mesul_mudur: boolean
  guarantee_amount: number | null
  bonus_amount: number | null
  per_transaction_amount: number | null
  salary_day: number | null
  payment_account: string | null
  guarantee_active: boolean
  guarantee_period: string
  guarantee_method: string
  guarantee_note: string | null
}

interface DoctorShareRow {
  id: number
  doctor_id: number
  branch_id: number
  rate_bps: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

interface TreatmentRow {
  id: number
  fee: number | null
  cost: number | null
  doctor_id: number | null
  patient_id: number | null
  treatment_date: string | null
  status: string
  treatment_name: string
}

function fmt(kurus: number): string {
  return (kurus / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/^dt\.\s*/i, '')
    .trim()
}

export default async function DashboardPage() {
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

  const clinicId = profile?.clinic_id
  if (!clinicId) redirect('/login')
  // Sidebar izinleri ana sorgularla paralel başlar
  const navPermsPromise = Promise.all([getPermissions('finans_bilgi'), canSeeAyarlarNav()])

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const overdue45Date = new Date(today)
  overdue45Date.setDate(today.getDate() - 45)
  const overdue45ISO = `${overdue45Date.getFullYear()}-${String(overdue45Date.getMonth() + 1).padStart(2, '0')}-${String(overdue45Date.getDate()).padStart(2, '0')}`
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStartISO = `${monthKey}-01`
  const nextMonthStartISO = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-CA')
  const staleCutoff = new Date(today)
  staleCutoff.setMonth(staleCutoff.getMonth() - 6)

  const [
    { data: doctorsRaw },
    { data: doctorSharesRaw },
    { data: treatmentsRaw },
    { data: doctorPaymentsRaw },
    { data: monthlyPaymentTxRaw },
    { count: todayCount },
    { count: pendingCount },
    { data: todayAppts },
    { data: recentPatients },
    { count: untrustedCount },
    { data: overdueRaw },
    { count: severelyOverdueCount },
    { count: missingInvoiceCount },
    { data: activePatientsRaw },
    { data: recentApptPatientsRaw },
  ] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, name, color, specialty, commission_rate_bps, payment_model, monthly_salary, guarantee_amount, bonus_amount, per_transaction_amount, salary_day, payment_account, is_mesul_mudur, guarantee_active, guarantee_period, guarantee_method, guarantee_note')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('doctor_shares')
      .select('id, doctor_id, branch_id, rate_bps, start_date, end_date, is_active')
      .eq('clinic_id', clinicId)
      .eq('is_active', true),
    supabase
      .from('treatments')
      .select('id, fee, cost, doctor_id, patient_id, treatment_date, status, treatment_name')
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled')
      // Yalnızca bu ay (hakediş) veya açık durumdaki (devam eden hasta sayısı) tedaviler
      .or(`status.in.(planned,in_progress),and(treatment_date.gte.${monthStartISO},treatment_date.lt.${nextMonthStartISO})`),
    supabase
      .from('doctor_payments')
      .select('doctor_id, amount, payment_date, earning_period, payment_type')
      .eq('clinic_id', clinicId)
      .or(`earning_period.eq.${monthKey},and(earning_period.is.null,payment_date.gte.${monthStartISO},payment_date.lt.${nextMonthStartISO})`),
    supabase
      .from('transactions')
      .select('transaction_date, amount, type, patient_id, treatment_id, method, branch_id')
      .eq('clinic_id', clinicId)
      .gte('transaction_date', monthStartISO)
      .lt('transaction_date', nextMonthStartISO),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'pending'),
    supabase
      .from('appointments')
      .select('id, patient_id, scheduled_at, duration_min, status, treatment_note, patient:patients(name, surname), doctor:doctors(name, color)')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at')
      .limit(8)
      .overrideTypes<AppointmentRow[], { merge: false }>(),
    supabase
      .from('patients')
      .select('id, name, surname, birth_date, phone1, status')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('untrusted', true),
    supabase
      .from('payment_plans')
      .select('id, due_date, amount, patient:patients(id, name, surname)')
      .eq('clinic_id', clinicId)
      .eq('paid', false)
      .lt('due_date', todayISO)
      .order('due_date')
      .limit(10)
      .overrideTypes<OverduePlanRow[], { merge: false }>(),
    supabase
      .from('payment_plans')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('paid', false)
      .lt('due_date', overdue45ISO),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('type', 'payment')
      .is('invoice_no', null),
    supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .limit(1000),
    supabase
      .from('appointments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', staleCutoff.toISOString())
      .not('patient_id', 'is', null)
      .limit(2000),
  ])

  const doctors = (doctorsRaw ?? []) as DoctorRow[]
  const treatments = (treatmentsRaw ?? []) as TreatmentRow[]
  const appointments = todayAppts ?? []
  const patients = (recentPatients ?? []) as PatientRow[]
  const currentDoctor =
    doctors.find((d) => d.id === profile?.doctor_id) ??
    doctors.find((d) => normalizeName(profile?.full_name).includes(normalizeName(d.name))) ??
    null

  const scopedTreatments = currentDoctor
    ? treatments.filter((t) => t.doctor_id === currentDoctor.id)
    : []
  const ongoingPatientIds = new Set(
    scopedTreatments
      .filter((t) => ['planned', 'in_progress'].includes(t.status) && t.patient_id != null)
      .map((t) => t.patient_id as number)
  )

  const doctorShares = (doctorSharesRaw ?? []) as DoctorShareRow[]
  const profitByMonth: Record<string, number> = {}
  for (const tx of monthlyPaymentTxRaw ?? []) {
    if (!tx.branch_id) continue
    const signed = tx.type === 'payment' ? tx.amount : -tx.amount
    const key = `${tx.branch_id}:${monthKey}`
    profitByMonth[key] = (profitByMonth[key] ?? 0) + signed
  }

  const ownSummary = currentDoctor
    ? computeSummary(
        currentDoctor,
        doctorShares,
        scopedTreatments.map((t) => ({ ...t, fee: t.fee ?? 0, cost: t.cost ?? 0 })),
        [],
        monthlyPaymentTxRaw ?? [],
        (doctorPaymentsRaw ?? []).map((payment) => ({
          doctor_id: payment.doctor_id ?? 0,
          amount: payment.amount ?? 0,
          payment_date: payment.payment_date ?? '',
          earning_period: payment.earning_period,
          payment_type: payment.payment_type,
        })),
        monthKey,
        profitByMonth,
        doctors
      )
    : null

  const hakedisLabel = 'Hakedişim'
  const hakedisValue = Math.max(ownSummary?.remaining ?? 0, 0)

  const activePatientIds = new Set(((activePatientsRaw ?? []) as { id: number }[]).map((p) => p.id))
  const recentControlIds = new Set(
    ((recentApptPatientsRaw ?? []) as { patient_id: number | null }[])
      .map((a) => a.patient_id)
      .filter((id): id is number => id != null)
  )
  const staleControlCount = Array.from(activePatientIds).filter((id) => !recentControlIds.has(id)).length

  // Önümüzdeki 7 gün içinde tamamlanmamış takip adımları
  const sevenDaysLater = new Date(today)
  sevenDaysLater.setDate(today.getDate() + 7)
  const sevenDaysLaterISO = `${sevenDaysLater.getFullYear()}-${String(sevenDaysLater.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysLater.getDate()).padStart(2, '0')}`

  let upcomingFollowupCount = 0
  try {
    const { count } = await supabase
      .from('followup_steps')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .is('completed_at', null)
      .gte('scheduled_date', todayISO)
      .lte('scheduled_date', sevenDaysLaterISO)
    upcomingFollowupCount = count ?? 0
  } catch {
    // followup_steps tablosu henüz oluşturulmamış olabilir
  }

  // Fatura kontrolü penceresi: faturası eksik son ödemeler
  let missingInvoiceRows: MissingInvoiceRow[] = []
  if ((missingInvoiceCount ?? 0) > 0) {
    const { data: missingTx } = await supabase
      .from('transactions')
      .select('id, patient_id, amount, transaction_date, patient:patients(name, surname)')
      .eq('clinic_id', clinicId)
      .eq('type', 'payment')
      .is('invoice_no', null)
      .order('transaction_date', { ascending: false })
      .limit(30)
      .overrideTypes<{ id: number; patient_id: number | null; amount: number; transaction_date: string; patient: { name: string; surname: string } | null }[], { merge: false }>()
    missingInvoiceRows = (missingTx ?? []).map((t) => ({
      id: t.id,
      patient_id: t.patient_id,
      patient_name: t.patient ? `${t.patient.name} ${t.patient.surname}` : 'Hasta bilgisi yok',
      amount: t.amount,
      transaction_date: t.transaction_date,
    }))
  }

  const bellAppts = appointments.map((a) => ({
    id: a.id,
    patient_id: a.patient_id,
    scheduled_at: a.scheduled_at,
    patient_name: a.patient ? `${a.patient.name} ${a.patient.surname}` : '—',
  }))

  const bellPayments = (overdueRaw ?? []).map((p) => ({
    id: p.id,
    patient_id: p.patient?.id ?? null,
    due_date: p.due_date,
    amount: p.amount,
    patient_name: p.patient ? `${p.patient.name} ${p.patient.surname}` : '—',
  }))

  const dateLabel = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doktor'
  const attentionItems = [
    ...((severelyOverdueCount ?? 0) > 0
      ? [{ color: 'red' as const, title: '45+ gün geciken tahsilatlar', text: `${severelyOverdueCount ?? 0} taksit 45 günden uzun süredir gecikmiş. Öncelikli tahsilat listesini kontrol edin.`, topic: 'Tahsilat riski', href: '/finance?tab=bakiye' }]
      : []),
    ...((overdueRaw?.length ?? 0) > 0
      ? [{ color: 'red' as const, title: 'Ödeme zamanı geçen hastalar', text: `${overdueRaw?.length ?? 0} taksit için ödeme takibi gerekiyor.`, topic: 'Ödeme', href: '/finance?tab=bakiye' }]
      : []),
    ...((missingInvoiceCount ?? 0) > 0
      ? [{ title: 'Fatura kontrolü', node: <MissingInvoiceAlert count={missingInvoiceCount ?? 0} rows={missingInvoiceRows} /> }]
      : []),
    ...(staleControlCount > 0
      ? [{ color: 'blue' as const, title: 'Kontrol hatırlatması', text: `${staleControlCount} aktif hasta son 6 ayda randevuya gelmemiş.`, topic: 'Kontrol', href: '/patients' }]
      : []),
    ...((pendingCount ?? 0) > 0
      ? [{ color: 'yellow' as const, title: 'Onay bekleyen talepler', text: `${pendingCount} randevu talebi onay bekliyor.`, topic: 'Randevu', href: '/appointments?view=day&section=pending' }]
      : []),
    ...((untrustedCount ?? 0) > 0
      ? [{ color: 'red' as const, title: 'Riskli hasta notu', text: `${untrustedCount} hasta güvenilmez olarak işaretli.`, topic: 'Hasta', href: '/patients' }]
      : []),
    ...(upcomingFollowupCount > 0
      ? [{ color: 'blue' as const, title: 'Takip adımları yaklaşıyor', text: `${upcomingFollowupCount} takip adımının tarihi önümüzdeki 7 günde.`, topic: 'Takip', href: '/patients' }]
      : []),
  ]

  const [{ canView: canSeeFinans }, canSeeAyarlar] = await navPermsPromise

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile?.full_name ?? user.email ?? ''} role={profile?.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-8 pt-7 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2B3D]">Hoş geldiniz, Dt. {firstName}</h1>
            <p className="mt-0.5 text-sm text-gray-400">Klinik performans özetiniz aşağıda</p>
          </div>
          <div className="flex items-center gap-4">
            <DashboardBell pendingCount={pendingCount ?? 0} todayAppts={bellAppts} overduePayments={bellPayments} />
            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm text-gray-600">
              <IconCalendar />
              <span className="text-xs font-medium capitalize">{dateLabel}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              href="/appointments?view=day"
              label="Bugünkü Hastalar"
              value={todayCount ?? 0}
              detail={(todayCount ?? 0) === 0 ? 'Bugün için kayıtlı randevu yok' : 'Bugünkü randevu sayısı'}
              tone="teal"
              icon={<IconPeople />}
            />
            <KpiCard
              href="/appointments?view=day&section=pending"
              label="Onay Bekleyen Talepler"
              value={pendingCount ?? 0}
              detail={(pendingCount ?? 0) === 0 ? 'Online randevu talebi yok' : 'Onay bekleyen online talep'}
              tone="amber"
              icon={<IconClock />}
            />
            <KpiCard
              href="/finance?tab=hakedis"
              label={hakedisLabel}
              value={`₺${fmt(hakedisValue)}`}
              detail={currentDoctor ? 'Bu ay kişisel net hakedişiniz' : 'Hekim hesabıyla eşleşme yok'}
              tone="purple"
              icon={<IconLiraTile />}
            />
            <KpiCard
              href="/patients?tab=liste&filter=ongoing"
              label="Devam Eden Tedaviler"
              value={ongoingPatientIds.size}
              detail="Aktif tedavi planı bulunan hastalar"
              tone="blue"
              icon={<IconToothTile />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <section className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] xl:col-span-3">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0F2B3D]">Bugünkü Randevular</h2>
                  <p className="text-xs text-gray-400">Günlük takvimin mini görünümü</p>
                </div>
                <Link href="/appointments?view=day" className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#E7ECF2] bg-white px-3 py-2 text-xs font-semibold text-[#0F2B3D] shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:border-[#2DD4BF]/50 hover:bg-[#E9FBF8]">
                  <IconCalendar />
                  Günlüğe Git
                </Link>
              </div>

              {appointments.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center px-4 py-8 text-center">
                  <CalendarEmptyIllustration />
                  <h3 className="mt-5 max-w-md text-lg font-bold text-[#0F2B3D]">Bugün için planlanmış randevu bulunmuyor.</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Yeni bir randevu oluşturabilir veya takviminizi görüntüleyebilirsiniz.</p>
                  <Link href="/appointments?action=new" className="mt-6 inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-[#7DE2D1] to-[#2DD4BF] px-4 py-3 text-sm font-bold text-[#0F2B3D] shadow-[0_12px_24px_rgba(45,212,191,0.24)] transition hover:-translate-y-0.5 hover:from-[#69d9c7] hover:to-[#22c7b2]">
                    <IconPlus />
                    Randevu Oluştur
                  </Link>
                </div>
              ) : (
                <div className="relative space-y-3 border-l-2 border-[#2DD4BF]/25 pl-5">
                  {appointments.map((appt) => <ApptRow key={appt.id} appt={appt} />)}
                </div>
              )}
            </section>

            <section className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] xl:col-span-2">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0F2B3D]">Son Hastalar</h2>
                  <p className="text-xs text-gray-400">Yeni kayıtlar</p>
                </div>
                <DashboardNewPatientButton />
              </div>

              {patients.length === 0 ? (
                <p className="rounded-[18px] border border-[#EEF2F6] bg-slate-50/60 px-4 py-10 text-center text-sm text-gray-400">Henüz hasta kaydı yok.</p>
              ) : (
                <div className="space-y-3">
                  {patients.map((p) => (
                    <Link key={p.id} href={`/patients?patient_id=${p.id}`} className="group flex items-center gap-3 rounded-[18px] border border-[#EEF2F6] bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E1F8F4] text-sm font-black text-[#1E7C72]">
                        {initials(p.name, p.surname)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0F2B3D]">{p.name} {p.surname}</p>
                        <p className="truncate text-xs text-gray-400">{p.phone1 ?? 'Telefon bilgisi eksik'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-400">
                        <span>{calcAge(p.birth_date) ?? '—'} yaş</span>
                        <IconMoreVertical />
                      </div>
                    </Link>
                  ))}
                  <Link href="/patients" className="inline-flex items-center gap-1 pt-2 text-xs font-bold text-[#1E9E90] transition hover:text-[#0F766E] hover:underline">
                    Tüm hastaları görüntüle
                    <IconMiniChevronRight />
                  </Link>
                </div>
              )}
            </section>
          </div>

          <section className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <IconBell />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#0F2B3D]">Dikkat Gerekenler</h2>
                  <p className="text-xs text-gray-400">Takip edilmesi gereken işlemler</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">{attentionItems.length} uyarı</span>
            </div>

            {attentionItems.length === 0 ? (
              <p className="rounded-[16px] border border-[#EEF2F6] bg-slate-50/70 px-4 py-5 text-sm text-gray-400">Dikkat gerektiren bir durum yok.</p>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item) => ('node' in item ? <div key={item.title}>{item.node}</div> : <AlertItem key={item.title} {...item} />))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function KpiCard({ href, label, value, detail, icon, tone }: {
  href: string
  label: string
  value: number | string
  detail: string
  icon: React.ReactNode
  tone: 'teal' | 'amber' | 'purple' | 'blue'
}) {
  const iconClass = {
    teal: 'from-[#7DE2D1] to-[#2DD4BF] shadow-[#2DD4BF]/25',
    amber: 'from-[#FCD34D] to-[#F59E0B] shadow-[#F59E0B]/25',
    purple: 'from-[#8B5CF6] to-[#5B3DF5] shadow-[#6D5DF6]/25',
    blue: 'from-[#60A5FA] to-[#3B82F6] shadow-[#3B82F6]/25',
  }[tone]

  return (
    <Link href={href} className="group relative min-h-[190px] overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-gradient-to-br from-slate-100 to-transparent opacity-80 transition duration-300 group-hover:scale-110"
      />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${iconClass}`}>{icon}</div>
        <IconChevronRight />
      </div>
      <div className="relative z-10 mt-7 max-w-[88%]">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="mt-3 text-4xl font-black tracking-normal text-[#0F2B3D]">{value}</p>
        <p className="mt-5 text-sm font-medium leading-6 text-slate-500 group-hover:text-[#0F2B3D]">{detail}</p>
      </div>
    </Link>
  )
}

function ApptRow({ appt }: { appt: AppointmentRow }) {
  const start = new Date(appt.scheduled_at)
  const time = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const name = appt.patient ? `${appt.patient.name} ${appt.patient.surname}` : '—'
  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Onay bekliyor', cls: 'bg-yellow-100 text-yellow-700' },
    scheduled: { label: 'Planlandı', cls: 'bg-[#2DD4BF]/15 text-[#0F2B3D]' },
    done: { label: 'Tamamlandı', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'İptal', cls: 'bg-red-100 text-red-600' },
    no_show: { label: 'Gelmedi', cls: 'bg-gray-100 text-gray-500' },
  }
  const status = statusMap[appt.status] ?? { label: appt.status, cls: 'bg-gray-100 text-gray-500' }

  return (
    <div className="relative rounded-xl border border-gray-100 px-4 py-3">
      <span className="absolute -left-[30px] top-5 h-3 w-3 rounded-full border-2 border-white bg-[#2DD4BF]" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#0F2B3D]">{time} · {name}</p>
          <p className="truncate text-xs text-gray-400">{appt.doctor?.name ? `Dt. ${appt.doctor.name}` : 'Hekim yok'} · {appt.treatment_note ?? `${appt.duration_min} dk`}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>
    </div>
  )
}

function AlertItem({
  color,
  title,
  text,
  topic,
  href,
}: {
  color: 'yellow' | 'red' | 'blue'
  title: string
  text: string
  topic: string
  href?: string
}) {
  const tagCls = {
    yellow: 'bg-[#FFF3D8] text-[#B76B00]',
    red: 'bg-[#FFE2E2] text-[#DC2626]',
    blue: 'bg-[#E7F0FF] text-[#2563EB]',
  }[color]
  const iconWrapCls = {
    yellow: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  }[color]
  const icon = color === 'yellow'
    ? <IconFileText />
    : color === 'blue'
      ? <IconClipboardCheck />
      : <IconShieldAlert />

  const content = (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-[#EEF2F6] bg-white px-4 py-3 text-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:grid-cols-[auto_1fr_auto_auto]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrapCls}`}>{icon}</span>
      <div className="min-w-0">
        <p className="font-bold text-[#0F2B3D]">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-gray-500">{text}</p>
      </div>
      <span className={`col-start-2 w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:col-start-auto ${tagCls}`}>
        {topic}
      </span>
      <span className="hidden text-slate-300 sm:block"><IconMiniChevronRight /></span>
    </div>
  )

  if (!href) return content
  return <Link href={href}>{content}</Link>
}

function initials(name: string, surname: string): string {
  return `${name.trim().charAt(0)}${surname.trim().charAt(0)}`.toLocaleUpperCase('tr-TR')
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
}
function IconChevronRight() {
  return <svg className="mt-1 text-[#0F2B3D] transition-transform duration-200 group-hover:translate-x-0.5" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
}
function IconMiniChevronRight() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
}
function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}
function IconMoreVertical() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
}
function IconBell() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8a6 6 0 0 0-12 0c0 4.499-1.411 5.956-2.738 7.326" /></svg>
}
function IconFileText() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
}
function IconClipboardCheck() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></svg>
}
function IconShieldAlert() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
}
function IconPeople() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function IconClock() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}

function IconLiraTile() {
  return (
    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#8E7BFF] via-[#745DF5] to-[#5439E8] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)]">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.34),transparent_34%)]" />
      <span className="relative -mt-0.5 font-serif text-[30px] font-normal leading-none text-white drop-shadow-[0_2px_3px_rgba(45,29,140,0.24)]">₺</span>
    </span>
  )
}

function IconToothTile() {
  return (
    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#76B7FF] via-[#4F8EF4] to-[#3578E5] shadow-[inset_0_1px_2px_rgba(255,255,255,0.42)]">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.32),transparent_34%)]" />
      <svg className="relative drop-shadow-[0_2px_3px_rgba(27,78,169,0.22)]" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path
          d="M14 7.24c-1.5-1.02-3.38-1.37-5.05-.43-2.05 1.16-2.62 3.72-1.94 6.17.34 1.24.86 2.26 1.19 3.63.44 1.82.73 4.08 1.94 4.08.82 0 1.12-1.06 1.5-2.43.43-1.56 1.02-3.28 2.36-3.28s1.93 1.72 2.36 3.28c.38 1.37.68 2.43 1.5 2.43 1.21 0 1.5-2.26 1.94-4.08.33-1.37.85-2.39 1.19-3.63.68-2.45.11-5.01-1.94-6.17-1.67-.94-3.55-.59-5.05.43Z"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.35"
        />
      </svg>
    </span>
  )
}

function CalendarEmptyIllustration() {
  return (
    <svg className="h-[132px] w-[168px] opacity-90" viewBox="0 0 168 132" fill="none" aria-hidden="true">
      <ellipse cx="84" cy="116" rx="58" ry="10" fill="#DDE7F1" opacity="0.7" />
      <rect x="30" y="23" width="108" height="84" rx="20" fill="#FFFFFF" stroke="#DDE7F1" strokeWidth="2" />
      <path d="M30 45C30 32.85 39.85 23 52 23H116C128.15 23 138 32.85 138 45V51H30V45Z" fill="#2DD4BF" />
      <rect x="53" y="14" width="10" height="22" rx="5" fill="#0F766E" />
      <rect x="105" y="14" width="10" height="22" rx="5" fill="#0F766E" />
      <rect x="50" y="65" width="16" height="14" rx="4" fill="#E1F8F4" />
      <rect x="76" y="65" width="16" height="14" rx="4" fill="#E1F8F4" />
      <rect x="102" y="65" width="16" height="14" rx="4" fill="#E1F8F4" />
      <rect x="50" y="87" width="16" height="14" rx="4" fill="#E1F8F4" />
      <rect x="76" y="87" width="16" height="14" rx="4" fill="#D8F3EE" />
      <circle cx="121" cy="91" r="22" fill="#F0FDFA" stroke="#99F6E4" strokeWidth="2" />
      <path d="M111 91.5L118 98L132 82" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="70" r="8" fill="#FDE68A" opacity="0.8" />
      <circle cx="136" cy="35" r="6" fill="#BFDBFE" opacity="0.9" />
    </svg>
  )
}
