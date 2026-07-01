'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tryEncrypt, tryDecrypt } from '@/lib/crypto'
import { EMPTY_ANAMNESIS, type Anamnesis } from '@/lib/anamnesis'
import { localDateValue } from '@/lib/format'
import { revalidatePath } from 'next/cache'

type CreatedPatient = {
  id: number
  name: string
  surname: string
  gender: string | null
  birth_date: string | null
  phone1: string | null
  phone2: string | null
  email: string | null
  address: string | null
  status: string
  untrusted: boolean | null
  reg_date: string | null
  protocol_no: string | null
  created_at: string
}
type ActionResult = { error?: string; success?: boolean; patient?: CreatedPatient } | null
type InvoiceSendResult = { error?: string; success?: boolean; invoiceNo?: string; institution?: string }

async function nextPrefixedNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'patients' | 'transactions',
  clinicId: number,
  column: 'protocol_no' | 'invoice_no',
  prefix: 'P' | 'F'
): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select(column)
    .eq('clinic_id', clinicId)
    .like(column, `${prefix}%`)

  const max = (data ?? []).reduce((current, row) => {
    const raw = String((row as Record<string, unknown>)[column] ?? '')
    const n = Number(raw.replace(new RegExp(`^${prefix}`, 'i'), ''))
    return Number.isFinite(n) ? Math.max(current, n) : current
  }, 0)

  return `${prefix}${String(max + 1).padStart(5, '0')}`
}

async function nextProtocolNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number
): Promise<string> {
  return nextPrefixedNo(supabase, 'patients', clinicId, 'protocol_no', 'P')
}

async function nextInvoiceNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number
): Promise<string> {
  return nextPrefixedNo(supabase, 'transactions', clinicId, 'invoice_no', 'F')
}

async function getCtx() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .single()
    const clinicId = profile?.clinic_id
    if (!clinicId) return null
    return { supabase, clinicId }
  } catch {
    return null
  }
}

async function validatePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number
): Promise<string | null> {
  if (!Number.isInteger(patientId) || patientId <= 0) return 'Geçerli bir hasta seçin'
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) return error.message
  return data ? null : 'Hasta bu klinikte bulunamadı'
}

async function validateDoctor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  doctorId: number | null
): Promise<string | null> {
  if (doctorId === null) return null
  if (!Number.isInteger(doctorId) || doctorId <= 0) return 'Geçerli bir hekim seçin'
  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) return error.message
  return data ? null : 'Hekim bu klinikte bulunamadı'
}

export async function createPatient(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const name = (formData.get('name') as string)?.trim()
  const surname = (formData.get('surname') as string)?.trim().toUpperCase()
  if (!name || !surname) return { error: 'Ad ve soyad zorunludur' }

  const tc = (formData.get('tc') as string)?.trim()
  const tc_enc = tc ? tryEncrypt(tc) : null

  const protocolNo = await nextProtocolNo(supabase, clinicId)
  const { data: patient, error } = await supabase.from('patients').insert({
    clinic_id: clinicId,
    name,
    surname,
    gender: (formData.get('gender') as string) || null,
    birth_date: (formData.get('birth_date') as string) || null,
    tc_enc,
    phone1: (formData.get('phone1') as string) || null,
    phone2: (formData.get('phone2') as string) || null,
    email: (formData.get('email') as string) || null,
    address: (formData.get('address') as string) || null,
    protocol_no: protocolNo,
    status: 'active',
  })
    .select('id, name, surname, gender, birth_date, phone1, phone2, email, address, status, untrusted, reg_date, protocol_no, created_at')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/patients')
  revalidatePath('/')
  return { success: true, patient: patient as CreatedPatient }
}

