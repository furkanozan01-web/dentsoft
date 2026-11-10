/**
 * Hakediş hesaplama mantığı — saf TypeScript, 'use client'/'use server' yok.
 * EarningsDashboard (client) ve getHekimHakedis server action bu dosyayı import eder.
 * Hesaplama mantığı burada TEK yerde yaşar; iki farklı rakam riski sıfır.
 *
 * Yuvarlama kuralı: Her ara adımda Math.round() — kuruş hassasiyeti, float hatası yok.
 * Orantılı tahsilat dağılımı: FIFO değil, ağırlıklı (proportional allocation).
 */

// ─── Girdi tipleri (FinanceClient.tsx tipleriyle yapısal olarak uyumlu) ────────

export interface HakedisDoctor {
  id: number
  name: string
  color: string | null
  specialty: string | null
  commission_rate_bps: number | null
  payment_model: string | null
  monthly_salary: number | null
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

export interface HakedisDoctorShare {
  id: number
  doctor_id: number
  branch_id: number
  rate_bps: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

export interface HakedisTreatment {
  id: number
  treatment_date: string | null
  fee: number
  cost: number
  doctor_id: number | null
  status: string
  treatment_name: string
  patient_id: number | null
}

export interface HakedisTx {
  transaction_date: string
  amount: number
  type: string
  patient_id: number | null
  treatment_id: number | null
  method?: string | null
  branch_id?: number | null
}

export interface HakedisPatient {
  id: number
  name: string
  surname: string
}

export interface HakedisDoctorPayment {
  doctor_id: number
  amount: number
  payment_date: string
  earning_period?: string | null
}

// ─── Çıktı tipleri ────────────────────────────────────────────────────────────

export interface DetailRow {
  id: number
  patientId: number | null
  firstName: string
  surname: string
  treatmentDate: string | null
  treatment: string
  collectionDate: string | null
  paymentMethod: string | null
  treatmentAmount: number
  collected: number
  gross: number
  cost: number
  net: number
  rate: number
  bonus: number
  earning: number
  status: string
  description: string
}

export interface DoctorSummary {
  doctor: HakedisDoctor
  details: DetailRow[]
  gross: number
  cost: number
  net: number
  bonus: number
  entitlement: number
  paid: number
  remaining: number
  rate: number
  completedCount: number
  fixedAmount: number
  commissionAmount: number
  guaranteeCompletion: number
  clinicNetProfit: number
  profitShare: number
  shareRate: number
}

// ─── Ana hesaplama fonksiyonu ─────────────────────────────────────────────────

/**
 * @param doctor   - Hesaplama yapılacak hekim
 * @param shares   - Kliniğin tüm hekim hisseleri (fonksiyon içinde doctor.id filtresi uygular; her satırın kendi branch_id'si var)
 * @param treatments - Kliniğin tüm tedavileri (fonksiyon içinde doctor.id + monthKey filtresi uygular)
 * @param patients - Kliniğin tüm hastaları
 * @param txs      - Kliniğin tüm işlemleri (payment tipindekiler kullanılır)
 * @param payments - Tüm hekim ödemeleri
 * @param monthKey - 'YYYY-MM' formatında ay (örn. '2026-06')
 * @param profitByMonth - `${branch_id}:${monthKey}` anahtarlı şube net kâr tablosu (bkz. finance/page.tsx)
 */
export function computeSummary(
  doctor: HakedisDoctor,
  shares: HakedisDoctorShare[],
  treatments: HakedisTreatment[],
  patients: HakedisPatient[],
  txs: HakedisTx[],
  payments: HakedisDoctorPayment[],
  monthKey: string,
  profitByMonth: Record<string, number>
): DoctorSummary {
  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const periodTreatments = treatments.filter(
    (t) => t.doctor_id === doctor.id && t.treatment_date?.startsWith(monthKey)
  )
  const completedTreatments = periodTreatments.filter((t) => t.status === 'completed')
  const completedCount = completedTreatments.length
  const rate = doctor.commission_rate_bps ?? 0
  const bonusPool = doctor.bonus_amount ?? 0
  const baseBonus = completedCount > 0 ? Math.floor(bonusPool / completedCount) : 0
  const bonusRemainder = completedCount > 0 ? bonusPool % completedCount : 0

  const details = periodTreatments.map((treatment): DetailRow => {
    const patient = treatment.patient_id ? patientMap.get(treatment.patient_id) : null
    // Orantılı tahsilat: hastanın o aydaki tüm tedavileri üzerinden dağıtım
    const patientTreatments = treatment.patient_id == null
      ? [treatment]
      : treatments.filter(
          (t) => t.patient_id === treatment.patient_id && t.treatment_date?.startsWith(monthKey)
        )
    const totalPatientFee = patientTreatments.reduce((s, t) => s + (t.fee ?? 0), 0)
    const patientPayments = txs.filter(
      (tx) =>
        tx.type === 'payment' &&
        (tx.treatment_id === treatment.id ||
          (treatment.patient_id != null && tx.patient_id === treatment.patient_id)) &&
        tx.transaction_date.startsWith(monthKey)
    )
    const exactPayments = patientPayments.filter((tx) => tx.treatment_id === treatment.id)
    const unlinkedPayments = treatment.patient_id == null
      ? []
      : patientPayments.filter((tx) => tx.treatment_id == null)
    const exactCollected = exactPayments.reduce((s, tx) => s + tx.amount, 0)
    const unlinkedPatientCollected = unlinkedPayments.reduce((s, tx) => s + tx.amount, 0)
    const proportionalCollected = totalPatientFee > 0
      ? Math.round(unlinkedPatientCollected * ((treatment.fee ?? 0) / totalPatientFee))
      : 0
    const collected = Math.min(treatment.fee ?? 0, exactCollected + proportionalCollected)

    const gross = collected
    const cost = treatment.cost ?? 0
    const net = Math.max(gross - cost, 0)
    const completedIndex = treatment.status === 'completed'
      ? completedTreatments.findIndex((item) => item.id === treatment.id)
      : -1
    const bonus =
      completedIndex >= 0
        ? baseBonus + (completedIndex < bonusRemainder ? 1 : 0)
        : 0

    const earning = rate > 0 ? Math.round((gross * rate) / 10000) : 0

    const relevantPayments = [...exactPayments, ...unlinkedPayments]
    const latestCollection = relevantPayments.sort((a, b) =>
      a.transaction_date.localeCompare(b.transaction_date)
    ).at(-1)
    const collectionDate = latestCollection?.transaction_date ?? null

    return {
      id: treatment.id,
      patientId: treatment.patient_id,
      firstName: patient?.name ?? 'Hasta',
      surname: patient?.surname ?? '',
      treatmentDate: treatment.treatment_date,
      treatment: treatment.treatment_name,
      collectionDate,
      paymentMethod: latestCollection?.method ?? null,
      treatmentAmount: treatment.fee ?? 0,
      collected,
      gross,
      cost,
      net,
      rate,
      bonus,
      earning,
      status: collected > 0 ? 'Tahsil edildi' : 'Tahsilat bekliyor',
      description:
        treatment.status === 'completed'
          ? 'İşlem tamamlandı'
          : treatment.status === 'in_progress'
          ? 'Tedavi devam ediyor'
          : 'Planlandı',
    }
  })

  const gross = details.reduce((s, r) => s + r.gross, 0)
  const cost = details.reduce((s, r) => s + r.cost, 0)
  const net = details.reduce((s, r) => s + r.net, 0)
  const detailBonus = details.reduce((s, r) => s + r.bonus, 0)
  const variable = details.reduce((s, r) => s + r.earning, 0)

  const currentMonth = new Date().toLocaleDateString('en-CA').slice(0, 7)
  const fixedDue = monthKey < currentMonth || (
    monthKey === currentMonth && (!doctor.salary_day || new Date().getDate() >= doctor.salary_day)
  )
  const fixedAmount = fixedDue ? (doctor.monthly_salary ?? 0) : 0
  const periodBonus = fixedDue ? (doctor.bonus_amount ?? 0) : 0
  const calculatedBeforeGuarantee = fixedAmount + variable + periodBonus
  const guaranteeBase = doctor.guarantee_method === 'commission_only'
    ? variable + periodBonus
    : calculatedBeforeGuarantee
  const guaranteeCompletion = doctor.guarantee_active && fixedDue
    ? Math.max((doctor.guarantee_amount ?? 0) - guaranteeBase, 0)
    : 0

  const monthStart = `${monthKey}-01`
  const monthEnd = `${monthKey}-31`
  const activeShares = shares.filter((s) =>
    s.doctor_id === doctor.id && s.is_active &&
    (!s.start_date || s.start_date <= monthEnd) && (!s.end_date || s.end_date >= monthStart)
  )
  let profitShare = 0
  let clinicNetProfit = 0
  for (const share of activeShares) {
    const branchProfit = Math.max(profitByMonth[`${share.branch_id}:${monthKey}`] ?? 0, 0)
    clinicNetProfit += branchProfit
    profitShare += Math.round((branchProfit * share.rate_bps) / 10000)
  }
  const entitlement = calculatedBeforeGuarantee + guaranteeCompletion + profitShare

  const paid = payments
    .filter((p) => p.doctor_id === doctor.id && (p.earning_period ?? p.payment_date.slice(0, 7)) === monthKey)
    .reduce((s, p) => s + p.amount, 0)

  return {
    doctor,
    details,
    gross,
    cost,
    net,
    bonus: periodBonus || detailBonus,
    entitlement,
    paid,
    remaining: entitlement - paid,
    rate,
    completedCount,
    fixedAmount,
    commissionAmount: variable,
    guaranteeCompletion,
    clinicNetProfit,
    profitShare,
    shareRate: activeShares.reduce((s, sh) => s + sh.rate_bps, 0),
  }
}
