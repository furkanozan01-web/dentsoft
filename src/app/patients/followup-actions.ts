'use server'

import { createClient } from '@/lib/supabase/server'
import type { Followup, FollowupStep } from './types'

export interface FollowupStepInput {
  title: string
  scheduled_date: string | null
  step_order: number
}

async function getClinicId() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('clinic_id').single()
  return { supabase, clinicId: profile?.clinic_id as number | null }
}

export async function getFollowupsForPatient(
  patientId: number
): Promise<{ data: Followup[] | null; error?: string }> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { data: null, error: 'Yetkisiz erişim' }

  const { data, error } = await supabase
    .from('treatment_followups')
    .select(
      'id, patient_id, title, start_date, notes, status, created_at, steps:followup_steps(id, followup_id, title, scheduled_date, completed_at, notes, step_order, created_at)'
    )
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .overrideTypes<Followup[], { merge: false }>()

  if (error) return { data: null, error: error.message }
  return { data: data ?? [] }
}

export async function createFollowup(
  patientId: number,
  title: string,
  startDate: string,
  notes: string | null,
  steps: FollowupStepInput[]
): Promise<{ data: Followup | null; error?: string }> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { data: null, error: 'Yetkisiz erişim' }

  const { data: followup, error: followupError } = await supabase
    .from('treatment_followups')
    .insert({ clinic_id: clinicId, patient_id: patientId, title, start_date: startDate, notes, status: 'active' })
    .select('id, patient_id, title, start_date, notes, status, created_at')
    .single()

  if (followupError || !followup) return { data: null, error: followupError?.message ?? 'Takip oluşturulamadı' }

  let insertedSteps: FollowupStep[] = []
  if (steps.length > 0) {
    const validSteps = steps.filter((s) => s.title.trim())
    if (validSteps.length > 0) {
      const { data: stepsData, error: stepsError } = await supabase
        .from('followup_steps')
        .insert(
          validSteps.map((s) => ({
            clinic_id: clinicId,
            followup_id: followup.id,
            title: s.title.trim(),
            scheduled_date: s.scheduled_date || null,
            step_order: s.step_order,
          }))
        )
        .select('id, followup_id, title, scheduled_date, completed_at, notes, step_order, created_at')

      if (stepsError) return { data: null, error: stepsError.message }
      insertedSteps = (stepsData ?? []) as FollowupStep[]
    }
  }

  return { data: { ...(followup as Omit<Followup, 'steps'>), steps: insertedSteps } as Followup }
}

export async function updateFollowupStep(
  stepId: number,
  data: { completed_at: string | null; notes?: string }
): Promise<{ error?: string } | null> {
  const { supabase } = await getClinicId()
  const { error } = await supabase.from('followup_steps').update(data).eq('id', stepId)
  if (error) return { error: error.message }
  return null
}

export async function deleteFollowup(followupId: number): Promise<{ error?: string } | null> {
  const { supabase } = await getClinicId()
  const { error } = await supabase.from('treatment_followups').delete().eq('id', followupId)
  if (error) return { error: error.message }
  return null
}

export interface UpcomingStep {
  id: number
  title: string
  scheduled_date: string
  followup_id: number
  followup_title: string
  patient_id: number
  patient_name: string
}

export async function getUpcomingFollowupSteps(days = 7): Promise<{
  data: UpcomingStep[] | null
  error?: string
}> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { data: null, error: 'Yetkisiz erişim' }

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const future = new Date(today)
  future.setDate(today.getDate() + days)
  const futureISO = future.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('followup_steps')
    .select(
      'id, title, scheduled_date, followup_id, followup:treatment_followups(id, title, patient_id, patient:patients(id, name, surname))'
    )
    .eq('clinic_id', clinicId)
    .is('completed_at', null)
    .gte('scheduled_date', todayISO)
    .lte('scheduled_date', futureISO)
    .order('scheduled_date')
    .limit(20)
    .overrideTypes<Array<{
      id: number
      title: string
      scheduled_date: string
      followup_id: number
      followup: { id: number; title: string; patient_id: number; patient: { id: number; name: string; surname: string } | null } | null
    }>, { merge: false }>()

  if (error) return { data: null, error: error.message }

  const mapped = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    scheduled_date: row.scheduled_date,
    followup_id: row.followup_id,
    followup_title: row.followup?.title ?? '',
    patient_id: row.followup?.patient_id ?? 0,
    patient_name: row.followup?.patient
      ? `${row.followup.patient.name} ${row.followup.patient.surname}`
      : '—',
  }))

  return { data: mapped }
}

// Mevcut takip kutusuna ek işlem / seans ekler (sona eklenir)
export async function addFollowupStep(
  followupId: number,
  title: string,
  scheduledDate: string | null
): Promise<{ data: FollowupStep | null; error?: string }> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { data: null, error: 'Yetkisiz erişim' }
  const cleanTitle = title?.trim()
  if (!cleanTitle) return { data: null, error: 'İşlem / seans adı zorunludur' }
  if (cleanTitle.length > 200) return { data: null, error: 'Ad en fazla 200 karakter olabilir' }
  const date = scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ? scheduledDate : null

  const { data: followup } = await supabase.from('treatment_followups').select('id').eq('id', followupId).eq('clinic_id', clinicId).maybeSingle()
  if (!followup) return { data: null, error: 'Takip bulunamadı' }

  const { data: last } = await supabase
    .from('followup_steps')
    .select('step_order')
    .eq('followup_id', followupId)
    .eq('clinic_id', clinicId)
    .order('step_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('followup_steps')
    .insert({ clinic_id: clinicId, followup_id: followupId, title: cleanTitle, scheduled_date: date, step_order: (last?.step_order ?? 0) + 1 })
    .select('id, followup_id, title, scheduled_date, completed_at, notes, step_order, created_at')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Adım eklenemedi' }
  return { data: data as FollowupStep }
}

// Adımın adını / planlanan tarihini değiştirir
export async function updateFollowupStepInfo(
  stepId: number,
  data: { title: string; scheduled_date: string | null }
): Promise<{ error?: string } | null> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { error: 'Yetkisiz erişim' }
  const title = data.title?.trim()
  if (!title) return { error: 'İşlem / seans adı zorunludur' }
  const date = data.scheduled_date && /^\d{4}-\d{2}-\d{2}$/.test(data.scheduled_date) ? data.scheduled_date : null
  const { error } = await supabase.from('followup_steps').update({ title: title.slice(0, 200), scheduled_date: date }).eq('id', stepId).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return null
}

export async function deleteFollowupStep(stepId: number): Promise<{ error?: string } | null> {
  const { supabase, clinicId } = await getClinicId()
  if (!clinicId) return { error: 'Yetkisiz erişim' }
  const { error } = await supabase.from('followup_steps').delete().eq('id', stepId).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return null
}