export async function updatePatient(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const id = Number(formData.get('id'))
  if (!id) return { error: 'Hasta ID gerekli' }

  const { error } = await supabase
    .from('patients')
    .update({
      name: (formData.get('name') as string)?.trim(),
      surname: (formData.get('surname') as string)?.trim().toUpperCase(),
      gender: (formData.get('gender') as string) || null,
      birth_date: (formData.get('birth_date') as string) || null,
      phone1: (formData.get('phone1') as string) || null,
      phone2: (formData.get('phone2') as string) || null,
      email: (formData.get('email') as string) || null,
      address: (formData.get('address') as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  return { success: true }
}

export async function deletePatient(
  id: number
): Promise<{ success?: boolean; warning?: string; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(id) || id <= 0) return { error: 'Geçerli bir hasta seçin' }

  const patientError = await validatePatient(supabase, clinicId, id)
  if (patientError) return { error: patientError }

  const [imagesResult, consentsResult, assetsResult] = await Promise.all([
    supabase
      .from('patient_images')
      .select('storage_path')
      .eq('clinic_id', clinicId)
      .eq('patient_id', id),
    supabase
      .from('patient_media_consents')
      .select('document_path')
      .eq('clinic_id', clinicId)
      .eq('patient_id', id),
    supabase
      .from('social_media_assets')
      .select('storage_bucket, storage_path')
      .eq('clinic_id', clinicId)
      .eq('patient_id', id),
  ])

  const metadataError = imagesResult.error ?? consentsResult.error ?? assetsResult.error
  if (metadataError) return { error: 'Hasta dosyaları silme için hazırlanamadı' }

  const { data: deleted, error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!deleted) return { error: 'Hasta silinemedi veya bu kliniğe ait değil' }

  const patientPrefix = `${clinicId}/${id}/`
  const clinicPrefix = `${clinicId}/`
  const patientImagePaths = new Set(
    (imagesResult.data ?? [])
      .map((item) => item.storage_path)
      .filter((path) => path.startsWith(patientPrefix))
  )
  const socialMediaPaths = new Set<string>()
  for (const asset of assetsResult.data ?? []) {
    if (asset.storage_bucket === 'patient-images' && asset.storage_path.startsWith(patientPrefix)) {
      patientImagePaths.add(asset.storage_path)
    }
    if (asset.storage_bucket === 'social-media' && asset.storage_path.startsWith(clinicPrefix)) {
      socialMediaPaths.add(asset.storage_path)
    }
  }
  const consentDocumentPaths = Array.from(
    new Set(
      (consentsResult.data ?? [])
        .map((item) => item.document_path)
        .filter((path): path is string => Boolean(path?.startsWith(patientPrefix)))
    )
  )

  const admin = createAdminClient()
  const cleanupResults = await Promise.all([
    patientImagePaths.size
      ? admin.storage.from('patient-images').remove(Array.from(patientImagePaths))
      : Promise.resolve({ error: null }),
    socialMediaPaths.size
      ? admin.storage.from('social-media').remove(Array.from(socialMediaPaths))
      : Promise.resolve({ error: null }),
    consentDocumentPaths.length
      ? admin.storage.from('consent-documents').remove(consentDocumentPaths)
      : Promise.resolve({ error: null }),
  ])

  revalidatePath('/patients')
  revalidatePath('/appointments')
  revalidatePath('/finance')
  revalidatePath('/research')
  revalidatePath('/social')
  return cleanupResults.some((result) => result.error)
    ? { success: true, warning: 'Hasta silindi; bazı dosyalar depolama alanından temizlenemedi.' }
    : { success: true }
}

// Anamnezi sunucuda çözer (şifre anahtarı asla istemciye gitmez).
export async function getAnamnesis(
  patientId: number
): Promise<{ data?: Anamnesis; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data, error } = await supabase
    .from('patients')
    .select('anamnesis_enc')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .single()

  if (error) return { error: error.message }
  if (!data?.anamnesis_enc) return { data: { ...EMPTY_ANAMNESIS } }

  const plain = tryDecrypt(data.anamnesis_enc)
  if (!plain) return { data: { ...EMPTY_ANAMNESIS } }

  try {
    const parsed = JSON.parse(plain) as Partial<Anamnesis>
    return {
      data: {
        diseases: Array.isArray(parsed.diseases) ? parsed.diseases : [],
        medications: Array.isArray(parsed.medications) ? parsed.medications : [],
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      },
    }
  } catch {
    return { data: { ...EMPTY_ANAMNESIS } }
  }
}

export async function getPatientTc(
  patientId: number
): Promise<{ tc?: string | null; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data, error } = await supabase
    .from('patients')
    .select('tc_enc')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .single()

  if (error) return { error: 'Hasta kimlik bilgisi okunamadı' }
  if (!data?.tc_enc) return { tc: null }
  return { tc: tryDecrypt(data.tc_enc) }
}

