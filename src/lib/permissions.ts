import 'server-only'

import { createClient } from '@/lib/supabase/server'

// DB'deki profiles.role/role_permissions.role_name değerleriyle birebir aynı.
// 'responsible_manager' = Mesul Müdür (UI etiketi farklı, DB değeri değişmedi).
export type UserRole = 'bashekim' | 'responsible_manager' | 'hekim' | 'asistan'

export interface Permissions {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

interface PermissionFields {
  can_view: boolean | null
  can_create: boolean | null
  can_update: boolean | null
  can_delete: boolean | null
}

const NO_ACCESS: Permissions = { canView: false, canCreate: false, canUpdate: false, canDelete: false }

const AYARLAR_RESOURCES = [
  'ayarlar_klinik',
  'ayarlar_hekim',
  'ayarlar_kullanici',
  'ayarlar_tarife',
  'ayarlar_randevu',
]

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id || !profile.role) return null
  return { supabase, clinicId: profile.clinic_id as number, role: profile.role as UserRole, userId: user.id }
}

// Kullanıcı override (user_permissions) alanı NULL değilse rol şablonunun
// önüne geçer; NULL ise rol şablonuna düşer. Kayıt hiç yoksa NO_ACCESS.
export function mergeEffective(role: PermissionFields | null, override: PermissionFields | null): Permissions {
  if (!role && !override) return NO_ACCESS
  const pick = (field: keyof PermissionFields): boolean =>
    (override?.[field] ?? role?.[field] ?? false) === true
  return {
    canView: pick('can_view'),
    canCreate: pick('can_create'),
    canUpdate: pick('can_update'),
    canDelete: pick('can_delete'),
  }
}

export async function getUserRole(): Promise<UserRole | null> {
  const ctx = await getCtx()
  return ctx?.role ?? null
}

// Oturum sahibinin GEÇERLİ (rol şablonu + kişisel override) iznini döner.
export async function getPermissions(resource: string): Promise<Permissions> {
  const ctx = await getCtx()
  if (!ctx) return NO_ACCESS

  const [{ data: roleRow }, { data: overrideRow }] = await Promise.all([
    ctx.supabase
      .from('role_permissions')
      .select('can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId)
      .eq('role_name', ctx.role)
      .eq('resource', resource)
      .maybeSingle(),
    ctx.supabase
      .from('user_permissions')
      .select('can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId)
      .eq('user_id', ctx.userId)
      .eq('resource', resource)
      .maybeSingle(),
  ])

  return mergeEffective(roleRow ?? null, overrideRow ?? null)
}

export async function isBashekim(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'bashekim'
}

export async function isMesulMudurOrAbove(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'bashekim' || role === 'responsible_manager'
}

// Sidebar "Ayarlar" linkini göster/gizle — ayarlar_* kaynaklarından
// en az birine (rol şablonu + kişisel override sonrası) can_view=true
// varsa gösterilir.
export async function canSeeAyarlarNav(): Promise<boolean> {
  const ctx = await getCtx()
  if (!ctx) return false

  const [{ data: roleRows }, { data: overrideRows }] = await Promise.all([
    ctx.supabase
      .from('role_permissions')
      .select('resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId)
      .eq('role_name', ctx.role)
      .in('resource', AYARLAR_RESOURCES),
    ctx.supabase
      .from('user_permissions')
      .select('resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', ctx.clinicId)
      .eq('user_id', ctx.userId)
      .in('resource', AYARLAR_RESOURCES),
  ])

  const overrideByResource = new Map((overrideRows ?? []).map((r) => [r.resource, r]))
  return AYARLAR_RESOURCES.some((resource) => {
    const roleRow = (roleRows ?? []).find((r) => r.resource === resource) ?? null
    const overrideRow = overrideByResource.get(resource) ?? null
    return mergeEffective(roleRow, overrideRow).canView
  })
}

// "Hakediş — Tüm Hekimler" izni: rol şablonu + kişisel override sonrası.
// bashekim ve responsible_manager rol şablonunda true'dur; bashekim/mesul
// müdür bir hekime bu izni tekil olarak da verebilir (override).
export async function canSeeAllHakedis(): Promise<boolean> {
  const { canView } = await getPermissions('hakedis_tum')
  return canView
}
