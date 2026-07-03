'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { tryEncrypt } from '@/lib/crypto'
import { getCtx, requireAdmin, type R } from './actionsShared'
import type { DayHours } from './types'

// ---- Diş Hekimi ----
type DoctorPayload = {
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  diploma_no: string | null
  tc_identity_no?: string | null
  diploma_date?: string | null
  birth_date?: string | null
  color: string
  status: string // active | passive
  payment_model: string | null // salary | commission | hybrid | null
  monthly_salary: number | null // kuruş
  commission_rate_bps: number | null
  guarantee_amount: number | null
  bonus_amount: number | null
  per_transaction_amount: number | null
  salary_day: number | null
  payment_account: string | null
  work_hours_json: Record<string, DayHours> | null
  title?: string | null
  branch_id?: number | null
  create_user_account?: boolean
  user_access_level?: string
  guarantee_active?: boolean
  guarantee_period?: string
  guarantee_method?: string
  guarantee_note?: string | null
  share_active?: boolean
  share_rate_bps?: number
  share_start_date?: string | null
  share_end_date?: string | null
  share_branch_id?: number | null
  share_period?: string
  share_note?: string | null
  profit_distribution_type?: string
}

type SanitizedDoctor = Omit<DoctorPayload, 'create_user_account' | 'user_access_level' | 'tc_identity_no'> & { tc_enc: string | null }

async function syncDoctorUser(input: { clinicId: number; doctorId: number; row: SanitizedDoctor; accessLevel?: string }): Promise<string | null> {
  if (!input.row.email) return null
  const admin = createAdminClient()
  const normalizedEmail = input.row.email.toLowerCase()
  const { data: existingInvite } = await admin.from('admin_email_allowlist').select('clinic_id, access_level').eq('email', normalizedEmail).maybeSingle()
  if (existingInvite && existingInvite.clinic_id !== input.clinicId) return 'Bu e-posta başka bir kliniğe kayıtlı'
  const accessLevel = input.accessLevel === 'all' || (!input.accessLevel && existingInvite?.access_level === 'all') ? 'all' : 'branch'

  await admin.from('admin_email_allowlist').delete().eq('clinic_id', input.clinicId).eq('doctor_id', input.doctorId).neq('email', normalizedEmail)
  const { error: inviteError } = await admin.from('admin_email_allowlist').upsert({
    email: normalizedEmail, clinic_id: input.clinicId, role: 'hekim', full_name: input.row.name,
    doctor_id: input.doctorId, branch_id: input.row.branch_id, access_level: accessLevel, is_active: input.row.status === 'active',
  }, { onConflict: 'email' })
  if (inviteError) return inviteError.message

  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = authUsers.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
  if (existingUser) {
    const { error: profileError } = await admin.from('profiles').update({
      clinic_id: input.clinicId, role: 'hekim', doctor_id: input.doctorId, branch_id: input.row.branch_id,
      active_branch_id: input.row.branch_id, access_level: accessLevel, updated_at: new Date().toISOString(),
    }).eq('id', existingUser.id)
    if (profileError) return profileError.message
  }
  return null
}