export async function sendInvoiceToInstitution(input: {
  patientId: number
  transactionIds: number[]
  invoiceNo: string
  lineDescription: string
  amountKurus: number
}): Promise<InvoiceSendResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientId = Number(input.patientId)
  const transactionIds = Array.from(new Set(input.transactionIds.map(Number))).filter(Boolean)
  const amountKurus = Math.round(Number(input.amountKurus))
  const lineDescription = input.lineDescription.trim()
  const invoiceNo = input.invoiceNo.trim() || await nextInvoiceNo(supabase, clinicId)

  if (!patientId || transactionIds.length === 0) return { error: 'Faturalanacak ödeme kaydı bulunamadı' }
  if (!lineDescription) return { error: 'Fatura işlem açıklaması zorunludur' }
  if (!Number.isFinite(amountKurus) || amountKurus <= 0) return { error: 'Geçerli bir fatura tutarı girin' }

  const [{ data: clinic }, { data: patient }, { data: txs }] = await Promise.all([
    supabase
      .from('clinic_settings')
      .select('invoice_institution, vat_rate')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .single(),
    supabase
      .from('transactions')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('type', 'payment')
      .in('id', transactionIds),
  ])

  const institution = clinic?.invoice_institution?.trim()
  if (!institution) return { error: 'Ayarlar > Klinik bölümünde e-fatura gönderim kurumu tanımlayın' }
  if (!patient) return { error: 'Hasta bulunamadı' }
  if ((txs ?? []).length !== transactionIds.length) return { error: 'Ödeme kayıtları doğrulanamadı' }

  const { error } = await supabase
    .from('transactions')
    .update({
      invoice_no: invoiceNo,
      invoice_sent_at: new Date().toISOString(),
      invoice_institution: institution,
      invoice_line_description: lineDescription,
      invoice_amount: amountKurus,
      invoice_vat_rate: clinic?.vat_rate ?? 1000,
    })
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('type', 'payment')
    .in('id', transactionIds)

  if (error) {
    if (
      error.code === '42703' ||
      error.message.includes('invoice_sent_at') ||
      error.message.includes('invoice_institution')
    ) {
      return { error: 'DB migration gerekli: supabase/migrations/20260625_invoice_settings_and_payment_invoice_fields.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true, invoiceNo, institution }
}

export async function getNextInvoiceNo(): Promise<{ invoiceNo?: string; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  return { invoiceNo: await nextInvoiceNo(supabase, clinicId) }
}

export async function updateAnamnesis(
  patientId: number,
  anamnesis: Anamnesis
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const clean: Anamnesis = {
    diseases: (anamnesis.diseases ?? []).filter(Boolean),
    medications: (anamnesis.medications ?? []).map((m) => m.trim()).filter(Boolean),
    notes: (anamnesis.notes ?? '').trim(),
  }

  const enc = tryEncrypt(JSON.stringify(clean))
  if (!enc) {
    return { error: 'Şifreleme anahtarı ayarlı değil — anamnez kaydedilemedi (ENCRYPTION_KEY)' }
  }

  const { error } = await supabase
    .from('patients')
    .update({ anamnesis_enc: enc, updated_at: new Date().toISOString() })
    .eq('id', patientId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function setUntrusted(
  patientId: number,
  untrusted: boolean
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('patients')
    .update({ untrusted, updated_at: new Date().toISOString() })
    .eq('id', patientId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  return { success: true }
}

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
    .select('treatment_name, category, price')
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

// --- Taksit / ödeme planı ---

// Hastanın kalan bakiyesini sunucuda hesaplar (tedavi toplamı − ödenen).
async function calcBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number
): Promise<{ balance?: number; error?: string }> {
  const [{ data: tr, error: treatmentError }, { data: tx, error: transactionError }] = await Promise.all([
    supabase.from('treatments').select('fee, status').eq('clinic_id', clinicId).eq('patient_id', patientId),
    supabase.from('transactions').select('amount, type').eq('clinic_id', clinicId).eq('patient_id', patientId),
  ])
  if (treatmentError) return { error: treatmentError.message }
  if (transactionError) return { error: transactionError.message }
  const owed = (tr ?? [])
    .filter((t) => t.status !== 'cancelled')
    .reduce((s, t) => s + (t.fee ?? 0), 0)
  const paid = (tx ?? [])
    .filter((t) => t.type === 'payment')
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  return { balance: owed - paid }
}

export async function addInstallment(
  patientId: number,
  dueDate: string,
  amountTL: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const raw = amountTL?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (!dueDate || isNaN(amount) || amount <= 0) return { error: 'Geçerli vade ve tutar girin' }

  const { error } = await supabase.from('payment_plans').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    due_date: dueDate,
    amount,
  })
  if (error) return { error: error.message }
  return { success: true }
}

// Kalan bakiyeyi N aya böler; SON taksite kalanı verir (yuvarlama kayması olmaz).
export async function autoInstallment(
  patientId: number,
  months: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!months || months < 1 || months > 60) return { error: 'Geçerli taksit sayısı girin (1-60)' }

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const balanceResult = await calcBalance(supabase, clinicId, patientId)
  if (balanceResult.error) return { error: balanceResult.error }
  const balance = balanceResult.balance ?? 0
  if (balance <= 0) return { error: 'Bölünecek kalan borç yok' }

  const monthly = Math.round(balance / months)
  const today = new Date()
  const rows = []
  for (let i = 1; i <= months; i++) {
    const due = new Date(today)
    due.setMonth(due.getMonth() + i)
    const amount = i === months ? balance - monthly * (months - 1) : monthly
    rows.push({
      clinic_id: clinicId,
      patient_id: patientId,
      due_date: localDateValue(due),
      amount,
    })
  }

  const { error } = await supabase.from('payment_plans').insert(rows)
  if (error) return { error: error.message }
  return { success: true }
}

// Taksiti ödendi işaretler + otomatik bir ödeme (transaction) kaydı oluşturur.
export async function markInstallmentPaid(
  installmentId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data: inst, error: iErr } = await supabase
    .from('payment_plans')
    .select('patient_id, amount, paid')
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
    .single()
  if (iErr || !inst) return { error: 'Taksit bulunamadı' }
  if (inst.paid) return { error: 'Bu taksit zaten ödenmiş' }

  const paidAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('payment_plans')
    .update({ paid: true, paid_at: paidAt, updated_at: paidAt })
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
    .eq('paid', false)
    .select('id')
    .maybeSingle()
  if (updateError) return { error: updateError.message }
  if (!updated) return { error: 'Bu taksit zaten ödenmiş' }

  const { error: txErr } = await supabase.from('transactions').insert({
    clinic_id: clinicId,
    patient_id: inst.patient_id,
    amount: inst.amount,
    method: 'other',
    type: 'payment',
    transaction_date: localDateValue(),
    description: 'Taksit ödemesi',
  })
  if (txErr) {
    await supabase
      .from('payment_plans')
      .update({ paid: false, paid_at: null, updated_at: new Date().toISOString() })
      .eq('id', installmentId)
      .eq('clinic_id', clinicId)
    return { error: txErr.message }
  }
  return { success: true }
}

