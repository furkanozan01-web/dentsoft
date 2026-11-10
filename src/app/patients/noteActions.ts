'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCtx, validatePatient, validateDoctor } from './actionsShared'

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
