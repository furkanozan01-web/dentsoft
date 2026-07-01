// Ayarlar server action'ları arasında paylaşılan yardımcılar.
// NOT: Bu dosyada 'use server' YOK — Next.js'in "use server dosyasından
// sadece async fonksiyon export edilebilir" kısıtlaması sadece kendi
// 'use server' işaretli dosyalarına uygulanır. getCtx/requireAdmin senkron
// yardımcı fonksiyonlar oldukları için ayrı, işaretsiz bir dosyada yaşar.

import { createClient } from '@/lib/supabase/server'

export type R = { error?: string; success?: boolean } | null

export async function getCtx() {
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

export function requireAdmin(ctx: Awaited<ReturnType<typeof getCtx>>): R {
  return ctx && ctx.role === 'bashekim'
    ? null
    : { error: 'Bu işlem için yönetici yetkisi gerekir' }
}