export async function deleteInstallment(
  installmentId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('payment_plans')
    .delete()
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

// --- Reçete ---
export async function addPrescription(
  patientId: number,
  content: string,
  doctorId: number | null
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const text = content?.trim()
  if (!text) return { error: 'Reçete metni boş olamaz' }

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  const doctorError = await validateDoctor(supabase, clinicId, doctorId)
  if (doctorError) return { error: doctorError }

  const { error } = await supabase.from('prescriptions').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    doctor_id: doctorId,
    content: text,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function deletePrescription(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('prescriptions')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

// --- Klinik Notlar ---
export async function addNote(
  patientId: number,
  content: string,
  doctorId: number | null
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const text = content?.trim()
  if (!text) return { error: 'Not boş olamaz' }

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  const doctorError = await validateDoctor(supabase, clinicId, doctorId)
  if (doctorError) return { error: doctorError }

  const { error } = await supabase.from('clinical_notes').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    doctor_id: doctorId,
    content: text,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateNote(
  id: number,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const text = content?.trim()
  if (!id || !text) return { error: 'Not boş olamaz' }

  const { error } = await supabase
    .from('clinical_notes')
    .update({ content: text })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function setNoteImportance(
  id: number,
  isImportant: boolean
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!Number.isSafeInteger(id) || id <= 0 || typeof isImportant !== 'boolean') {
    return { error: 'Geçersiz not bilgisi' }
  }

  const { data, error } = await supabase
    .from('clinical_notes')
    .update({
      is_important: isImportant,
      important_dismissed: false,
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Not bulunamadı' }
  revalidatePath('/patients')
  return { success: true }
}

export async function dismissImportantNotes(
  patientId: number,
  noteIds: number[]
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  const ids = Array.from(new Set(noteIds)).filter(
    (id) => Number.isSafeInteger(id) && id > 0
  )
  if (ids.length === 0 || ids.length > 100) return { error: 'Geçersiz not seçimi' }

  const { data, error } = await supabase
    .from('clinical_notes')
    .update({ important_dismissed: true })
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('is_important', true)
    .in('id', ids)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Susturulacak önemli not bulunamadı' }
  revalidatePath('/patients')
  return { success: true }
}

export async function deleteNote(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const { error } = await supabase
    .from('clinical_notes')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

// --- Hasta Görüntüleri (metadata; dosya Storage'a istemciden yüklenir) ---
export async function addImageMeta(
  patientId: number,
  storagePath: string,
  fileName: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  // storagePath beklenen desen: {clinicId}/{patientId}/...
  if (!storagePath.startsWith(`${clinicId}/${patientId}/`)) {
    return { error: 'Geçersiz dosya yolu' }
  }

  const { error } = await supabase.from('patient_images').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    storage_path: storagePath,
    file_name: fileName,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteImage(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  // Metadata'yı klinik kapsamında al
  const { data: img, error: gErr } = await supabase
    .from('patient_images')
    .select('storage_path')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .single()
  if (gErr || !img) return { error: 'Görüntü bulunamadı' }

  // Yol klinik dışına çıkmasın
  if (!img.storage_path.startsWith(`${clinicId}/`)) {
    return { error: 'Geçersiz dosya yolu' }
  }

  // Storage'tan kaldır (admin client) + metadata sil
  const admin = createAdminClient()
  const { error: storageError } = await admin.storage.from('patient-images').remove([img.storage_path])
  if (storageError) return { error: storageError.message }

  const { error } = await supabase.from('patient_images').delete().eq('id', id).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

// Hasta ödemesini siler. Sadece bu kliniğe ait ve type='payment' kayıtları.
export async function deletePayment(
  transactionId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!transactionId) return { error: 'İşlem ID gerekli' }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('clinic_id', clinicId)
    .eq('type', 'payment')

  if (error) return { error: error.message }
  return { success: true }
}

export async function addPaymentWithCurrency(
  patientId: number,
  params: {
    amountKurus: number
    originalCurrency: string
    originalAmount: number | null
    exchangeRate: number | null
    paymentMethod: string
    partnerId: number | null
    note: string | null
    date: string
  }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  if (!Number.isFinite(params.amountKurus) || params.amountKurus <= 0)
    return { error: 'Geçerli bir tutar girin' }

  const validMethods = ['cash', 'card', 'transfer', 'firma_odemesi']
  const method = validMethods.includes(params.paymentMethod) ? params.paymentMethod : 'cash'

  if (method === 'firma_odemesi' && !params.partnerId)
    return { error: 'Firma ödemesi için iş ortağı seçin' }

  const txDate = params.date || localDateValue()
  const currency = ['TRY', 'USD', 'EUR', 'GBP'].includes(params.originalCurrency)
    ? params.originalCurrency
    : 'TRY'

  // Gelir kaydı
  const { data: incomeTx, error: incomeErr } = await supabase
    .from('transactions')
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      amount: Math.round(params.amountKurus),
      method,
      type: 'payment',
      transaction_date: txDate,
      description: params.note || null,
      original_currency: currency,
      original_amount: currency !== 'TRY' ? params.originalAmount : null,
      exchange_rate: currency !== 'TRY' ? params.exchangeRate : null,
      partner_id: method === 'firma_odemesi' ? params.partnerId : null,
    })
    .select('id')
    .single()

  if (incomeErr || !incomeTx) return { error: incomeErr?.message ?? 'Ödeme kaydedilemedi' }

  // Firma ödemesinde ek gider kaydı
  if (method === 'firma_odemesi' && params.partnerId) {
    const { data: partner } = await supabase
      .from('business_partners')
      .select('name')
      .eq('id', params.partnerId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    const { data: patient } = await supabase
      .from('patients')
      .select('name, surname')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    const partnerName = partner?.name ?? `Ortak #${params.partnerId}`
    const patientName = patient ? `${patient.name} ${patient.surname}` : `Hasta #${patientId}`

    const { data: expenseTx, error: expenseErr } = await supabase
      .from('transactions')
      .insert({
        clinic_id: clinicId,
        amount: Math.round(params.amountKurus),
        type: 'expense',
        transaction_date: txDate,
        description: `${partnerName} üzerinden ödeme — Hasta: ${patientName}`,
        partner_id: params.partnerId,
        linked_transaction_id: incomeTx.id,
      })
      .select('id')
      .single()

    if (expenseErr) return { error: expenseErr.message }

    // Gelir kaydını gider kaydına bağla
    await supabase
      .from('transactions')
      .update({ linked_transaction_id: expenseTx?.id })
      .eq('id', incomeTx.id)
      .eq('clinic_id', clinicId)
  }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true }
}

// ── Senet Robotu ──────────────────────────────────────────────────────────────

export async function createPromissoryPlan(
  patientId: number,
  title: string,
  interestRateBps: number,
  installments: { due_date: string; amount: number }[]
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  if (!installments.length) return { error: 'En az bir taksit gerekli' }

  const { data: group, error: groupErr } = await supabase
    .from('payment_plan_groups')
    .insert({ clinic_id: clinicId, patient_id: patientId, title, interest_rate_bps: interestRateBps })
    .select('id')
    .single()

  if (groupErr || !group) return { error: groupErr?.message ?? 'Plan grubu oluşturulamadı' }

  const rows = installments.map((it) => ({
    clinic_id: clinicId,
    patient_id: patientId,
    group_id: group.id,
    due_date: it.due_date,
    amount: it.amount,
    paid: false,
  }))

  const { error: insertErr } = await supabase.from('payment_plans').insert(rows)
  if (insertErr) return { error: insertErr.message }

  revalidatePath('/patients')
  return { success: true }
}

// ── Borç Özeti Hatırlatıcısı ──────────────────────────────────────────────────

export async function addReminder(
  patientId: number,
  reminderDate: string,
  note: string
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  if (!reminderDate) return { error: 'Tarih gerekli' }

  const { error } = await supabase
    .from('patient_reminders')
    .insert({ clinic_id: clinicId, patient_id: patientId, reminder_date: reminderDate, note: note || null })

  if (error) return { error: error.message }
  revalidatePath('/patients')
  return { success: true }
}

export async function markReminderDone(reminderId: number): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('patient_reminders')
    .update({ is_done: true })
    .eq('id', reminderId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  return { success: true }
}

export async function deleteReminder(reminderId: number): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('patient_reminders')
    .delete()
    .eq('id', reminderId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
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

// ─── PERİ — hasta oluşturma (FormData kullanmayan, TC'siz sürüm) ──────────────
// tc_enc bu action üzerinden asla set edilmez — KVKK gereği sonradan hasta kartından eklenir.

export async function createPatientFromPeri(params: {
  name: string
  surname: string
  phone1?: string
  gender?: string | null
  birth_date?: string | null
  email?: string | null
  address?: string | null
}): Promise<{ error?: string; patientId?: number; protocolNo?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!params.name?.trim() || !params.surname?.trim()) {
    return { error: 'Ad ve soyad zorunludur' }
  }

  const protocolNo = await nextProtocolNo(supabase, clinicId)
  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: clinicId,
      name: params.name.trim(),
      surname: params.surname.trim().toUpperCase(),
      gender: params.gender ?? null,
      birth_date: params.birth_date ?? null,
      tc_enc: null,
      phone1: params.phone1 ?? null,
      email: params.email ?? null,
      address: params.address ?? null,
      protocol_no: protocolNo,
      status: 'active',
    })
    .select('id, protocol_no')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/patients')
  revalidatePath('/')
  return { patientId: patient.id, protocolNo: patient.protocol_no }
}

// ─── PERİ — hasta güncelleme (FormData'sız, TC'siz, patch update) ─────────────
// Yalnızca undefined olmayan alanlar yazılır; tc_enc asla set edilmez.

export async function updatePatientFromPeri(params: {
  patientId: number
  name?: string
  surname?: string
  phone1?: string | null
  phone2?: string | null
  birth_date?: string | null
  address?: string | null
  email?: string | null
}): Promise<{ error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!Number.isInteger(params.patientId) || params.patientId <= 0) {
    return { error: 'Geçerli bir hasta ID gerekli' }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.name !== undefined) updates.name = params.name.trim()
  if (params.surname !== undefined) updates.surname = params.surname.trim().toUpperCase()
  if (params.phone1 !== undefined) updates.phone1 = params.phone1
  if (params.phone2 !== undefined) updates.phone2 = params.phone2
  if (params.birth_date !== undefined) updates.birth_date = params.birth_date
  if (params.address !== undefined) updates.address = params.address
  if (params.email !== undefined) updates.email = params.email

  const { data: updatedPatient, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', params.patientId)
    .eq('clinic_id', clinicId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updatedPatient) return { error: `Hasta bulunamadı (ID: ${params.patientId})` }
  revalidatePath('/patients')
  return {}
}

// ─── PERİ — anamnez güncelleme (mevcut veriyi çekip merge eder) ───────────────
// tc_enc bu path üzerinden asla okunmaz veya yazılmaz.
// Anamnesis: { diseases: string[], medications: string[], notes: string } — TC içermez.

export async function updateAnamnesisFromPeri(params: {
  patientId: number
  kullandigi_ilaclar?: string
  kronik_hastaliklar?: string
  alerjiler?: string
  kan_grubu?: string
  notlar?: string
}): Promise<{ error?: string }> {
  if (!Number.isInteger(params.patientId) || params.patientId <= 0) {
    return { error: 'Geçerli bir hasta ID gerekli' }
  }

  const currentResult = await getAnamnesis(params.patientId)
  if (currentResult.error) return { error: currentResult.error }
  const current = currentResult.data ?? { ...EMPTY_ANAMNESIS }

  const merged: Anamnesis = {
    diseases: [...current.diseases],
    medications: [...current.medications],
    notes: current.notes,
  }

  if (params.kullandigi_ilaclar !== undefined) {
    merged.medications = params.kullandigi_ilaclar
      .split(',').map(s => s.trim()).filter(Boolean)
  }

  if (params.kronik_hastaliklar !== undefined) {
    merged.diseases = params.kronik_hastaliklar
      .split(',').map(s => s.trim()).filter(Boolean)
  }

  if (params.alerjiler?.trim() && !merged.diseases.includes('Alerji')) {
    merged.diseases.push('Alerji')
  }

  // notes: notlar varsa değiştir, kan_grubu/alerjiler ek satır olarak ekle
  const baseNote = params.notlar !== undefined ? params.notlar.trim() : current.notes
  const noteParts: string[] = [baseNote]
  if (params.kan_grubu?.trim()) noteParts.push(`Kan grubu: ${params.kan_grubu.trim()}`)
  if (params.alerjiler?.trim()) noteParts.push(`Alerjiler: ${params.alerjiler.trim()}`)
  merged.notes = noteParts.filter(Boolean).join('\n')

  return updateAnamnesis(params.patientId, merged)
}

// ─── PERİ — not ekleme (is_important desteğiyle) ─────────────────────────────
// addNote action'ı is_important insert etmiyor; bu wrapper tek sorguda halleder.
// doctor_id = null: PERİ oturumunda aktif hekim bilinmiyor.

export async function addNoteFromPeri(
  patientId: number,
  content: string,
  isImportant: boolean
): Promise<{ error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const text = content?.trim()
  if (!text) return { error: 'Not boş olamaz' }

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const { error } = await supabase.from('clinical_notes').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    doctor_id: null,
    content: text,
    is_important: isImportant,
  })
  if (error) return { error: error.message }
  revalidatePath('/patients')
  return {}
}
