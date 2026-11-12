'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type R = { success?: boolean; error?: string } | null
const APPOINTMENT_STATUSES = new Set(['pending', 'scheduled', 'done', 'cancelled', 'no_show'])

function validateSchedule(scheduledAt: string, durationMin: number): string | null {
  const date = new Date(scheduledAt)
  if (!scheduledAt || Number.isNaN(date.getTime())) return 'Geçerli bir randevu tarihi girin'
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 24 * 60) {
    return 'Randevu süresi 5 dakika ile 24 saat arasında olmalıdır'
  }
  return null
}

async function getCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, branch_id, active_branch_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) return null
  return { supabase, clinicId: profile.clinic_id, branchId: profile.active_branch_id ?? profile.branch_id, role: profile.role }
}

async function validateOperatingHours(ctx: NonNullable<Awaited<ReturnType<typeof getCtx>>>, doctorId: number, scheduledAt: string, durationMin: number, override = false) {
  const { data: clinic, error } = await ctx.supabase.from('clinic_settings').select('work_start, work_end, night_shift_active, night_shift_start, night_shift_end, night_shift_days, night_shift_doctor_ids, night_shift_branch_id').eq('id', ctx.clinicId).single()
  if (error || !clinic) return { error: error?.message ?? 'Çalışma saatleri bulunamadı', isNight: false }
  const date = new Date(scheduledAt)
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  const startMin = Number(part('hour')) * 60 + Number(part('minute')); const endMin = startMin + durationMin
  const dayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const mins=(v:string)=>{const [h,m]=v.slice(0,5).split(':').map(Number);return h*60+m}
  const workStart=mins(clinic.work_start), workEnd=mins(clinic.work_end)
  if(startMin>=workStart&&endMin<=workEnd)return {isNight:false}
  if(override&&ctx.role==='bashekim')return {isNight:true}
  const nightStart=mins(clinic.night_shift_start), nightEnd=mins(clinic.night_shift_end)
  const inNight=nightEnd>nightStart?startMin>=nightStart&&endMin<=nightEnd:startMin>=nightStart||endMin<=nightEnd
  const days=(clinic.night_shift_days??[]) as number[]; const doctorIds=(clinic.night_shift_doctor_ids??[]) as number[]
  const allowed=clinic.night_shift_active&&days.includes(dayIndex[part('weekday')])&&inNight&&(!doctorIds.length||doctorIds.includes(doctorId))&&(!clinic.night_shift_branch_id||clinic.night_shift_branch_id===ctx.branchId)
  return allowed?{isNight:true}:{error:'Bu saat aralığı gece mesaisi dışında kalıyor. Randevu oluşturmak için gece mesaisini aktif hale getirmeniz gerekir.',isNight:false}
}

async function hasUnitCapacity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  branchId: number | null,
  startISO: string,
  durationMin: number,
  excludeId?: number
): Promise<{ full: boolean; error?: string }> {
  if (!branchId) return { full: false }
  const { data: branch, error: branchError } = await supabase.from('branches').select('unit_count').eq('id', branchId).eq('clinic_id', clinicId).single()
  if (branchError || !branch) return { full: false, error: branchError?.message ?? 'Şube kapasitesi bulunamadı' }
  const start = new Date(startISO)
  const end = new Date(start.getTime() + durationMin * 60000)
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
  const { data, error } = await supabase.from('appointments')
    .select('id, scheduled_at, duration_min')
    .eq('clinic_id', clinicId).eq('branch_id', branchId)
    .gte('scheduled_at', dayStart.toISOString()).lt('scheduled_at', dayEnd.toISOString())
    .not('status', 'in', '(cancelled,no_show)')
  if (error) return { full: false, error: error.message }
  const concurrent = (data ?? []).filter((appointment) => {
    if (excludeId && appointment.id === excludeId) return false
    const appointmentStart = new Date(appointment.scheduled_at)
    const appointmentEnd = new Date(appointmentStart.getTime() + (appointment.duration_min ?? 30) * 60000)
    return start < appointmentEnd && end > appointmentStart
  }).length
  return { full: concurrent >= branch.unit_count }
}

