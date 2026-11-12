'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { tryEncrypt, tryDecrypt } from '@/lib/crypto'
import { EMPTY_ANAMNESIS, type Anamnesis } from '@/lib/anamnesis'
import { revalidatePath } from 'next/cache'
import { type CreatedPatient, type ActionResult, nextProtocolNo, getCtx, validatePatient, validateTc } from './actionsShared'

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
  let tc_enc: string | null = null
  if (tc) {
    const tcError = validateTc(tc)
    if (tcError) return { error: tcError }
    tc_enc = tryEncrypt(tc)
    if (!tc_enc) return { error: 'T.C. kimlik numarası şifrelenemedi (şifreleme anahtarı eksik); hasta kaydedilmedi' }
  }

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

  // T.C. yalnızca istemci alanı gönderdiyse güncellenir; boş değer kaydı temizler
  const tcField = formData.get('tc')
  let tcUpdate: { tc_enc: string | null } | Record<string, never> = {}
  if (typeof tcField === 'string') {
    const tc = tcField.trim()
    if (!tc) {
      tcUpdate = { tc_enc: null }
    } else {
      const tcError = validateTc(tc)
      if (tcError) return { error: tcError }
      const enc = tryEncrypt(tc)
      if (!enc) return { error: 'T.C. kimlik numarası şifrelenemedi (şifreleme anahtarı eksik)' }
      tcUpdate = { tc_enc: enc }
    }
  }

  const { error } = await supabase
    .from('patients')
    .update({
      ...tcUpdate,
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
