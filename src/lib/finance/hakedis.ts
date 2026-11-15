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
  /** Göreve başlama tarihi: sabit maaş birikimi bu tarihten başlar (boşsa bu aydan) */
  start_date?: string | null
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
  /** Fatura bilgisi: KDV masrafı yalnızca fatura kesilen tutar için, fatura tarihinde düşülür */
  invoice_no?: string | null
  invoice_amount?: number | null
  invoice_sent_at?: string | null
  invoice_vat_rate?: number | null
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
  /** Masrafın içindeki KDV (dönemde kesilen faturaların KDV payı) */
  vat: number
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
  /** Garantör sistemde, dönemdeki garanti tutarı (aylık garanti × kapsanan ay) */
  guaranteeAmount: number
}

// ─── Tarih yardımcıları ───────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0')
const lastDayOf = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
const monthFirst = (key: string) => `${key}-01`
const monthLast = (key: string) => `${key}-${pad2(lastDayOf(key))}`
const localToday = () => new Date().toLocaleDateString('en-CA')

/** Aralıkla kesişen ay anahtarları ('YYYY-MM'), eskiden yeniye */
function monthsOverlapping(startISO: string, endISO: string): string[] {
  const keys: string[] = []
  let y = Number(startISO.slice(0, 4))
  let m = Number(startISO.slice(5, 7))
  const endKey = endISO.slice(0, 7)
  for (let guard = 0; guard < 2400; guard++) {
    const key = `${y}-${pad2(m)}`
    if (key > endKey) break
    keys.push(key)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return keys
}

// ─── Çekirdek: bir tarih aralığında alınan paraya göre komisyon ───────────────

/**
 * Komisyon: ALINAN PARAYA göre (işin yapıldığı tarihe bakılmaz).
 * Aralıkta alınan ödeme, hastanın tüm (iptal olmayan) işleri üzerinden hekimlere iş payı oranında dağıtılır.
 * Hekim, kendi payının komisyon oranını alır; masraf (lab/malzeme + KDV) tahsil edilen oranda düşülür.
 * Hastanın toplam ücretini aşan ödeme (alacak) hakediş doğurmaz.
 */
function commissionCore(
  doctor: HakedisDoctor,
  treatments: HakedisTreatment[],
  patients: HakedisPatient[],
  txs: HakedisTx[],
  startISO: string,
  endISO: string,
  vatBps: number
) {
  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const rate = doctor.commission_rate_bps ?? 0
  const inRange = (date: string) => date >= startISO && date <= endISO
  const periodTreatments = treatments.filter(
    (t) => t.doctor_id === doctor.id && t.treatment_date != null && inRange(t.treatment_date.slice(0, 10))
  )

  const payTxs = txs.filter((tx) => tx.type === 'payment' && tx.patient_id != null)
  const patientIds = new Set<number>()
  for (const tx of payTxs) if (inRange(tx.transaction_date)) patientIds.add(tx.patient_id as number)
  for (const t of periodTreatments) if (t.patient_id != null) patientIds.add(t.patient_id)

  const collectedBy = new Map<number, number>() // tedavi id -> aralıkta tahsil edilen (kuruş)
  const lastCollection = new Map<number, { date: string; method: string | null }>() // hasta -> son tahsilat
  for (const pid of patientIds) {
    const pTreatments = treatments.filter((t) => t.patient_id === pid)
    const totalFee = pTreatments.reduce((s, t) => s + (t.fee ?? 0), 0)
    if (totalFee <= 0) continue
    const pPays = payTxs.filter((tx) => tx.patient_id === pid)
    const rangePays = pPays.filter((tx) => inRange(tx.transaction_date))
    if (rangePays.length === 0) continue
    const priorPaid = pPays.filter((tx) => tx.transaction_date < startISO).reduce((s, tx) => s + tx.amount, 0)
    const capacity = Math.max(totalFee - priorPaid, 0)
    const linked = rangePays.filter((tx) => tx.treatment_id != null)
    const unlinkedTotal = rangePays.filter((tx) => tx.treatment_id == null).reduce((s, tx) => s + tx.amount, 0)
    const pool = Math.min(unlinkedTotal, capacity)
    for (const tr of pTreatments) {
      const fromPool = Math.round((pool * (tr.fee ?? 0)) / totalFee)
      const fromLinked = linked.filter((tx) => tx.treatment_id === tr.id).reduce((s, tx) => s + tx.amount, 0)
      const value = Math.min(tr.fee ?? 0, fromPool + fromLinked)
      if (value > 0) collectedBy.set(tr.id, value)
    }
    const latest = [...rangePays].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)).at(-1)
    if (latest) lastCollection.set(pid, { date: latest.transaction_date, method: latest.method ?? null })
  }

  // KDV: ücret alınır alınmaz değil, FATURA KESİLDİKTEN sonra (fatura tarihinin düştüğü dönemde) ve yalnızca
  // faturalanan tutar üzerinden masraf sayılır. Bir fatura birden çok ödemeyi kapsar; tutar her satırda aynı
  // yazıldığından fatura numarasına göre bir kez alınır. Hastanın tedavilerine ücret payı oranında dağıtılır.
  const vatBy = new Map<number, number>() // tedavi id -> aralıkta düşülecek KDV (kuruş)
  if (vatBps > 0) {
    const invoices = new Map<string, { patientId: number; amount: number; date: string; bps: number }>()
    for (const tx of payTxs) {
      if (!tx.invoice_no) continue
      const key = tx.patient_id + '|' + tx.invoice_no
      const sentDate = tx.invoice_sent_at
        ? new Date(tx.invoice_sent_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
        : tx.transaction_date
      const prev = invoices.get(key)
      if (prev) {
        if (tx.invoice_amount == null) prev.amount += tx.amount
      } else {
        invoices.set(key, {
          patientId: tx.patient_id as number,
          amount: tx.invoice_amount ?? tx.amount,
          date: sentDate,
          bps: tx.invoice_vat_rate ?? vatBps,
        })
      }
    }
    const vatByPatient = new Map<number, number>()
    for (const inv of invoices.values()) {
      if (!inRange(inv.date) || inv.bps <= 0) continue
      const v = Math.round((inv.amount * inv.bps) / (10000 + inv.bps))
      vatByPatient.set(inv.patientId, (vatByPatient.get(inv.patientId) ?? 0) + v)
    }
    for (const [pid, v] of vatByPatient) {
      const pTreatments = treatments.filter((t) => t.patient_id === pid)
      const totalFee = pTreatments.reduce((s, t) => s + (t.fee ?? 0), 0)
      if (totalFee <= 0) continue
      for (const tr of pTreatments) {
        const part = Math.round((v * (tr.fee ?? 0)) / totalFee)
        if (part > 0) vatBy.set(tr.id, part)
      }
    }
  }

  // Satırlar: bu hekimin, aralıkta tahsilat alan / KDV düşülen tedavileri + aralıkta yapılan (henüz tahsilatı olmayan) tedavileri
  const periodIds = new Set(periodTreatments.map((t) => t.id))
  const doctorRows = treatments.filter(
    (t) => t.doctor_id === doctor.id && (periodIds.has(t.id) || (collectedBy.get(t.id) ?? 0) > 0 || (vatBy.get(t.id) ?? 0) > 0)
  )
  const details = doctorRows.map((treatment): DetailRow => {
    const patient = treatment.patient_id ? patientMap.get(treatment.patient_id) : null
    const treatmentFee = treatment.fee ?? 0
    const collected = collectedBy.get(treatment.id) ?? 0
    const gross = collected
    // Masraf = lab/malzeme (tahsil edilen oranda) + KDV (yalnızca kesilen faturanın KDV'si; fatura döneminde düşer).
    const materialCost = treatmentFee > 0 ? Math.round((treatment.cost ?? 0) * (collected / treatmentFee)) : 0
    const vat = vatBy.get(treatment.id) ?? 0
    const cost = materialCost + vat
    const net = Math.max(gross - materialCost, 0) - vat
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
      vat,
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

  return {
    details,
    periodTreatments,
    gross: details.reduce((s, r) => s + r.gross, 0),
    cost: details.reduce((s, r) => s + r.cost, 0),
    net: details.reduce((s, r) => s + r.net, 0),
    variable: details.reduce((s, r) => s + r.earning, 0),
    rate,
  }
}

// ─── Ana hesaplama: tarih aralığı ─────────────────────────────────────────────

/**
 * Bir tarih aralığı için hakediş (gün, hafta, ay, yıl veya serbest aralık).
 *
 * - Komisyon: aralıkta ALINAN paraya göre (bkz. commissionCore).
 * - Sabit maaş: maaş günü (boşsa ayın 1'i) aralığa düşen her ay için bir kez, tam tutar. Birikim,
 *   hekimin "göreve başlama tarihinden" başlar (boşsa içinde bulunulan aydan). Maaş günü gelmemişse sayılmaz.
 * - Garanti tamamlama: ayın tamamı aralıktaysa (veya aralık bu ayın başından bugüne kadarsa) aylık hesaplanır.
 * - Kâr payı hakedişe dahil değildir (Kasa > "Kâr Payı Öde" ile dağıtılır).
 *
 * @param startISO / endISO 'YYYY-MM-DD' (dahil)
 */
export function computeRange(
  doctor: HakedisDoctor,
  shares: HakedisDoctorShare[],
  treatments: HakedisTreatment[],
  patients: HakedisPatient[],
  txs: HakedisTx[],
  payments: HakedisDoctorPayment[],
  startISO: string,
  endISO: string,
  /** Klinik KDV oranı (baz puan, örn. 1000 = %10). Tedavi ücretleri KDV dahildir; KDV hekime masraf olarak gösterilir. */
  vatBps = 0,
  todayISO: string = localToday()
): DoctorSummary {
  const core = commissionCore(doctor, treatments, patients, txs, startISO, endISO, vatBps)
  const completedCount = core.periodTreatments.filter((t) => t.status === 'done').length
  const currentMonth = todayISO.slice(0, 7)
  const salary = doctor.monthly_salary ?? 0
  const accrualFrom = doctor.start_date ? doctor.start_date.slice(0, 10) : monthFirst(currentMonth)

  const salaryDueDate = (key: string) => `${key}-${pad2(Math.min(doctor.salary_day || 1, lastDayOf(key)))}`
  const fixedDueIn = (key: string) => {
    if (salary <= 0) return false
    const due = salaryDueDate(key)
    return due <= todayISO && due >= accrualFrom
  }

  const months = monthsOverlapping(startISO, endISO)
  let fixedAmount = 0
  let guaranteeCompletion = 0
  let guaranteeAmount = 0
  for (const key of months) {
    const due = salaryDueDate(key)
    if (fixedDueIn(key) && due >= startISO && due <= endISO) fixedAmount += salary

    // Garanti tamamlama: yalnızca tam kapsanan aylar (veya bu ay, aralık ayın başından bugüne kadarsa)
    const fullyCovered = startISO <= monthFirst(key) && endISO >= monthLast(key)
    const currentCovered = key === currentMonth && startISO <= monthFirst(key) && endISO >= todayISO
    if (doctor.guarantee_active && (fullyCovered || currentCovered) && (salary <= 0 ? due <= todayISO : fixedDueIn(key))) {
      const m = fullyCovered && startISO === monthFirst(key) && endISO === monthLast(key)
        ? core
        : commissionCore(doctor, treatments, patients, txs, monthFirst(key), monthLast(key), vatBps)
      const monthFixed = fixedDueIn(key) ? salary : 0
      const base = doctor.guarantee_method === 'commission_only' ? m.variable : monthFixed + m.variable
      guaranteeCompletion += Math.max((doctor.guarantee_amount ?? 0) - base, 0)
      guaranteeAmount += doctor.guarantee_amount ?? 0
    }
  }

  const calculatedBeforeGuarantee = fixedAmount + core.variable
  const entitlement = calculatedBeforeGuarantee + guaranteeCompletion

  // Ödemeler: tek tam ay seçiliyse "hakediş dönemi"ne (earning_period), aksi halde ödeme tarihine göre
  const singleFullMonth =
    months.length === 1 && startISO === monthFirst(months[0]) && endISO === monthLast(months[0])
  const inPeriod = (p: HakedisDoctorPayment) =>
    singleFullMonth
      ? (p.earning_period ?? p.payment_date.slice(0, 7)) === months[0]
      : p.payment_date.slice(0, 10) >= startISO && p.payment_date.slice(0, 10) <= endISO
  const isProfitPayment = (p: HakedisDoctorPayment) => p.payment_type === 'kar_payi'
  const profitShare = payments
    .filter((p) => p.doctor_id === doctor.id && isProfitPayment(p) && inPeriod(p))
    .reduce((sum, p) => sum + p.amount, 0)
  const paid = payments
    .filter((p) => p.doctor_id === doctor.id && !isProfitPayment(p) && inPeriod(p))
    .reduce((s, p) => s + p.amount, 0)

  const activeShares = shares.filter(
    (s) => s.doctor_id === doctor.id && s.is_active && (!s.start_date || s.start_date <= endISO) && (!s.end_date || s.end_date >= startISO)
  )

  return {
    doctor,
    details: core.details,
    gross: core.gross,
    cost: core.cost,
    net: core.net,
    bonus: 0,
    entitlement,
    paid,
    remaining: entitlement - paid,
    rate: core.rate,
    completedCount,
    fixedAmount,
    commissionAmount: core.variable,
    guaranteeCompletion,
    clinicNetProfit: 0,
    profitShare,
    shareRate: activeShares.reduce((s, sh) => s + sh.rate_bps, 0),
    guaranteeAmount,
  }
}

/**
 * Aylık hakediş ('YYYY-MM'): computeRange'in ay sarmalayıcısı.
 * @param profitByMonth kullanılmıyor (kâr payı hakedişe girmez); çağıranlarla uyumluluk için duruyor
 */
export function computeSummary(
  doctor: HakedisDoctor,
  shares: HakedisDoctorShare[],
  treatments: HakedisTreatment[],
  patients: HakedisPatient[],
  txs: HakedisTx[],
  payments: HakedisDoctorPayment[],
  monthKey: string,
  profitByMonth: Record<string, number>,
  vatBps = 0
): DoctorSummary {
  void profitByMonth
  return computeRange(doctor, shares, treatments, patients, txs, payments, monthFirst(monthKey), monthLast(monthKey), vatBps)
}

/**
 * Hekimin ALACAĞI: işe başladığından bugüne kadar biriken hakediş − bugüne kadar yapılan tüm ödemeler
 * (maaş, avans, komisyon ödemeleri; kâr payı hariç). Birkaç aylık birikmiş tutar olabilir.
 */
export function computeReceivable(
  doctor: HakedisDoctor,
  shares: HakedisDoctorShare[],
  treatments: HakedisTreatment[],
  patients: HakedisPatient[],
  txs: HakedisTx[],
  payments: HakedisDoctorPayment[],
  vatBps = 0
): { entitlement: number; paid: number; remaining: number } {
  const today = localToday()
  const s = computeRange(doctor, shares, treatments, patients, txs, payments, '1900-01-01', today, vatBps, today)
  return { entitlement: s.entitlement, paid: s.paid, remaining: s.remaining }
}