async function nextProtocolNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number
): Promise<string> {
  const { data } = await supabase
    .from('patients')
    .select('protocol_no')
    .eq('clinic_id', clinicId)
    .like('protocol_no', 'P%')

  const max = (data ?? []).reduce((current, row) => {
    const n = Number(String(row.protocol_no ?? '').replace(/^P/i, ''))
    return Number.isFinite(n) ? Math.max(current, n) : current
  }, 0)

  return `P${String(max + 1).padStart(5, '0')}`
}

// Aynı hekimde zaman çakışması var mı? (iptal/gelmedi hariç)
async function hasConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  doctorId: number,
  startISO: string,
  durationMin: number,
  excludeId?: number
): Promise<{ conflict: boolean; error?: string }> {
  const start = new Date(startISO)
  const end = new Date(start.getTime() + durationMin * 60000)
  // Aynı günün randevularını çek, JS'te örtüşme kontrolü yap
  const dayStart = new Date(start)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_min, status')
    .eq('clinic_id', clinicId)
    .eq('doctor_id', doctorId)
    .gte('scheduled_at', dayStart.toISOString())
    .lt('scheduled_at', dayEnd.toISOString())
    .not('status', 'in', '(cancelled,no_show)')

  if (error) return { conflict: false, error: error.message }

  const conflict = (data ?? []).some((a) => {
    if (excludeId && a.id === excludeId) return false
    const eStart = new Date(a.scheduled_at)
    const eEnd = new Date(eStart.getTime() + (a.duration_min ?? 30) * 60000)
    return start < eEnd && end > eStart
  })
  return { conflict }
}

async function validateClinicRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number | null,
  doctorId: number
): Promise<R> {
  const checks = [
    supabase.from('doctors').select('id').eq('id', doctorId).eq('clinic_id', clinicId).single(),
  ]
  if (patientId) {
    checks.push(supabase.from('patients').select('id').eq('id', patientId).eq('clinic_id', clinicId).single())
  }
  const results = await Promise.all(checks)
  return results.some(({ error, data }) => error || !data)
    ? { error: 'Hasta veya hekim bu klinige ait degil' }
    : null
}
export async function createPatientForAppointment(input: {
  name: string
  surname: string
  phone1?: string | null
  phone2?: string | null
  birthDate?: string | null
  gender?: string | null
}): Promise<{ id?: number; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const name = input.name.trim()
  const surname = input.surname.trim().toLocaleUpperCase('tr-TR')
  if (!name || !surname) return { error: 'Ad ve soyad zorunludur' }

  const { data, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: clinicId,
      name,
      surname,
      phone1: input.phone1?.trim() || null,
      phone2: input.phone2?.trim() || null,
      birth_date: input.birthDate || null,
      gender: input.gender || null,
      protocol_no: await nextProtocolNo(supabase, clinicId),
      status: 'active',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/patients')
  return { id: data.id }
}
export async function createAppointment(input: {
  patientId: number | null
  doctorId: number
  scheduledAt: string
  durationMin: number
  treatmentNote: string | null
  status?: string
  appointmentTypeId?: number | null
  color?: string | null
  overrideNight?: boolean
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId, branchId } = ctx

  if (!input.doctorId || !input.scheduledAt) {
    return { error: 'Hekim ve tarih/saat zorunludur' }
  }
  const scheduleError = validateSchedule(input.scheduledAt, input.durationMin)
  if (scheduleError) return { error: scheduleError }
  if (input.status && !APPOINTMENT_STATUSES.has(input.status)) return { error: 'Geçersiz randevu durumu' }

  const refErr = await validateClinicRefs(supabase, clinicId, input.patientId, input.doctorId)
  if (refErr) return refErr
  const hours = await validateOperatingHours(ctx, input.doctorId, input.scheduledAt, input.durationMin, input.overrideNight)
  if (hours.error) return { error: hours.error }

  const conflict = await hasConflict(supabase, clinicId, input.doctorId, input.scheduledAt, input.durationMin)
  if (conflict.error) return { error: conflict.error }
  if (conflict.conflict) {
    return { error: 'Bu hekimin bu saatte başka randevusu var (çakışma).' }
  }
  const capacity = await hasUnitCapacity(supabase, clinicId, branchId, input.scheduledAt, input.durationMin)
  if (capacity.error) return { error: capacity.error }
  if (capacity.full) return { error: 'Bu saat aralığında şubenin tüm ünitleri dolu.' }

  const { error } = await supabase.from('appointments').insert({
    clinic_id: clinicId,
    patient_id: input.patientId,
    doctor_id: input.doctorId,
    scheduled_at: input.scheduledAt,
    duration_min: input.durationMin,
    treatment_note: input.treatmentNote,
    appointment_type_id: input.appointmentTypeId ?? null,
    color: input.color && /^#[0-9A-Fa-f]{6}$/.test(input.color) ? input.color : null,
    is_night_shift: hours.isNight,
    status: input.status ?? 'scheduled',
  })
  if (error) return { error: error.message }
  revalidatePath('/appointments')
  return { success: true }
}

export async function updateAppointmentStatus(id: number, status: string): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(id) || id <= 0) return { error: 'Geçersiz randevu' }
  if (!APPOINTMENT_STATUSES.has(status)) return { error: 'Geçersiz randevu durumu' }

  const { error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/appointments')
  return { success: true }
}

