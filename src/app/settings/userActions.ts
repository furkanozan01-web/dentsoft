'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCtx, requireAdmin, type R } from './actionsShared'

// ---- Kullanıcı (allowlist) ----
const VALID_ROLES = ['bashekim', 'responsible_manager', 'hekim', 'asistan']

export async function syncDoctorsToUsers(): Promise<R & { synced?: number }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const admin = createAdminClient()
  const { data: doctors, error: doctorError } = await ctx.supabase.from('doctors').select('id, name, email, branch_id, status').eq('clinic_id', ctx.clinicId)
  if (doctorError) return { error: doctorError.message }
  const { data: existingInvites, error: inviteReadError } = await admin.from('admin_email_allowlist').select('email, role, access_level').eq('clinic_id', ctx.clinicId)
  if (inviteReadError) return { error: inviteReadError.message }
  const inviteMap = new Map((existingInvites ?? []).map((invite) => [invite.email.toLowerCase(), invite]))
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authByEmail = new Map((authData?.users ?? []).filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user]))
  let synced = 0

  for (const doctor of doctors ?? []) {
    const email = doctor.email?.trim().toLowerCase()
    if (!email) continue
    const existingInvite = inviteMap.get(email)
    const preservedRole = existingInvite?.role === 'bashekim' || existingInvite?.role === 'responsible_manager' ? existingInvite.role : 'hekim'
    const { error: inviteError } = await admin.from('admin_email_allowlist').upsert({
      email,
      clinic_id: ctx.clinicId,
      role: preservedRole,
      full_name: doctor.name,
      doctor_id: doctor.id,
      branch_id: doctor.branch_id,
      access_level: existingInvite?.access_level === 'all' ? 'all' : 'branch',
      is_active: doctor.status === 'active',
    }, { onConflict: 'email' })
    if (inviteError) return { error: inviteError.message }

    const authUser = authByEmail.get(email)
    if (authUser) {
      const { data: currentProfile } = await admin.from('profiles').select('role, access_level').eq('id', authUser.id).maybeSingle()
      const profileRole = currentProfile?.role === 'bashekim' || currentProfile?.role === 'responsible_manager' ? currentProfile.role : 'hekim'
      const { error: profileError } = await admin.from('profiles').update({
        clinic_id: ctx.clinicId,
        role: profileRole,
        doctor_id: doctor.id,
        branch_id: doctor.branch_id,
        active_branch_id: doctor.branch_id,
        access_level: currentProfile?.access_level === 'all' ? 'all' : 'branch',
        updated_at: new Date().toISOString(),
      }).eq('id', authUser.id)
      if (profileError) return { error: profileError.message }
    }
    synced += 1
  }
  revalidatePath('/settings')
  return { success: true, synced }
}

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
