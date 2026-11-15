import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Laboratuvar kullanıcısının bağlamı.
 * Laboratuvar rolü RLS'te "kliniksiz" olduğundan tüm veri okuma/yazma sunucuda service role ile yapılır;
 * bu yardımcı her işlemde kullanıcının gerçekten laboratuvar rolünde ve bir laboratuvar iş ortağına bağlı olduğunu doğrular
 * ve işlemleri YALNIZCA o iş ortağının kayıtlarıyla sınırlar.
 */
export type LabCtx = NonNullable<Awaited<ReturnType<typeof getLabCtx>>>

export async function getLabCtx(): Promise<
  | { status: 'anonymous' }
  | { status: 'not-lab' }
  | { status: 'invalid'; reason: string }
  | {
      status: 'ok'
      admin: ReturnType<typeof createAdminClient>
      userId: string
      userName: string
      clinicId: number
      partner: { id: number; name: string }
      branchId: number | null
    }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'anonymous' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('clinic_id, role, partner_id, full_name, username')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'laboratuvar') return { status: 'not-lab' }
  if (!profile.clinic_id || !profile.partner_id) return { status: 'invalid', reason: 'Hesabınız bir laboratuvara bağlı değil. Klinik yöneticisiyle görüşün.' }

  const { data: partner } = await admin
    .from('business_partners')
    .select('id, name, branch_id, is_active')
    .eq('id', profile.partner_id)
    .eq('clinic_id', profile.clinic_id)
    .eq('partner_type', 'laboratuvar')
    .maybeSingle()
  if (!partner || !partner.is_active) return { status: 'invalid', reason: 'Laboratuvar kaydınız pasif veya bulunamadı. Klinik yöneticisiyle görüşün.' }

  // Kayıtlar bir şubeye bağlı olmalı (RLS şube kısıtı): laboratuvarın şubesi, yoksa kliniğin varsayılan şubesi
  let branchId: number | null = partner.branch_id ?? null
  if (!branchId) {
    const { data: def } = await admin.from('branches').select('id').eq('clinic_id', profile.clinic_id).eq('is_default', true).maybeSingle()
    branchId = def?.id ?? null
  }

  return {
    status: 'ok',
    admin,
    userId: user.id,
    userName: profile.full_name || profile.username || 'Laboratuvar',
    clinicId: profile.clinic_id,
    partner: { id: partner.id, name: partner.name },
    branchId,
  }
}