export async function rescheduleAppointment(
  id: number,
  scheduledAt: string,
  durationMin: number,
  doctorId: number
): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId, branchId } = ctx
  if (!Number.isInteger(id) || id <= 0) return { error: 'Geçersiz randevu' }
  const scheduleError = validateSchedule(scheduledAt, durationMin)
  if (scheduleError) return { error: scheduleError }
  const hours = await validateOperatingHours(ctx, doctorId, scheduledAt, durationMin)
  if (hours.error) return { error: hours.error }

  const refErr = await validateClinicRefs(supabase, clinicId, null, doctorId)
  if (refErr) return refErr

  const conflict = await hasConflict(supabase, clinicId, doctorId, scheduledAt, durationMin, id)
  if (conflict.error) return { error: conflict.error }
  if (conflict.conflict) {
    return { error: 'Yeni saatte çakışma var.' }
  }
  const capacity = await hasUnitCapacity(supabase, clinicId, branchId, scheduledAt, durationMin, id)
  if (capacity.error) return { error: capacity.error }
  if (capacity.full) return { error: 'Yeni saatte şubenin tüm ünitleri dolu.' }

  const { error } = await supabase
    .from('appointments')
    .update({
      doctor_id: doctorId,
      scheduled_at: scheduledAt,
      duration_min: durationMin,
      is_night_shift: hours.isNight,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/appointments')
  return { success: true }
}

export async function updateAppointment(
  id: number,
  input: {
    doctorId: number
    scheduledAt: string
    durationMin: number
    treatmentNote: string | null
    appointmentTypeId?: number | null
    color?: string | null
    overrideNight?: boolean
  }
): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId, branchId } = ctx
  if (!Number.isInteger(id) || id <= 0) return { error: 'Geçersiz randevu' }
  const scheduleError = validateSchedule(input.scheduledAt, input.durationMin)
  if (scheduleError) return { error: scheduleError }
  const hours = await validateOperatingHours(ctx, input.doctorId, input.scheduledAt, input.durationMin, input.overrideNight)
  if (hours.error) return { error: hours.error }

  const refErr = await validateClinicRefs(supabase, clinicId, null, input.doctorId)
  if (refErr) return refErr

  const conflict = await hasConflict(supabase, clinicId, input.doctorId, input.scheduledAt, input.durationMin, id)
  if (conflict.error) return { error: conflict.error }
  if (conflict.conflict) {
    return { error: 'Bu saatte çakışma var.' }
  }
  const capacity = await hasUnitCapacity(supabase, clinicId, branchId, input.scheduledAt, input.durationMin, id)
  if (capacity.error) return { error: capacity.error }
  if (capacity.full) return { error: 'Bu saatte şubenin tüm ünitleri dolu.' }

  const { error } = await supabase
    .from('appointments')
    .update({
      doctor_id: input.doctorId,
      scheduled_at: input.scheduledAt,
      duration_min: input.durationMin,
      treatment_note: input.treatmentNote,
      ...(input.appointmentTypeId !== undefined ? { appointment_type_id: input.appointmentTypeId } : {}),
      ...(input.color !== undefined ? { color: input.color && /^#[0-9A-Fa-f]{6}$/.test(input.color) ? input.color : null } : {}),
      is_night_shift: hours.isNight,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/appointments')
  return { success: true }
}

export async function deleteAppointment(id: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(id) || id <= 0) return { error: 'Geçersiz randevu' }

  const { error } = await supabase.from('appointments').delete().eq('id', id).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/appointments')
  return { success: true }
}
