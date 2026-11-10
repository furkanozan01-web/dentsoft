'use server'

import { localDateValue } from '@/lib/format'
import { revalidatePath } from 'next/cache'
import { treatmentFlags, checkTreatmentCompatibility, type ToothFlags } from './toothFlags'
import { getCtx, validatePatient } from './actionsShared'

// Tedavi ekler. Fiyat/ad/kategori SUNUCUDA tariffs tablosundan okunur (uydurma yok).
export async function addTreatment(input: {
  patientId: number
  tariffId: number
  tooth: number | null
  doctorId: number | null
  treatmentDate?: string
}): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  // Tarifeyi klinik kapsamında doğrula ve fiyatını al
  const { data: tariff, error: tErr } = await supabase
    .from('tariffs')
    .select('treatment_name, category, price, visual_schema')
    .eq('id', input.tariffId)
    .eq('clinic_id', clinicId)
    .single()

  if (tErr || !tariff) return { error: 'Tarife bulunamadı' }

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', input.patientId)
    .eq('clinic_id', clinicId)
    .single()
  if (!patient) return { error: 'Hasta bulunamadı' }

  if (input.doctorId) {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', input.doctorId)
      .eq('clinic_id', clinicId)
      .single()
    if (!doctor) return { error: 'Hekim bulunamadı' }
  }

  // Diş üzerinde tedavi uyumluluğu: çekilmiş/implantlı dişe dolgu/kanal
  // eklenemez, implant çekimin yerine geçebilir vb. (bkz. toothFlags.ts)
  if (input.tooth) {
    const { data: existingTreatments } = await supabase
      .from('treatments')
      .select('treatment_name, tariff:tariffs(visual_schema)')
      .eq('clinic_id', clinicId)
      .eq('patient_id', input.patientId)
      .eq('tooth', input.tooth)
      .neq('status', 'cancelled')

    const existingFlags: ToothFlags = {}
    for (const t of existingTreatments ?? []) {
      const schema = Array.isArray(t.tariff) ? t.tariff[0]?.visual_schema : (t.tariff as { visual_schema: string | null } | null)?.visual_schema
      Object.assign(existingFlags, treatmentFlags(schema, t.treatment_name))
    }
    const incomingFlags = treatmentFlags(tariff.visual_schema, tariff.treatment_name)
    const compat = checkTreatmentCompatibility(existingFlags, incomingFlags)
    if (!compat.ok) return { error: compat.error }
  }

  const { error } = await supabase.from('treatments').insert({
    clinic_id: clinicId,
    patient_id: input.patientId,
    doctor_id: input.doctorId,
    tariff_id: input.tariffId,
    tooth: input.tooth,
    treatment_name: tariff.treatment_name,
    category: tariff.category,
    fee: tariff.price,
    original_fee: tariff.price,
    is_closed: false,
    treatment_date: input.treatmentDate ?? localDateValue(),
    status: 'planned',
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function closeTreatmentAccount(
  patientId: number
): Promise<{ success?: boolean; closedCount?: number; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const { data, error } = await supabase
    .from('treatments')
    .update({ is_closed: true, updated_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('is_closed', false)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Kapatılacak açık tedavi bulunamadı' }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true, closedCount: data.length }
}

export async function applyTreatmentAdjustment(
  patientId: number,
  adjustmentData: {
    type: 'percent' | 'fixed'
    value: number
    direction: 'discount' | 'increase'
  }
): Promise<{ success?: boolean; total?: number; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  if (!['percent', 'fixed'].includes(adjustmentData.type)) return { error: 'Geçersiz değişiklik türü' }
  if (!['discount', 'increase'].includes(adjustmentData.direction)) return { error: 'Geçersiz değişiklik yönü' }
  if (!Number.isFinite(adjustmentData.value) || adjustmentData.value <= 0) {
    return { error: 'Sıfırdan büyük bir değer girin' }
  }

  const { data, error } = await supabase
    .from('treatments')
    .select('id, fee, original_fee')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('is_closed', false)
    .neq('status', 'cancelled')
    .order('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Düzenlenecek açık tedavi bulunamadı' }

  const currentTotal = data.reduce((sum, treatment) => sum + (treatment.fee ?? 0), 0)
  if (currentTotal <= 0) return { error: 'Mevcut tedavi toplamı sıfırdan büyük olmalıdır' }

  let newTotal: number
  if (adjustmentData.type === 'fixed') {
    newTotal = Math.round(adjustmentData.value)
  } else {
    const percent = adjustmentData.value
    if (adjustmentData.direction === 'discount' && percent >= 100) {
      return { error: 'İndirim oranı %100 veya daha fazla olamaz' }
    }
    const multiplier = adjustmentData.direction === 'discount'
      ? 1 - percent / 100
      : 1 + percent / 100
    newTotal = Math.round(currentTotal * multiplier)
  }

  if (!Number.isSafeInteger(newTotal) || newTotal <= 0) {
    return { error: 'Yeni toplam sıfırdan büyük olmalıdır' }
  }

  const ratio = newTotal / currentTotal
  const fees = data.map((treatment, index) => {
    if (index === data.length - 1) return 0
    return Math.round((treatment.original_fee ?? treatment.fee ?? 0) * ratio)
  })
  const distributedTotal = fees.reduce((sum, fee) => sum + fee, 0)
  fees[fees.length - 1] = newTotal - distributedTotal

  if (fees.some((fee) => !Number.isSafeInteger(fee) || fee < 0)) {
    return { error: 'Bu düzenleme bir tedavi ücretini negatif yapıyor' }
  }

  const results = await Promise.all(
    data.map((treatment, index) =>
      supabase
        .from('treatments')
        .update({ fee: fees[index], updated_at: new Date().toISOString() })
        .eq('id', treatment.id)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('is_closed', false)
    )
  )
  const updateError = results.find((result) => result.error)?.error
  if (updateError) return { error: updateError.message }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true, total: newTotal }
}

// Tedaviyi iptal eder (soft-delete — audit için satır korunur).
export async function cancelTreatment(
  treatmentId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('treatments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', treatmentId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  return { success: true }
}

// Tedavi ücretini günceller (kuruş). Klinik kapsamı RLS ile zaten sınırlı.
export async function updateTreatmentFee(
  treatmentId: number,
  feeKurus: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!treatmentId || !Number.isFinite(feeKurus) || feeKurus < 0) {
    return { error: 'Geçerli bir ücret girin' }
  }

  const { error } = await supabase
    .from('treatments')
    .update({ fee: Math.round(feeKurus), updated_at: new Date().toISOString() })
    .eq('id', treatmentId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  return { success: true }
}

// ── PERİ / Pınar: Tedavi Geçmişi ─────────────────────────────────────────────

type TreatmentHistoryRow = {
  id: number
  treatment_date: string | null
  treatment_name: string
  tooth: number | null
  fee_tl: number
  status: string
  status_tr: string
  is_closed: boolean
  doctor_name: string | null
}

const STATUS_TR: Record<string, string> = {
  done: 'Tamamlandı',
  completed: 'Tamamlandı',
  paid: 'Tamamlandı',
  cancelled: 'İptal',
  canceled: 'İptal',
  in_progress: 'Devam Ediyor',
  planned: 'Planlandı',
}

export async function getPatientTreatmentHistory(
  patientId: number,
  limit = 50,
  baslangicTarihi?: string,
  toothNo?: number
): Promise<{ data?: TreatmentHistoryRow[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!Number.isInteger(patientId) || patientId <= 0) {
    return { error: 'Geçerli bir hasta ID gerekli' }
  }

  // clinic_id + patient_id çift filtresi → kapsam güvenliği
  let query = supabase
    .from('treatments')
    .select('id, treatment_date, treatment_name, tooth, fee, status, is_closed, doctor:doctors(name)')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .neq('status', 'cancelled')
    .order('treatment_date', { ascending: false })
    .limit(Math.min(limit, 200))

  if (baslangicTarihi) {
    query = query.gte('treatment_date', baslangicTarihi)
  }

  if (toothNo !== undefined) {
    query = query.eq('tooth', toothNo)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  const rows: TreatmentHistoryRow[] = (data ?? []).map((t) => ({
    id: t.id,
    treatment_date: t.treatment_date,
    treatment_name: t.treatment_name,
    tooth: t.tooth,
    fee_tl: (t.fee ?? 0) / 100,
    status: t.status,
    status_tr: STATUS_TR[t.status?.toLowerCase() ?? ''] ?? 'Planlandı',
    is_closed: t.is_closed,
    doctor_name: ((t.doctor as unknown) as { name: string } | null)?.name ?? null,
  }))

  return { data: rows }
}