// Girdiyi normalize eder + doğrular (hem add hem update kullanır).
function sanitizeDoctor(input: DoctorPayload): { error?: string; row?: SanitizedDoctor } {
  const name = input.name?.trim()
  if (!name) return { error: 'Ad Soyad zorunludur' }

  const status = input.status === 'passive' ? 'passive' : 'active'
  const tc = input.tc_identity_no?.replace(/\D/g, '') || null
  if (tc && tc.length !== 11) return { error: 'T.C. Kimlik Numarası 11 haneli olmalıdır' }
  const monthly_salary = Math.max(0, Math.round(input.monthly_salary ?? 0))
  const commission_rate_bps = Math.min(10000, Math.max(0, Math.round(input.commission_rate_bps ?? 0)))
  const payment_model = monthly_salary > 0 && commission_rate_bps > 0
    ? 'hybrid'
    : monthly_salary > 0
    ? 'salary'
    : commission_rate_bps > 0
    ? 'commission'
    : null
  const guaranteeActive = Boolean(input.guarantee_active)
  const shareActive = Boolean(input.share_active)
  const shareRate = Math.min(10000, Math.max(0, Math.round(input.share_rate_bps ?? 0)))
  if (input.share_start_date && input.share_end_date && input.share_end_date < input.share_start_date) {
    return { error: 'Hisse bitiş tarihi başlangıç tarihinden önce olamaz' }
  }

  return {
    row: {
      name,
      specialty: input.specialty?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      diploma_no: input.diploma_no?.trim() || null,
      tc_enc: tc ? tryEncrypt(tc) : null,
      diploma_date: input.diploma_date || null,
      birth_date: input.birth_date || null,
      color: input.color || '#3b82f6',
      status,
      payment_model,
      monthly_salary,
      commission_rate_bps,
      guarantee_amount: guaranteeActive ? Math.max(0, Math.round(input.guarantee_amount ?? 0)) : 0,
      bonus_amount: Math.max(0, Math.round(input.bonus_amount ?? 0)),
      per_transaction_amount: null,
      salary_day: input.salary_day ? Math.min(31, Math.max(1, Math.round(input.salary_day))) : null,
      payment_account: input.payment_account?.trim() || null,
      work_hours_json: input.work_hours_json ?? null,
      title: input.title?.trim() || 'Diş Hekimi',
      branch_id: input.branch_id || null,
      guarantee_active: guaranteeActive,
      guarantee_period: ['monthly','quarterly','yearly'].includes(input.guarantee_period ?? '') ? input.guarantee_period : 'monthly',
      guarantee_method: input.guarantee_method === 'commission_only' ? 'commission_only' : 'minimum_total',
      guarantee_note: input.guarantee_note?.trim() || null,
      share_active: shareActive && shareRate > 0,
      share_rate_bps: shareActive ? shareRate : 0,
      share_start_date: input.share_start_date || null,
      share_end_date: input.share_end_date || null,
      share_branch_id: input.share_branch_id || null,
      share_period: ['monthly','quarterly','yearly'].includes(input.share_period ?? '') ? input.share_period : 'monthly',
      share_note: input.share_note?.trim() || null,
      profit_distribution_type: ['expense','profit_distribution','partner_payment'].includes(input.profit_distribution_type ?? '') ? input.profit_distribution_type : 'profit_distribution',
    },
  }
}

export async function addDoctor(input: DoctorPayload): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { error: vErr, row } = sanitizeDoctor(input)
  if (vErr || !row) return { error: vErr }

  if (row.branch_id) {
    const { data: branch } = await supabase.from('branches').select('id').eq('id', row.branch_id).eq('clinic_id', clinicId).maybeSingle()
    if (!branch) return { error: 'Seçilen şube bu kliniğe ait değil' }
  }
  const { data: doctor, error } = await supabase.from('doctors').insert({ clinic_id: clinicId, ...row }).select('id').single()
  if (error || !doctor) return { error: error?.message ?? 'Hekim oluşturulamadı' }
  const userSyncError = await syncDoctorUser({ clinicId, doctorId: doctor.id, row, accessLevel: input.user_access_level })
  if (userSyncError) {
    await supabase.from('doctors').delete().eq('id', doctor.id).eq('clinic_id', clinicId)
    return { error: userSyncError }
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateDoctor(id: number, input: DoctorPayload): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx
  if (!id) return { error: 'Hekim ID gerekli' }

  const { error: vErr, row } = sanitizeDoctor(input)
  if (vErr || !row) return { error: vErr }

  const { error } = await supabase
    .from('doctors')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  const userSyncError = await syncDoctorUser({ clinicId, doctorId: id, row, accessLevel: input.user_access_level })
  if (userSyncError) return { error: userSyncError }
  if (row.status === 'passive') {
    const admin = createAdminClient()
    const { data: linkedProfiles } = await admin.from('profiles').select('id').eq('clinic_id', clinicId).eq('doctor_id', id)
    for (const linked of linkedProfiles ?? []) await admin.auth.admin.updateUserById(linked.id, { ban_duration: '876000h' })
    await admin.from('admin_email_allowlist').update({ is_active: false }).eq('clinic_id', clinicId).eq('doctor_id', id)
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteDoctor(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const id = Number(formData.get('id'))
  if (!id) return { error: 'ID gerekli' }

  const { error } = await supabase.from('doctors').update({ status: 'passive' }).eq('id', id).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  const admin = createAdminClient()
  const { data: linkedProfiles } = await admin.from('profiles').select('id').eq('clinic_id', clinicId).eq('doctor_id', id)
  for (const linked of linkedProfiles ?? []) {
    await admin.auth.admin.updateUserById(linked.id, { ban_duration: '876000h' })
  }
  await admin.from('admin_email_allowlist').update({ is_active: false }).eq('clinic_id', clinicId).eq('doctor_id', id)
  revalidatePath('/settings')
  return { success: true }
}

export async function toggleMesulMudur(doctorId: number, value: boolean): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('doctors')
    .update({ is_mesul_mudur: value })
    .eq('id', doctorId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/finance')
  return { success: true }
}
