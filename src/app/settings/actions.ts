'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { tryEncrypt } from '@/lib/crypto'

type R = { error?: string; success?: boolean } | null

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) return null
  return { supabase, clinicId: profile.clinic_id, role: profile.role, userId: user.id }
}

function requireAdmin(ctx: Awaited<ReturnType<typeof getCtx>>): R {
  return ctx && ctx.role === 'bashekim'
    ? null
    : { error: 'Bu işlem için yönetici yetkisi gerekir' }
}

// ---- Klinik ----
export async function updateClinic(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const vatPct = parseFloat((formData.get('vat_rate_pct') as string) ?? '')
  const vatBps = !isNaN(vatPct) && vatPct >= 0 && vatPct <= 100
    ? Math.round(vatPct * 100)
    : undefined
  const bankFeePct = parseFloat((formData.get('bank_fee_pct') as string) ?? '')
  const bankFeeBps = !isNaN(bankFeePct) && bankFeePct >= 0 && bankFeePct <= 100
    ? Math.round(bankFeePct * 100)
    : undefined
  const unitCount = Math.max(1, Math.round(Number(formData.get('unit_count')) || 1))

  const { error } = await supabase
    .from('clinic_settings')
    .update({
      clinic_name: (formData.get('clinic_name') as string)?.trim(),
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      tax_no: (formData.get('tax_no') as string) || null,
      tax_office: (formData.get('tax_office') as string) || null,
      address: (formData.get('address') as string) || null,
      invoice_institution: (formData.get('invoice_institution') as string)?.trim() || null,
      authorized_person: (formData.get('authorized_person') as string)?.trim() || null,
      unit_count: unitCount,
      ...(bankFeeBps !== undefined ? { bank_fee_bps: bankFeeBps } : {}),
      default_currency: ['TRY', 'USD', 'EUR', 'GBP'].includes(String(formData.get('default_currency')))
        ? String(formData.get('default_currency'))
        : 'TRY',
      is_active: formData.get('is_active') === 'on',
      ...(vatBps !== undefined ? { vat_rate: vatBps } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Randevu ayarları ----
export async function updateRandevuSettings(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const duration = Number(formData.get('default_duration'))
  const { error } = await supabase
    .from('clinic_settings')
    .update({
      work_start: (formData.get('work_start') as string) || '09:00',
      work_end: (formData.get('work_end') as string) || '18:00',
      default_duration: isNaN(duration) ? 30 : duration,
      online_booking: formData.get('online_booking') === 'on',
      require_approval: formData.get('require_approval') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function saveNightShiftSettings(input: {
  active: boolean; start: string; end: string; days: number[]; doctorIds: number[]; branchId: number | null; interval: number; note: string
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end)) return { error: 'Geçerli mesai saatleri girin' }
  if (input.active && input.days.length === 0) return { error: 'En az bir gece mesaisi günü seçin' }
  if (![15, 20, 30, 45, 60].includes(input.interval)) return { error: 'Geçersiz randevu aralığı' }
  const { error } = await ctx.supabase.from('clinic_settings').update({
    night_shift_active: input.active, night_shift_start: input.start, night_shift_end: input.end,
    night_shift_days: input.days, night_shift_doctor_ids: input.doctorIds,
    night_shift_branch_id: input.branchId, night_shift_interval: input.interval,
    night_shift_note: input.note.trim() || null, updated_at: new Date().toISOString(),
  }).eq('id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings'); revalidatePath('/appointments')
  return { success: true }
}

export async function saveAppointmentType(input: {
  id?: number; name: string; duration: number; color: string; description: string; active: boolean; branchId: number | null; doctorIds: number[]
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const name = input.name.trim()
  if (!name) return { error: 'Randevu türü adı zorunludur' }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) return { error: 'Geçerli bir renk seçin' }
  if (!Number.isInteger(input.duration) || input.duration < 5 || input.duration > 1440) return { error: 'Süre 5-1440 dakika arasında olmalı' }
  const values = { clinic_id: ctx.clinicId, name, default_duration: input.duration, color: input.color.toUpperCase(), description: input.description.trim() || null, is_active: input.active, branch_id: input.branchId, doctor_ids: input.doctorIds, updated_at: new Date().toISOString() }
  const query = input.id
    ? ctx.supabase.from('appointment_types').update(values).eq('id', input.id).eq('clinic_id', ctx.clinicId)
    : ctx.supabase.from('appointment_types').insert({ ...values, is_system: false })
  const { error } = await query
  if (error) return { error: error.code === '23505' ? 'Bu isimde bir randevu türü zaten var' : error.message }
  revalidatePath('/settings'); revalidatePath('/appointments')
  return { success: true }
}

// ---- Diş Hekimi ----
type DayHours = { start: string; end: string; clinic: string; off: boolean }
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
  if (input.create_user_account) {
    if (!row.email) {
      await supabase.from('doctors').delete().eq('id', doctor.id).eq('clinic_id', clinicId)
      return { error: 'Kullanıcı hesabı için hekim e-postası zorunludur' }
    }
    const admin = createAdminClient()
    const normalizedEmail = row.email.toLowerCase()
    const { data: existingInvite } = await admin.from('admin_email_allowlist').select('clinic_id').eq('email', normalizedEmail).maybeSingle()
    if (existingInvite && existingInvite.clinic_id !== clinicId) {
      await supabase.from('doctors').delete().eq('id', doctor.id).eq('clinic_id', clinicId)
      return { error: 'Bu e-posta başka bir kliniğe kayıtlı' }
    }
    const { error: inviteError } = await admin.from('admin_email_allowlist').upsert({
      email: normalizedEmail, clinic_id: clinicId, role: 'hekim', full_name: row.name,
      doctor_id: doctor.id, branch_id: row.branch_id, access_level: input.user_access_level === 'all' ? 'all' : 'branch', is_active: row.status === 'active',
    }, { onConflict: 'email' })
    if (inviteError) {
      await supabase.from('doctors').delete().eq('id', doctor.id).eq('clinic_id', clinicId)
      return { error: inviteError.message }
    }
    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingUser = authUsers.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
    if (existingUser) {
      await admin.from('profiles').update({
        clinic_id: clinicId, role: 'hekim', doctor_id: doctor.id, branch_id: row.branch_id,
        active_branch_id: row.branch_id, access_level: input.user_access_level === 'all' ? 'all' : 'branch',
        updated_at: new Date().toISOString(),
      }).eq('id', existingUser.id)
    }
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

// ---- Kullanıcı (allowlist) ----
const VALID_ROLES = ['bashekim', 'responsible_manager', 'hekim', 'asistan']

export async function addUserToAllowlist(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const fullName = (formData.get('full_name') as string)?.trim() || null
  const role = (formData.get('role') as string) || 'asistan'
  const branchId = Number(formData.get('branch_id')) || null
  const accessLevel = formData.get('access_level') === 'all' ? 'all' : 'branch'
  if (!email) return { error: 'E-posta zorunludur' }
  if (!VALID_ROLES.includes(role)) return { error: 'Geçersiz rol' }

  const admin = createAdminClient()

  const { data: existingAllowlist, error: existingError } = await admin
    .from('admin_email_allowlist')
    .select('clinic_id')
    .eq('email', email)
    .maybeSingle()
  if (existingError) return { error: existingError.message }
  if (existingAllowlist && existingAllowlist.clinic_id !== ctx.clinicId) {
    return { error: 'Bu e-posta başka bir kliniğe kayıtlı' }
  }

  // Hekim rolü → bir doctors kaydıyla ilişkilendir (mevcut veya yeni).
  let doctorId: number | null = null
  if (role === 'hekim') {
    const doctorChoice = (formData.get('doctor_id') as string) || ''
    if (doctorChoice === 'new') {
      const docName = fullName || email.split('@')[0]
      const { data: newDoc, error: docErr } = await admin
        .from('doctors')
        .insert({ clinic_id: ctx.clinicId, name: docName, status: 'active' })
        .select('id')
        .single()
      if (docErr || !newDoc) return { error: docErr?.message ?? 'Hekim profili oluşturulamadı' }
      doctorId = newDoc.id
    } else if (doctorChoice) {
      const n = Number(doctorChoice)
      // Hekimin bu kliniğe ait olduğunu doğrula
      const { data: doc } = await admin
        .from('doctors')
        .select('id')
        .eq('id', n)
        .eq('clinic_id', ctx.clinicId)
        .maybeSingle()
      if (doc) doctorId = doc.id
    }
  }

  if (branchId) {
    const { data: branch } = await ctx.supabase.from('branches').select('id').eq('id', branchId).eq('clinic_id', ctx.clinicId).maybeSingle()
    if (!branch) return { error: 'Seçilen şube bu kliniğe ait değil' }
  }
  const { error } = await admin.from('admin_email_allowlist').upsert(
    { email, clinic_id: ctx.clinicId, role, full_name: fullName, doctor_id: doctorId, branch_id: branchId, access_level: accessLevel, is_active: true },
    { onConflict: 'email' }
  )

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// Kullanıcının rolünü değiştirir (sadece admin; kendi rolünü değiştiremez).
export async function updateUserRole(userId: string, role: string): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!userId) return { error: 'Kullanıcı ID gerekli' }
  if (ctx.userId === userId) return { error: 'Kendi rolünüzü değiştiremezsiniz' }
  if (!VALID_ROLES.includes(role)) return { error: 'Geçersiz rol' }

  // Sadece kendi kliniğindeki kullanıcıyı güncelle
  let doctorId: number | null | undefined
  if (role === 'hekim') {
    const { data: target } = await ctx.supabase.from('profiles').select('full_name, doctor_id, branch_id').eq('id', userId).eq('clinic_id', ctx.clinicId).maybeSingle()
    if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }
    doctorId = target.doctor_id
    if (!doctorId) {
      const admin = createAdminClient()
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      const email = authUser.user?.email ?? null
      const { data: existingDoctor } = email
        ? await ctx.supabase.from('doctors').select('id').eq('clinic_id', ctx.clinicId).ilike('email', email).maybeSingle()
        : { data: null }
      if (existingDoctor) doctorId = existingDoctor.id
      else {
        const { data: created, error: doctorError } = await ctx.supabase.from('doctors').insert({
          clinic_id: ctx.clinicId, branch_id: target.branch_id, name: target.full_name || email?.split('@')[0] || 'Yeni Hekim', email, status: 'active', title: 'Diş Hekimi',
        }).select('id').single()
        if (doctorError || !created) return { error: doctorError?.message ?? 'Hekim profili oluşturulamadı' }
        doctorId = created.id
      }
    }
  }
  const { error } = await ctx.supabase
    .from('profiles')
    .update({ role, ...(doctorId ? { doctor_id: doctorId } : {}), updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('clinic_id', ctx.clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// Hesabı pasife alır/aktive eder (Supabase yerleşik ban; sadece admin, kendini değil).
export async function setUserActive(userId: string, active: boolean): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!userId) return { error: 'Kullanıcı ID gerekli' }
  if (ctx.userId === userId) return { error: 'Kendi hesabınızı pasife alamazsınız' }

  // Kullanıcının bu kliniğe ait olduğunu doğrula
  const { data: prof } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!prof) return { error: 'Kullanıcı bu klinikte bulunamadı' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h', // ~100 yıl
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Rol İzin Matrisi ----
export interface RolePermissionRow {
  role_name: string
  resource: string
  can_view: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

const VALID_PERMISSION_ROLES = ['bashekim', 'responsible_manager', 'hekim', 'asistan']
const VALID_RESOURCES = [
  'randevu_sube', 'randevu_tum', 'hasta_liste', 'hasta_karti',
  'oral_kendi', 'oral_sube', 'oral_tum', 'not_goruntu', 'hesap',
  'fatura', 'recete', 'finans_bilgi', 'finans_borclar', 'finans_defter',
  'finans_bakiye', 'hakedis_kendi', 'hakedis_tum', 'is_ortaklari',
  'ayarlar_klinik', 'ayarlar_hekim', 'ayarlar_kullanici',
  'ayarlar_tarife', 'ayarlar_randevu',
]

export async function getRolePermissions(): Promise<{ data?: RolePermissionRow[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { data, error } = await ctx.supabase
    .from('role_permissions')
    .select('role_name, resource, can_view, can_create, can_update, can_delete')
    .eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  return { data: (data ?? []) as RolePermissionRow[] }
}

// Bir rol+kaynak satırının tüm iznini tek seferde yazar (upsert).
// Sadece başhekim düzenleyebilir.
export async function updateRolePermission(input: {
  roleName: string
  resource: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (ctx.role !== 'bashekim') return { error: 'Bu işlem için başhekim yetkisi gerekir' }
  if (!VALID_PERMISSION_ROLES.includes(input.roleName)) return { error: 'Geçersiz rol' }
  if (!VALID_RESOURCES.includes(input.resource)) return { error: 'Geçersiz kaynak' }

  const { error } = await ctx.supabase.from('role_permissions').upsert(
    {
      clinic_id: ctx.clinicId,
      role_name: input.roleName,
      resource: input.resource,
      can_view: input.canView,
      can_create: input.canCreate,
      can_update: input.canUpdate,
      can_delete: input.canDelete,
    },
    { onConflict: 'clinic_id,role_name,resource' }
  )
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Kullanıcı Bazlı İzin Override ----
export interface UserPermissionRow {
  resource: string
  can_view: boolean | null
  can_create: boolean | null
  can_update: boolean | null
  can_delete: boolean | null
}

export interface PermissionFields {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

function mergeRow(role: RolePermissionRow | undefined, override: UserPermissionRow | undefined): PermissionFields {
  const pick = (field: 'can_view' | 'can_create' | 'can_update' | 'can_delete'): boolean =>
    (override?.[field] ?? role?.[field] ?? false) === true
  return {
    canView: pick('can_view'),
    canCreate: pick('can_create'),
    canUpdate: pick('can_update'),
    canDelete: pick('can_delete'),
  }
}

// Bir rolün varsayılan (şablon) izinlerini döner.
export async function getRoleTemplate(roleName: string): Promise<{ data?: RolePermissionRow[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (!VALID_PERMISSION_ROLES.includes(roleName)) return { error: 'Geçersiz rol' }
  const { data, error } = await ctx.supabase
    .from('role_permissions')
    .select('role_name, resource, can_view, can_create, can_update, can_delete')
    .eq('clinic_id', ctx.clinicId)
    .eq('role_name', roleName)
  if (error) return { error: error.message }
  return { data: (data ?? []) as RolePermissionRow[] }
}

// Belirli bir kullanıcı + kaynak için GEÇERLİ izni döner (override varsa
// öncelikli, yoksa rol şablonuna düşer).
export async function getEffectivePermissions(userId: string, resource: string): Promise<{ data?: PermissionFields; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (!VALID_RESOURCES.includes(resource)) return { error: 'Geçersiz kaynak' }

  const { data: target } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }

  const [{ data: roleRow }, { data: overrideRow }] = await Promise.all([
    ctx.supabase.from('role_permissions').select('role_name, resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId).eq('role_name', target.role).eq('resource', resource).maybeSingle(),
    ctx.supabase.from('user_permissions').select('resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId).eq('user_id', userId).eq('resource', resource).maybeSingle(),
  ])

  return { data: mergeRow((roleRow ?? undefined) as RolePermissionRow | undefined, (overrideRow ?? undefined) as UserPermissionRow | undefined) }
}

// Bir kullanıcının rol şablonu + tüm override kayıtlarını tek seferde döner
// (Ayarlar → Kullanıcı izin paneli bunu kullanır, 23 ayrı çağrı yapmaz).
export async function getUserPermissionsPanel(userId: string): Promise<{
  data?: { role: string; template: RolePermissionRow[]; overrides: UserPermissionRow[] }
  error?: string
}> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }

  const { data: target } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }

  const [{ data: template, error: templateErr }, { data: overrides, error: overrideErr }] = await Promise.all([
    ctx.supabase.from('role_permissions').select('role_name, resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId).eq('role_name', target.role),
    ctx.supabase.from('user_permissions').select('resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId).eq('user_id', userId),
  ])
  if (templateErr) return { error: templateErr.message }
  if (overrideErr) return { error: overrideErr.message }

  return {
    data: {
      role: target.role,
      template: (template ?? []) as RolePermissionRow[],
      overrides: (overrides ?? []) as UserPermissionRow[],
    },
  }
}

// Bir kullanıcı+kaynak override'ını yazar. Verilmeyen (undefined) alanlar
// NULL kalır/kalmaya devam eder → rol şablonuna düşer. Sadece başhekim.
export async function updateUserPermission(input: {
  userId: string
  resource: string
  canView?: boolean | null
  canCreate?: boolean | null
  canUpdate?: boolean | null
  canDelete?: boolean | null
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (ctx.role !== 'bashekim') return { error: 'Bu işlem için başhekim yetkisi gerekir' }
  if (!VALID_RESOURCES.includes(input.resource)) return { error: 'Geçersiz kaynak' }

  const { data: target } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('id', input.userId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }

  // Mevcut override satırını al, sadece gönderilen alanları güncelle
  const { data: existing } = await ctx.supabase
    .from('user_permissions')
    .select('can_view, can_create, can_update, can_delete')
    .eq('clinic_id', ctx.clinicId)
    .eq('user_id', input.userId)
    .eq('resource', input.resource)
    .maybeSingle()

  const { error } = await ctx.supabase.from('user_permissions').upsert(
    {
      clinic_id: ctx.clinicId,
      user_id: input.userId,
      resource: input.resource,
      can_view: input.canView !== undefined ? input.canView : existing?.can_view ?? null,
      can_create: input.canCreate !== undefined ? input.canCreate : existing?.can_create ?? null,
      can_update: input.canUpdate !== undefined ? input.canUpdate : existing?.can_update ?? null,
      can_delete: input.canDelete !== undefined ? input.canDelete : existing?.can_delete ?? null,
    },
    { onConflict: 'clinic_id,user_id,resource' }
  )
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// Kullanıcının TÜM override kayıtlarını siler — rol şablonuna döner.
// Sadece başhekim.
export async function resetUserPermissions(userId: string): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (ctx.role !== 'bashekim') return { error: 'Bu işlem için başhekim yetkisi gerekir' }

  const { data: target } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }

  const { error } = await ctx.supabase
    .from('user_permissions')
    .delete()
    .eq('clinic_id', ctx.clinicId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Şube yönetimi ----
export async function addBranch(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const name = String(formData.get('name') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toLocaleUpperCase('tr-TR')
  if (!name || !code) return { error: 'Şube adı ve kodu zorunludur' }
  const { error } = await ctx.supabase.from('branches').insert({
    clinic_id: ctx.clinicId,
    name,
    code,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    address: String(formData.get('address') ?? '').trim() || null,
    authorized_person: String(formData.get('authorized_person') ?? '').trim() || null,
    unit_count: Math.max(1, Math.round(Number(formData.get('unit_count')) || 1)),
    work_start: String(formData.get('work_start') ?? '') || '09:00',
    work_end: String(formData.get('work_end') ?? '') || '18:00',
    bank_accounts: String(formData.get('bank_accounts') ?? '').trim() || null,
    cash_accounts: String(formData.get('cash_accounts') ?? '').trim() || null,
    is_active: formData.get('is_active') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateBranch(id: number, input: {
  name: string; code: string; phone?: string; email?: string; address?: string;
  authorizedPerson?: string; unitCount: number; workStart: string; workEnd: string;
  bankAccounts?: string; cashAccounts?: string; isActive: boolean;
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!input.name.trim() || !input.code.trim()) return { error: 'Şube adı ve kodu zorunludur' }
  const { error } = await ctx.supabase.from('branches').update({
    name: input.name.trim(), code: input.code.trim().toLocaleUpperCase('tr-TR'),
    phone: input.phone?.trim() || null, email: input.email?.trim() || null,
    address: input.address?.trim() || null, authorized_person: input.authorizedPerson?.trim() || null,
    unit_count: Math.max(1, Math.round(input.unitCount || 1)), work_start: input.workStart || '09:00',
    work_end: input.workEnd || '18:00', bank_accounts: input.bankAccounts?.trim() || null,
    cash_accounts: input.cashAccounts?.trim() || null, is_active: input.isActive, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function setActiveBranch(branchId: number | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (branchId) {
    const { data: branch } = await ctx.supabase.from('branches').select('id').eq('id', branchId).eq('clinic_id', ctx.clinicId).maybeSingle()
    if (!branch) return { error: 'Bu şubeye erişiminiz yok' }
  } else if (ctx.role !== 'bashekim') {
    return { error: 'Tüm şubeler görünümü için yetkiniz yok' }
  }
  const { error } = await ctx.supabase.from('profiles').update({ active_branch_id: branchId, updated_at: new Date().toISOString() }).eq('id', ctx.userId).eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

// ---- Logo yükleme ----
export async function uploadClinicLogo(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'Dosya seçilmedi' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Logo 2 MB\'dan büyük olamaz' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) return { error: 'Sadece PNG, JPG, SVG veya WebP desteklenir' }

  const admin = createAdminClient()
  const bucket = 'clinic-logos'

  // Bucket yoksa oluştur (idempotent)
  const { data: buckets, error: bucketListError } = await admin.storage.listBuckets()
  if (bucketListError) return { error: bucketListError.message }
  if (!buckets?.find((b) => b.name === bucket)) {
    const { error: bucketError } = await admin.storage.createBucket(bucket, { public: true, fileSizeLimit: 2097152 })
    if (bucketError) return { error: bucketError.message }
  }

  const path = `${clinicId}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadErr) return { error: uploadErr.message }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)
  // Önbellek kırmak için timestamp ekle
  const url = `${publicUrl}?t=${Date.now()}`

  const { error: updateErr } = await supabase
    .from('clinic_settings')
    .update({ logo_url: url, updated_at: new Date().toISOString() })
    .eq('id', clinicId)
  if (updateErr) {
    if (updateErr.message.includes('logo_url') || updateErr.code === '42703') {
      return { error: 'DB migration gerekli: Supabase Dashboard → SQL Editor\'da supabase/migrations/20260623_duration_logo.sql dosyasını çalıştırın.' }
    }
    return { error: updateErr.message }
  }

  revalidatePath('/settings')
  revalidatePath('/patients')
  return { success: true }
}

// ---- Tarife ----
export async function deleteTariffItem(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const id = Number(formData.get('id'))
  if (!id) return { error: 'ID gerekli' }

  const { error } = await supabase.from('tariffs').delete().eq('id', id).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- TDB 2024 Tarife İçe Aktar ----
// Fiyatlar kuruş cinsinden (Toplam / KDV dahil)
type TdbItem = { treatment_name: string; price: number }
type TdbCategory = { category: string; items: TdbItem[] }

const TDB_2024: TdbCategory[] = [
  {
    category: 'Muayene ve Teşhis',
    items: [
      { treatment_name: 'Dişhekimi Muayenesi', price: 25000 },
      { treatment_name: 'Uzman Dişhekimi Muayenesi', price: 75000 },
      { treatment_name: 'Kontrol Hekim Muayenesi', price: 71500 },
      { treatment_name: 'Konsültasyon', price: 60000 },
      { treatment_name: 'Uzman Diş Hekimi Konsültasyonu', price: 75500 },
      { treatment_name: 'Diş Röntgen Filmi (Periapikal)', price: 34000 },
      { treatment_name: 'Bite Wing Radyografi', price: 34000 },
      { treatment_name: 'Oklüzal Film', price: 37000 },
      { treatment_name: 'Exstra Oral Röntgen Filmi', price: 43000 },
      { treatment_name: 'Panoramik Film', price: 40000 },
      { treatment_name: 'Lateral Sefalometrik Film', price: 111500 },
      { treatment_name: 'Antero-Posterior Sefalometrik Film', price: 110000 },
      { treatment_name: 'Radyo Vizyografi (RVG)', price: 48500 },
      { treatment_name: 'Bilgisayarlı Tomografi (Bölgesel)', price: 119500 },
      { treatment_name: 'Bilgisayarlı Tomografi (Tek Çene)', price: 295000 },
      { treatment_name: 'Bilgisayarlı Tomografi (İki Çene)', price: 364000 },
      { treatment_name: 'Ağız İçi Dijital Tarama', price: 275000 },
      { treatment_name: 'T.M.E. Filmi ve Tetkiki', price: 165500 },
      { treatment_name: 'Oral Hijyen Eğitimi', price: 50000 },
      { treatment_name: 'Vitalite Kontrolü (Diş Başına)', price: 11000 },
      { treatment_name: 'Lokal Anestezi (İnfiltratif)', price: 15000 },
      { treatment_name: 'Lokal Anestezi (Rejyonal)', price: 15000 },
      { treatment_name: 'Teşhis ve Tedavi Planlaması', price: 94500 },
      { treatment_name: 'Bilinçli Sedasyon', price: 47000 },
    ],
  },
  {
    category: 'Endodonti (Kanal Tedavisi)',
    items: [
      { treatment_name: 'Kanal Tedavisi (Tek Kanal)', price: 300000 },
      { treatment_name: 'Kanal Tedavisi (İki Kanal)', price: 364500 },
      { treatment_name: 'Kanal Tedavisi (Üç Kanal)', price: 400000 },
      { treatment_name: 'Kanal Tedavisi (İlave Her Kanal)', price: 135000 },
      { treatment_name: 'Kanal Tedavisi (Biyoseramik)', price: 520000 },
      { treatment_name: 'Kanal Yenileme (Retreatment)', price: 800000 },
      { treatment_name: 'Kanal Dolgusu Sökümü (Her Kanal)', price: 99000 },
      { treatment_name: 'Kanal Dolgusu Tekrarı (Her Kanal)', price: 200000 },
      { treatment_name: 'Periapikal Lezyonlu Diş — Tek Kanal', price: 253500 },
      { treatment_name: 'Periapikal Lezyonlu Diş — İki Kanal', price: 375500 },
      { treatment_name: 'Periapikal Lezyonlu Diş — Üç Kanal', price: 519000 },
      { treatment_name: 'Kanaldan Kırılmış Materyal Çıkarma', price: 322000 },
      { treatment_name: 'Kanalda Perforasyon Tamiri (MTA)', price: 169500 },
      { treatment_name: 'Endokron', price: 500000 },
      { treatment_name: 'Ekstirpasyon (Her Kanal)', price: 95500 },
      { treatment_name: 'Pansuman (Seans Başı)', price: 47000 },
      { treatment_name: 'Kanal Pansumanı (Seans Başı)', price: 61000 },
      { treatment_name: 'Rubber-Dam Uygulaması', price: 57000 },
      { treatment_name: 'Dolgu Sökümü (Tek Diş)', price: 42000 },
      { treatment_name: 'Dolgu (Restorasyon) Tamiri', price: 161500 },
    ],
  },
  {
    category: 'Konservatif Diş Tedavisi',
    items: [
      { treatment_name: 'Kompozit Dolgu (1 Yüzlü)', price: 164000 },
      { treatment_name: 'Kompozit Dolgu (2 Yüzlü)', price: 205500 },
      { treatment_name: 'Kompozit Dolgu (3 Yüzlü — MOD)', price: 256000 },
      { treatment_name: 'Amalgam Dolgu (1 Yüzlü)', price: 146500 },
      { treatment_name: 'Amalgam Dolgu (2 Yüzlü)', price: 187000 },
      { treatment_name: 'Amalgam Dolgu (3 Yüzlü — MOD)', price: 234500 },
      { treatment_name: 'Cam İonomer Dolgu', price: 125000 },
      { treatment_name: 'İnley Dolgu (1 Yüzlü)', price: 335500 },
      { treatment_name: 'İnley Dolgu (2 Yüzlü)', price: 342500 },
      { treatment_name: 'İnley Dolgu (3 Yüzlü — MOD)', price: 352000 },
      { treatment_name: 'Kompozit İnley (1 Yüzlü)', price: 288000 },
      { treatment_name: 'Kompozit İnley (2 Yüzlü)', price: 330500 },
      { treatment_name: 'Kompozit İnley (3 Yüzlü)', price: 364000 },
      { treatment_name: 'Seramik İnley (1 Yüzlü)', price: 841500 },
      { treatment_name: 'Seramik İnley (2 Yüzlü)', price: 991000 },
      { treatment_name: 'Seramik İnley (3 Yüzlü)', price: 1046000 },
      { treatment_name: 'Onley', price: 412000 },
      { treatment_name: 'Onley (Seramik)', price: 1056500 },
      { treatment_name: 'Estetik Dolgu', price: 350000 },
      { treatment_name: 'Fissür Örtülmesi (Sealant — Tek Diş)', price: 50000 },
      { treatment_name: 'Kuafaj (Dolgu Hariç)', price: 22500 },
      { treatment_name: 'Direkt Kompozit Veneer Restorasyon', price: 457500 },
      { treatment_name: 'Laminate Veneer (Kompozit)', price: 500000 },
      { treatment_name: 'Kanal İçi Hazır Post Uygulaması', price: 150000 },
      { treatment_name: 'Kanal İçi Fiber Post Uygulaması', price: 200000 },
      { treatment_name: 'Diş Ağartma — Devital (Tek Diş)', price: 400000 },
      { treatment_name: 'Diş Ağartma — Vital (Tek Çene)', price: 600000 },
      { treatment_name: 'Diastema Kapatma (Diş Başına)', price: 300000 },
    ],
  },
  {
    category: 'Protez',
    items: [
      { treatment_name: 'Tam Protez — Akrilik (Tek Çene)', price: 1700000 },
      { treatment_name: 'Tam Protez — Metal (Tek Çene)', price: 2200000 },
      { treatment_name: 'Bölümlü Protez — Akrilik (Tek Çene)', price: 1200000 },
      { treatment_name: 'Bölümlü Protez — Metal (Tek Çene)', price: 1500000 },
      { treatment_name: 'Hassas Tutuculu Protez (Tek Çene)', price: 3000000 },
      { treatment_name: 'Gece Plağı (Sert Oklüzal Splint)', price: 500000 },
      { treatment_name: 'Gece Plağı (Yumuşak)', price: 316500 },
      { treatment_name: 'Zirkonyum Kuron', price: 750000 },
      { treatment_name: 'Tam Seramik Kuron (Metal Desteksiz)', price: 1261000 },
      { treatment_name: 'Laminate Veneer Kuron (Seramik)', price: 1200000 },
      { treatment_name: 'Veneer Kuron (Seramik)', price: 603500 },
      { treatment_name: 'Tek Parça Döküm Kuron', price: 579000 },
      { treatment_name: 'Jaket Kuron (Seramik)', price: 381000 },
      { treatment_name: 'Geçici Kuron (Tek Diş)', price: 111500 },
      { treatment_name: 'Kuron Sökümü', price: 94000 },
      { treatment_name: 'Döküm Post Core (Pivo)', price: 385000 },
      { treatment_name: 'Adeziv Köprü (Maryland)', price: 594500 },
      { treatment_name: 'Pontik', price: 175000 },
      { treatment_name: 'Metal Destekli Porselen', price: 175000 },
      { treatment_name: 'Porselen', price: 500000 },
      { treatment_name: 'Katana', price: 900000 },
      { treatment_name: 'Besleme (Tek Çene)', price: 400000 },
      { treatment_name: 'Kaide Yenileme — Rebazaj (Tek Çene)', price: 1000000 },
      { treatment_name: 'Protez Tamiri (Akrilik)', price: 100000 },
      { treatment_name: 'Diş İlavesi (Tek Diş)', price: 150000 },
    ],
  },
  {
    category: 'Ağız, Diş ve Çene Cerrahisi',
    items: [
      { treatment_name: 'Diş Çekimi', price: 100000 },
      { treatment_name: 'Komplikasyonlu Diş Çekimi', price: 100000 },
      { treatment_name: 'Gömülü Diş Operasyonu', price: 500000 },
      { treatment_name: 'Gömülü Diş Operasyonu (Kemik Retansiyonlu)', price: 300000 },
      { treatment_name: 'Koronektomi', price: 1045000 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (Tek Köklü)', price: 500000 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (İki Köklü)', price: 584500 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (Üç Köklü)', price: 669500 },
      { treatment_name: 'Kist Operasyonu (Basit)', price: 600000 },
      { treatment_name: 'Kist Operasyonu (Komplike)', price: 694500 },
      { treatment_name: 'Frenektomi Operasyonu', price: 600000 },
      { treatment_name: 'Biyopsi', price: 377000 },
      { treatment_name: 'Epulis Operasyonu', price: 200000 },
      { treatment_name: 'Apse Drenajı (İntraoral)', price: 469000 },
      { treatment_name: 'Apse Drenajı (Extraoral)', price: 542500 },
      { treatment_name: 'Alveolit Cerrahi Tedavisi', price: 150000 },
      { treatment_name: 'Alveol Plastiği (Yarım Çene)', price: 480500 },
      { treatment_name: 'Sinüs Lifting (Biomateryal Hariç)', price: 654500 },
      { treatment_name: 'Açık Sinüs Lift', price: 400000 },
      { treatment_name: 'Sert Doku Greftleme (Greft Hariç)', price: 705000 },
      { treatment_name: 'Yumuşak Doku Greftleme (Greft Hariç)', price: 610500 },
      { treatment_name: 'Kemik İçi İmplant (İmplant Ücreti Hariç)', price: 1397500 },
      { treatment_name: 'İmplant Çıkarılması', price: 533500 },
      { treatment_name: 'Botoks Uygulama (İlaç Hariç)', price: 627500 },
      { treatment_name: 'Kapişon İzalesi / İmplant Üstü Açılması', price: 219000 },
    ],
  },
  {
    category: 'Periodontoloji',
    items: [
      { treatment_name: 'Detertraj — Diş Taşı Temizliği (Tek Çene)', price: 200000 },
      { treatment_name: 'Subgingival Küretaj (Tek Diş)', price: 300000 },
      { treatment_name: 'Gingivektomi (Tek Diş)', price: 500000 },
      { treatment_name: 'Gingivoplasti (Tek Diş)', price: 161500 },
      { treatment_name: 'Flap Operasyonu (Tek Diş)', price: 1500000 },
      { treatment_name: 'Periodontal Apse Tedavisi', price: 187000 },
      { treatment_name: 'Periodontal Şine — Daimi', price: 366500 },
      { treatment_name: 'Periodontal Şine — Geçici', price: 549000 },
      { treatment_name: 'Serbest Diş Eti Grefti', price: 217500 },
      { treatment_name: 'Subepitelyal Bağ Dokusu Grefti', price: 331000 },
      { treatment_name: 'Peri-İmplantitis Cerrahi (Tek İmplant)', price: 364000 },
      { treatment_name: 'Peri-İmplantitis Cerrahi Olmayan (Tek İmplant)', price: 152500 },
      { treatment_name: 'Polisaj', price: 70000 },
      { treatment_name: 'Yüzeysel Flor Uygulaması (Yarım Çene)', price: 50000 },
    ],
  },
  {
    category: 'Pedodonti',
    items: [
      { treatment_name: 'Süt Dişi Kanal Tedavisi', price: 289500 },
      { treatment_name: 'Amputasyon Vital (Pulpotomi)', price: 150000 },
      { treatment_name: 'Kompomer Dolgu', price: 194500 },
      { treatment_name: 'Prefabrike Kron', price: 192000 },
      { treatment_name: 'Strip Kron', price: 188000 },
      { treatment_name: 'Fissür Örtülmesi (Tek Diş)', price: 50000 },
      { treatment_name: 'Yer Tutucu (Sabit)', price: 350000 },
      { treatment_name: 'Yer Tutucu (Hareketli)', price: 600000 },
      { treatment_name: 'Travma Splinti', price: 150000 },
      { treatment_name: 'Açık Apeksli Dişte Kanal Tedavisi (Her Kanal)', price: 600000 },
    ],
  },
  {
    category: 'Ortodonti',
    items: [
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf I)', price: 1585500 },
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf II)', price: 2007500 },
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf III)', price: 2452000 },
      { treatment_name: 'Sabit Tedavi', price: 10000000 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Hafif)', price: 2625500 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Orta)', price: 3625000 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Ağır)', price: 4931000 },
      { treatment_name: 'Pekiştirme Tedavisi', price: 422000 },
      { treatment_name: 'Sabit Pekiştirme — Lingual Retainer', price: 522000 },
      { treatment_name: 'Önleyici Ortodontik Tedavi', price: 1136500 },
      { treatment_name: 'Tek Çeneyi İlgilendiren Aparey', price: 384500 },
      { treatment_name: 'Hızlı Maksiller Genişletme Apareyi', price: 682000 },
      { treatment_name: 'Nance Apareyi', price: 567500 },
      { treatment_name: 'Lingual Ark', price: 400500 },
      { treatment_name: 'Ağız İçi Koruyucu Aparey', price: 1100000 },
      { treatment_name: 'Lateral Sefalometrik Film Analizi', price: 79000 },
      { treatment_name: 'Bilgisayarlı Sefalometrik Film Analizi', price: 132000 },
      { treatment_name: 'Ortodontik Fotoğraf', price: 45500 },
      { treatment_name: 'Ortodontik Model Yapımı', price: 64000 },
    ],
  },
]

// TDB_CURRENT_YEAR: her yeni TDB tarifesi yayınlandığında bu sabiti ve TDB_2024 verisini güncelle
const TDB_CURRENT_YEAR = 2024

export type TariffProfile = {
  id: number
  name: string
  source: 'tdb' | 'custom'
  tdb_year: number | null
  is_default: boolean
  last_synced_at: string | null
  created_at: string
}

export async function importTdb2024(_prev: R, formData: FormData): Promise<R> {
  void _prev
  void formData
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  // Mevcut TDB profili var mı kontrol et
  const { data: existing } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('source', 'tdb')
    .eq('tdb_year', TDB_CURRENT_YEAR)
    .maybeSingle()
  if (existing) return { error: `TDB ${TDB_CURRENT_YEAR} tarifesi zaten mevcut. Güncellemek için profil üzerindeki "Yenile" düğmesini kullanın.` }

  // Profil oluştur
  const { data: profile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: `TDB ${TDB_CURRENT_YEAR}`, source: 'tdb', tdb_year: TDB_CURRENT_YEAR, last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (profileErr || !profile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const rows = TDB_2024.flatMap(({ category, items }) =>
    items.map(({ treatment_name, price }) => ({
      clinic_id: clinicId,
      profile_id: profile.id,
      category,
      treatment_name,
      price,
      currency: 'TRY',
      is_active: true,
    }))
  )

  const { error } = await supabase.from('tariffs').insert(rows)
  if (error) {
    await supabase.from('tariff_profiles').delete().eq('id', profile.id)
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function syncTdbProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  // Profili bu kliniğe ait ve TDB kaynaklı olduğunu doğrula
  const { data: prof } = await supabase
    .from('tariff_profiles')
    .select('id, tdb_year')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .eq('source', 'tdb')
    .single()
  if (!prof) return { error: 'Profil bulunamadı' }

  // Atomik: delete + insert tek transaction içinde (sync_tdb_tariffs RPC)
  const items = TDB_2024.flatMap(({ category, items }) =>
    items.map(({ treatment_name, price }) => ({
      category,
      treatment_name,
      price,
      currency: 'TRY',
    }))
  )
  const { error } = await supabase.rpc('sync_tdb_tariffs', {
    p_profile_id: profileId,
    p_clinic_id: clinicId,
    p_items: items,
  })
  if (error) return { error: error.message }

  await supabase
    .from('tariff_profiles')
    .update({ tdb_year: TDB_CURRENT_YEAR, last_synced_at: new Date().toISOString() })
    .eq('id', profileId)

  revalidatePath('/settings')
  return { success: true }
}

// ---- Tufanbeyli Tarifesi ----
type TufanItem = { code: string; name: string; price: number; currency: string }
type TufanCategory = { category: string; items: TufanItem[] }

const TUFANBEYLI_DATA: TufanCategory[] = [
  {
    category: 'Endodonti',
    items: [
      { code: '02-999-996', name: 'Kanal Yenileme (Retreatment)', price: 800000, currency: 'TRY' },
      { code: '02-999-997', name: 'Kanal Tedavisi', price: 500000, currency: 'TRY' },
    ],
  },
  {
    category: 'Pedodonti',
    items: [
      { code: '03-001-001', name: 'Fissür Örtülmesi (Sealant-Tek Diş)', price: 50000, currency: 'TRY' },
      { code: '03-002-001', name: 'Yüzeysel Flor Uygulaması (Yarım Çene)', price: 50000, currency: 'TRY' },
      { code: '03-004-001', name: 'Yer Tutucu (Sabit)', price: 350000, currency: 'TRY' },
      { code: '03-005-001', name: 'Yer Tutucu (Hareketli)', price: 600000, currency: 'TRY' },
      { code: '03-016-001', name: 'Süt Dişi Kanal Tedavisi', price: 289500, currency: 'TRY' },
      { code: '03-999-998', name: 'Akrilik Yer Tutucu', price: 100000, currency: 'TRY' },
    ],
  },
  {
    category: 'Protez',
    items: [
      { code: '04-001-001', name: 'Tam Protez (Akrilik-Tek Çene)', price: 1700000, currency: 'TRY' },
      { code: '04-003-001', name: 'Tam Protez (Metal-Tek Çene)', price: 2200000, currency: 'TRY' },
      { code: '04-005-001', name: 'Hassas Tutuculu Protezler (Tek Çene)', price: 3000000, currency: 'TRY' },
      { code: '04-008-001', name: 'Besleme (Tek Çene)', price: 400000, currency: 'TRY' },
      { code: '04-009-001', name: 'Kaide Yenileme (Rebazaj - Tek Çene)', price: 1000000, currency: 'TRY' },
      { code: '04-011-001', name: 'Proteze Yumuşak Akrilik (Daimi Tek Çene)', price: 1000000, currency: 'TRY' },
      { code: '04-019-001', name: 'Gece Plağı (Bruksizm - Sert)', price: 500000, currency: 'TRY' },
      { code: '04-025-001', name: 'Laminate Veneer Kuron (Seramik)', price: 1200000, currency: 'TRY' },
      { code: '04-047-001', name: 'Zirkonyum Kuron', price: 750000, currency: 'TRY' },
      { code: '04-999-989', name: 'İmplant Üstü Multi', price: 6500000, currency: 'TRY' },
      { code: '04-999-990', name: 'İmplant Üstü Simante', price: 4600000, currency: 'TRY' },
      { code: '04-999-991', name: 'Porselen Hibrit Protez', price: 12000000, currency: 'TRY' },
      { code: '04-999-992', name: 'Katana', price: 900000, currency: 'TRY' },
      { code: '04-999-994', name: 'Porselen', price: 500000, currency: 'TRY' },
      { code: '04-999-996', name: 'Akrilik Hibrit Protez', price: 9000000, currency: 'TRY' },
    ],
  },
  {
    category: 'Ağız, Diş ve Çene Cerrahisi',
    items: [
      { code: '05-001-001', name: 'Diş Çekimi', price: 100000, currency: 'TRY' },
      { code: '05-003-001', name: 'Gömülü Diş Operasyonu', price: 500000, currency: 'TRY' },
      { code: '05-005-001', name: 'Tek Kökte Kök Ucu Rezeksiyonu', price: 500000, currency: 'TRY' },
      { code: '05-012-001', name: 'Kist Operasyonu (Basit)', price: 600000, currency: 'TRY' },
      { code: '05-016-001', name: 'Frenektomi Operasyonu', price: 600000, currency: 'TRY' },
      { code: '05-056-001', name: 'Koronektomi', price: 1045000, currency: 'TRY' },
      { code: '05-999-979', name: 'HiOSSen İmplant', price: 3500000, currency: 'TRY' },
      { code: '05-999-980', name: 'Bredent İmplant', price: 3400000, currency: 'TRY' },
      { code: '05-999-982', name: 'Osstem İmplant', price: 2500000, currency: 'TRY' },
      { code: '05-999-987', name: 'NucleOss İmplant', price: 2000000, currency: 'TRY' },
      { code: '05-999-988', name: 'DXL İmplant', price: 3000000, currency: 'TRY' },
      { code: '05-999-992', name: 'Açık Sinüs Lift', price: 400000, currency: 'TRY' },
      { code: '05-999-993', name: 'Membran Uygulaması', price: 11000, currency: 'EUR' },
      { code: '05-999-994', name: 'Greft Uygulaması (1cc)', price: 11000, currency: 'USD' },
    ],
  },
  {
    category: 'Periodontoloji',
    items: [
      { code: '06-002-001', name: 'Detertraj (Diş Taşı Temizliği-Tek Çene)', price: 200000, currency: 'TRY' },
      { code: '06-007-001', name: 'Flap Operasyonu (Tek Diş)', price: 1500000, currency: 'TRY' },
    ],
  },
  {
    category: 'Ortodonti',
    items: [
      { code: '07-025-001', name: 'Tek Çeneyi İlgilendiren Aparey Yapımı', price: 384500, currency: 'TRY' },
      { code: '07-069-001', name: 'Ağız İçi Koruyucu Aparey', price: 1100000, currency: 'TRY' },
      { code: '07-999-998', name: 'Sabit Tedavi', price: 10000000, currency: 'TRY' },
    ],
  },
  {
    category: 'Konservatif Diş Tedavisi',
    items: [
      { code: '08-018-001', name: 'Diş Ağartma (Devital Tek Diş)', price: 400000, currency: 'TRY' },
      { code: '08-019-001', name: 'Diş Ağartma (Tek Çene)', price: 600000, currency: 'TRY' },
      { code: '08-021-001', name: 'Kanal İçi Hazır Post Uygulaması', price: 150000, currency: 'TRY' },
      { code: '08-022-001', name: 'Kanal İçi Fiber Post Uygulaması', price: 200000, currency: 'TRY' },
      { code: '08-999-995', name: 'Estetik Dolgu', price: 350000, currency: 'TRY' },
      { code: '08-999-996', name: 'Laminate Veneer (Kompozit)', price: 500000, currency: 'TRY' },
      { code: '08-999-998', name: 'Dolgu', price: 250000, currency: 'TRY' },
    ],
  },
]

export async function importTufanbeyli(_prev: R, formData: FormData): Promise<R> {
  void _prev
  void formData
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { data: existing } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Tufanbeyli')
    .maybeSingle()
  if (existing) return { error: 'Tufanbeyli tarifesi zaten mevcut.' }

  const { data: profile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: 'Tufanbeyli', source: 'custom', last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (profileErr || !profile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const rows = TUFANBEYLI_DATA.flatMap(({ category, items }) =>
    items.map(({ code, name, price, currency }) => ({
      clinic_id: clinicId,
      profile_id: profile.id,
      category,
      treatment_name: name,
      treatment_code: code,
      price,
      currency,
      is_active: true,
    }))
  )

  const { error } = await supabase.from('tariffs').insert(rows)
  if (error) {
    await supabase.from('tariff_profiles').delete().eq('id', profile.id)
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Profil Yönetimi ----

export async function copyTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const sourceId = Number(formData.get('source_id'))
  const newName = (formData.get('new_name') as string)?.trim()
  if (!sourceId || !newName) return { error: 'Kaynak profil ve yeni ad gerekli' }

  const { data: newProfile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: newName, source: 'custom' })
    .select('id')
    .single()
  if (profileErr || !newProfile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const { data: items } = await supabase
    .from('tariffs')
    .select('category, treatment_name, treatment_code, price, currency, is_active')
    .eq('profile_id', sourceId)
    .eq('clinic_id', clinicId)
  if (items?.length) {
    const rows = items.map((t) => ({
      clinic_id: clinicId,
      profile_id: newProfile.id,
      category: t.category,
      treatment_name: t.treatment_name,
      treatment_code: t.treatment_code,
      price: t.price,
      currency: t.currency,
      is_active: t.is_active,
    }))
    const { error } = await supabase.from('tariffs').insert(rows)
    if (error) {
      await supabase.from('tariff_profiles').delete().eq('id', newProfile.id).eq('clinic_id', clinicId)
      return { error: error.message }
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function deleteTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  const { error } = await supabase
    .from('tariff_profiles')
    .delete()
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function renameTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  const name = (formData.get('name') as string)?.trim()
  if (!profileId || !name) return { error: 'Profil ID ve ad gerekli' }

  const { error } = await supabase
    .from('tariff_profiles')
    .update({ name })
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function setDefaultProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  const { data: profile, error: profileError } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (profileError) return { error: profileError.message }
  if (!profile) return { error: 'Tarife profili bulunamadı' }

  const { error: clearError } = await supabase
    .from('tariff_profiles')
    .update({ is_default: false })
    .eq('clinic_id', clinicId)
  if (clearError) return { error: clearError.message }
  const { error } = await supabase
    .from('tariff_profiles')
    .update({ is_default: true })
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Tarife Kalemi İşlemleri ----

export async function toggleTariffItemActive(itemId: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { data: current } = await supabase
    .from('tariffs')
    .select('is_active')
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
    .single()
  if (!current) return { error: 'Kalem bulunamadı' }

  const { error } = await supabase
    .from('tariffs')
    .update({ is_active: !current.is_active })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateTariffItemPrice(itemId: number, priceKurus: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: 'Geçersiz tarife kalemi' }
  if (!Number.isFinite(priceKurus) || priceKurus < 0) return { error: 'Geçerli bir fiyat girin' }

  const { error } = await supabase
    .from('tariffs')
    .update({ price: priceKurus })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function bulkUpdateTariffPrices(input: {
  profileId: number
  tariffIds: number[]
  category: string | null
  branchId: number | null
  percent: number
  rounding: number
  roundDirection: 'nearest' | 'up' | 'down'
  vatMode: 'preserve' | 'included' | 'excluded'
  effectiveDate: string
  description: string
}): Promise<R & { count?: number }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!Number.isInteger(input.profileId) || input.profileId <= 0) return { error: 'Geçersiz tarife profili' }
  if (!Number.isFinite(input.percent) || input.percent === 0 || Math.abs(input.percent) > 1000) return { error: 'Geçerli bir değişim oranı girin' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) return { error: 'Geçerli bir tarih seçin' }

  const { data, error } = await ctx.supabase.rpc('bulk_update_tariff_prices', {
    p_profile_id: input.profileId,
    p_tariff_ids: input.tariffIds,
    p_category: input.category,
    p_branch_id: input.branchId,
    p_percent: input.percent,
    p_rounding: input.rounding,
    p_round_direction: input.roundDirection,
    p_vat_mode: input.vatMode,
    p_effective_date: input.effectiveDate,
    p_description: input.description.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true, count: Number(data ?? 0) }
}

export async function updateTariffItemDuration(itemId: number, minutes: number | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: 'Geçersiz tarife kalemi' }
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 5 || minutes > 24 * 60)) {
    return { error: 'Süre 5 dakika ile 24 saat arasında olmalıdır' }
  }

  const { error } = await supabase
    .from('tariffs')
    .update({ duration_minutes: minutes })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) {
    if (error.message.includes('duration_minutes') || error.code === '42703') {
      return { error: 'DB migration gerekli: supabase/migrations/20260623_duration_logo.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateTariffItemColor(itemId: number, color: string | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const normalized = color?.trim() || null
  if (normalized && !/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return { error: 'Renk kodu #RRGGBB formatında olmalı' }
  }

  const { error } = await supabase
    .from('tariffs')
    .update({ color: normalized })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) {
    if (error.message.includes('color') || error.code === '42703') {
      return { error: 'DB migration gerekli: supabase/migrations/20260625_tariff_colors.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }
  revalidatePath('/settings')
  revalidatePath('/appointments')
  return { success: true }
}

export async function addTariffItemToProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  const treatment_name = (formData.get('treatment_name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const treatment_code = (formData.get('treatment_code') as string)?.trim() || null
  const currency = (formData.get('currency') as string) || 'TRY'
  const color = (formData.get('color') as string)?.trim() || null
  const visual_schema = (formData.get('visual_schema') as string)?.trim() || null
  const application_region = (formData.get('application_region') as string)?.trim() || null
  const vat_rate = Math.max(0, Math.min(100, Number(formData.get('vat_rate') ?? 0)))
  const vat_included = formData.get('vat_included') !== 'false'
  const branchIdRaw = Number(formData.get('branch_id'))
  const branch_id = Number.isInteger(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null
  const priceStr = (formData.get('price') as string)?.replace(',', '.').replace(/[^0-9.]/g, '')
  const price = Math.round(parseFloat(priceStr || '0') * 100)

  if (!profileId || !treatment_name || !category) return { error: 'Profil, işlem adı ve kategori zorunludur' }

  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return { error: 'Renk kodu #RRGGBB formatında olmalı' }

  const { data: tariffProfile } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .single()
  if (!tariffProfile) return { error: 'Profil bulunamadı' }

  const { error } = await supabase.from('tariffs').insert({
    clinic_id: clinicId,
    profile_id: profileId,
    treatment_name,
    category,
    treatment_code,
    price,
    currency,
    color,
    visual_schema,
    application_region,
    vat_rate,
    vat_included,
    branch_id,
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}
