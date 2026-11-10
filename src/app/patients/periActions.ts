'use server'

import { EMPTY_ANAMNESIS, type Anamnesis } from '@/lib/anamnesis'
import { revalidatePath } from 'next/cache'
import { nextProtocolNo, getCtx, validatePatient } from './actionsShared'
import { getAnamnesis, updateAnamnesis } from './patientActions'

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
