// Ayarlar server action'ları arasında paylaşılan yardımcılar.
// NOT: Bu dosyada 'use server' YOK — Next.js'in "use server dosyasından
// sadece async fonksiyon export edilebilir" kısıtlaması sadece kendi
// 'use server' işaretli dosyalarına uygulanır. getCtx/requireAdmin senkron
// yardımcı fonksiyonlar oldukları için ayrı, işaretsiz bir dosyada yaşar.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type R = { error?: string; success?: boolean } | null

export async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, role, branch_id, access_level')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) return null
  return {
    supabase,
    clinicId: profile.clinic_id,
    role: profile.role,
    userId: user.id,
    branchId: (profile.branch_id ?? null) as number | null,
    accessLevel: (profile.access_level ?? 'branch') as string,
  }
}

export function requireAdmin(ctx: Awaited<ReturnType<typeof getCtx>>): R {
  return ctx && ctx.role === 'bashekim'
    ? null
    : { error: 'Bu işlem için yönetici yetkisi gerekir' }
}

/** Mesul müdürün ekleyebileceği/yönetebileceği roller */
export const MANAGER_ASSIGNABLE_ROLES = ['hekim', 'asistan']

/** Başhekim ve mesul müdür kullanıcı adı/şifre belirleyebilir */
export function requireUserManager(ctx: Awaited<ReturnType<typeof getCtx>>): R {
  return ctx && (ctx.role === 'bashekim' || ctx.role === 'responsible_manager')
    ? null
    : { error: 'Bu işlem için yönetici veya mesul müdür yetkisi gerekir' }
}

/**
 * Hedef kullanıcıyı bu kişi yönetebilir mi?
 * - Başhekim: kendi kliniğindeki herkesi (kendi şifresi hariç değişiklikler ayrı kontrol edilir)
 * - Mesul müdür: yalnızca kendi şubesindeki (yetki seviyesi "tüm şubeler" ise kliniğindeki) hekim ve asistanları
 */
export async function requireCanManageUser(
  ctx: Awaited<ReturnType<typeof getCtx>>,
  targetUserId: string
): Promise<R> {
  const roleErr = requireUserManager(ctx)
  if (roleErr || !ctx) return roleErr
  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, branch_id')
    .eq('id', targetUserId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!target) return { error: 'Kullanıcı bu klinikte bulunamadı' }
  if (ctx.role === 'bashekim') return null
  if (!MANAGER_ASSIGNABLE_ROLES.includes(target.role)) {
    return { error: 'Mesul müdür yalnızca hekim ve asistan hesaplarını yönetebilir' }
  }
  if (ctx.accessLevel !== 'all' && target.branch_id !== ctx.branchId) {
    return { error: 'Yalnızca kendi şubenizdeki kullanıcıları yönetebilirsiniz' }
  }
  return null
}
