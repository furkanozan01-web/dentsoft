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
  /** 'kar_payi' = kâr dağıtımı (hakediş giderine sayılmaz) */
  payment_type?: string | null
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
  const completedTreatments = periodTreatments.filter((t) => t.status === 'done')
  const completedCount = completedTreatments.length
  const rate = doctor.commission_rate_bps ?? 0
  // Prim kaldırıldı: hekim üç kalemden alır: sabit maaş, kâr payı (hisse), komisyon. Komisyon masraf düşüldükten sonraki kâr üzerinden hesaplanır.

  // ── Komisyon: ALINAN PARAYA göre (işin yapıldığı aya bakılmaz) ──
  // O ay alınan ödeme, hastanın tüm (iptal olmayan) işleri üzerinden hekimlere iş payı oranında dağıtılır.
  // Hekim, kendi payının komisyon oranını alır; masraf, tahsil edilen oranda düşülür.
  // Hastanın toplam ücretini aşan ödeme (alacak) hakediş doğurmaz.
  const firstOfMonth = `${monthKey}-01`
  const inMonth = (date: string) => date.startsWith(monthKey)
  const payTxs = txs.filter((tx) => tx.type === 'payment' && tx.patient_id != null)
  const patientIds = new Set<number>()
  for (const tx of payTxs) if (inMonth(tx.transaction_date)) patientIds.add(tx.patient_id as number)
  for (const t of periodTreatments) if (t.patient_id != null) patientIds.add(t.patient_id)

  const collectedBy = new Map<number, number>() // tedavi id -> bu ay tahsil edilen (kuruş)
  const lastCollection = new Map<number, { date: string; method: string | null }>() // hasta -> son tahsilat
  for (const pid of patientIds) {
    const pTreatments = treatments.filter((t) => t.patient_id === pid)
    const totalFee = pTreatments.reduce((s, t) => s + (t.fee ?? 0), 0)
    if (totalFee <= 0) continue
    const pPays = payTxs.filter((tx) => tx.patient_id === pid)
    const monthPays = pPays.filter((tx) => inMonth(tx.transaction_date))
    if (monthPays.length === 0) continue
    const priorPaid = pPays.filter((tx) => tx.transaction_date < firstOfMonth).reduce((s, tx) => s + tx.amount, 0)
    const capacity = Math.max(totalFee - priorPaid, 0)
    const linked = monthPays.filter((tx) => tx.treatment_id != null)
    const unlinkedTotal = monthPays.filter((tx) => tx.treatment_id == null).reduce((s, tx) => s + tx.amount, 0)
    const pool = Math.min(unlinkedTotal, capacity)
    for (const tr of pTreatments) {
      const fromPool = Math.round((pool * (tr.fee ?? 0)) / totalFee)
      const fromLinked = linked.filter((tx) => tx.treatment_id === tr.id).reduce((s, tx) => s + tx.amount, 0)
      const value = Math.min(tr.fee ?? 0, fromPool + fromLinked)
      if (value > 0) collectedBy.set(tr.id, value)
    }
    const latest = [...monthPays].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)).at(-1)
    if (latest) lastCollection.set(pid, { date: latest.transaction_date, method: latest.method ?? null })
  }

  // Satırlar: bu hekimin, o ay tahsilat alan tedavileri + o ay yapılan (henüz tahsilatı olmayan) tedavileri
  const periodIds = new Set(periodTreatments.map((t) => t.id))
  const doctorRows = treatments.filter(
    (t) => t.doctor_id === doctor.id && (periodIds.has(t.id) || (collectedBy.get(t.id) ?? 0) > 0)
  )
  const details = doctorRows.map((treatment): DetailRow => {
    const patient = treatment.patient_id ? patientMap.get(treatment.patient_id) : null
    const treatmentFee = treatment.fee ?? 0
    const collected = collectedBy.get(treatment.id) ?? 0
    const gross = collected
    // Masraf (lab, malzeme): tahsil edilen oranda düşülür; komisyon kalan kâr üzerinden hesaplanır
    const cost = treatmentFee > 0 ? Math.round((treatment.cost ?? 0) * (collected / treatmentFee)) : 0
    const net = Math.max(gross - cost, 0)
    const earning = rate > 0 ? Math.round((net * rate) / 10000) : 0
    const collection = treatment.patient_id != null ? lastCollection.get(treatment.patient_id) : undefined

    return {
      id: treatment.id,
      patientId: treatment.patient_id,
      firstName: patient?.name ?? 'Hasta',
      surname: patient?.surname ?? '',
      treatmentDate: treatment.treatment_date,
      treatment: treatment.treatment_name,
      collectionDate: collected > 0 ? collection?.date ?? null : null,
      paymentMethod: collected > 0 ? collection?.method ?? null : null,
      treatmentAmount: treatmentFee,
      collected,
      gross,
      cost,
      net,
      rate,
      bonus: 0,
      earning,
      status: collected > 0 ? 'Tahsil edildi' : 'Tahsilat bekliyor',
      description:
        treatment.status === 'done'
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
  const periodBonus = 0 // prim yok
  const calculatedBeforeGuarantee = fixedAmount + variable + periodBonus
  const guaranteeBase = doctor.guarantee_method === 'commission_only'
    ? variable + periodBonus
    : calculatedBeforeGuarantee
  const guaranteeCompletion = doctor.guarantee_active && fixedDue
    ? Math.max((doctor.guarantee_amount ?? 0) - guaranteeBase, 0)
    : 0

  // Kâr payı HAKEDİŞE DAHİL DEĞİLDİR: hakediş yalnızca yapılan işten komisyon + sabit maaş/prim/garantidir.
  // Kâr payı, Kasa > "Kâr Payı Öde" ile kasadan hissedarlara hisse oranında dağıtılır (doctor_payments.payment_type='kar_payi').
  // Burada yalnızca bilgi olarak o dönemde dağıtılan tutar ve hisse oranı gösterilir.
  const monthStart = `${monthKey}-01`
  const monthEnd = `${monthKey}-31`
  const activeShares = shares.filter((s) =>
    s.doctor_id === doctor.id && s.is_active &&
    (!s.start_date || s.start_date <= monthEnd) && (!s.end_date || s.end_date >= monthStart)
  )
  const isProfitPayment = (p: HakedisDoctorPayment) => p.payment_type === 'kar_payi'
  const inPeriod = (p: HakedisDoctorPayment) => (p.earning_period ?? p.payment_date.slice(0, 7)) === monthKey
  const profitShare = payments
    .filter((p) => p.doctor_id === doctor.id && isProfitPayment(p) && inPeriod(p))
    .reduce((sum, p) => sum + p.amount, 0)
  void profitByMonth // kâr payı hakedişe girmez; parametre uyumluluk için duruyor
  const clinicNetProfit = 0
  const entitlement = calculatedBeforeGuarantee + guaranteeCompletion

  const paid = payments
    .filter((p) => p.doctor_id === doctor.id && !isProfitPayment(p) && inPeriod(p))
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
