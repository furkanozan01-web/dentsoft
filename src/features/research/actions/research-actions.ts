'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ResearchActionResult,
  ResearchFilters,
  ResearchResult,
  ResearchTag,
  SavedResearch,
} from '../types'
import { searchPatients } from '../queries/search-patients'

async function getContext() {
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
  if (!profile?.clinic_id) return null
  return { supabase, user, clinicId: Number(profile.clinic_id) }
}

export async function runResearchAction(
  filters: ResearchFilters
): Promise<ResearchActionResult<ResearchResult[]>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  try {
    return { data: await searchPatients(context.supabase, context.clinicId, filters) }
  } catch {
    return { error: 'Araştırma sonuçları alınamadı.' }
  }
}

export async function saveResearchAction(
  name: string,
  filters: ResearchFilters
): Promise<ResearchActionResult<SavedResearch>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 120) return { error: 'Geçerli bir araştırma adı girin.' }

  const { data, error } = await context.supabase
    .from('research_saved_searches')
    .insert({
      clinic_id: context.clinicId,
      created_by: context.user.id,
      name: cleanName,
      filters,
      visible_columns: ['patient', 'last_visit', 'treatment', 'doctor', 'balance', 'tags'],
      schema_version: 1,
    })
    .select('id, name, filters, visible_columns, created_at, updated_at')
    .single()

  if (error || !data) return { error: 'Araştırma kaydedilemedi.' }
  revalidatePath('/research')
  return { data: data as SavedResearch }
}

export async function deleteSavedResearchAction(id: number): Promise<ResearchActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const { error } = await context.supabase
    .from('research_saved_searches')
    .delete()
    .eq('id', id)
    .eq('clinic_id', context.clinicId)
    .eq('created_by', context.user.id)
  if (error) return { error: 'Kayıt silinemedi.' }
  revalidatePath('/research')
  return { data: null }
}

export async function createTagAction(name: string, color: string): Promise<ResearchActionResult<ResearchTag>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 48) return { error: 'Geçerli bir etiket adı girin.' }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: 'Geçerli bir etiket rengi seçin.' }

  const { data, error } = await context.supabase
    .from('patient_tags')
    .insert({ clinic_id: context.clinicId, created_by: context.user.id, name: cleanName, color })
    .select('id, name, color')
    .single()
  if (error || !data) return { error: 'Etiket oluşturulamadı veya bu ad zaten kullanılıyor.' }
  revalidatePath('/research')
  return { data: data as ResearchTag }
}

export async function assignTagAction(
  tagId: number,
  patientIds: number[]
): Promise<ResearchActionResult<number>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const uniqueIds = Array.from(new Set(patientIds.filter(Number.isInteger))).slice(0, 1000)
  if (!tagId || uniqueIds.length === 0) return { error: 'Etiket ve en az bir hasta seçin.' }

  const [{ data: tag }, { data: patients }] = await Promise.all([
    context.supabase
      .from('patient_tags')
      .select('id')
      .eq('id', tagId)
      .eq('clinic_id', context.clinicId)
      .single(),
    context.supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', context.clinicId)
      .in('id', uniqueIds),
  ])
  if (!tag || !patients || patients.length !== uniqueIds.length) return { error: 'Seçim doğrulanamadı.' }

  const { error } = await context.supabase.from('patient_tag_assignments').upsert(
    uniqueIds.map((patientId) => ({
      clinic_id: context.clinicId,
      patient_id: patientId,
      tag_id: tagId,
      created_by: context.user.id,
    })),
    { onConflict: 'patient_id,tag_id', ignoreDuplicates: true }
  )
  if (error) return { error: 'Etiket hastalara uygulanamadı.' }
  revalidatePath('/research')
  return { data: uniqueIds.length }
}

