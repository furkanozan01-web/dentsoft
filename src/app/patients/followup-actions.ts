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
