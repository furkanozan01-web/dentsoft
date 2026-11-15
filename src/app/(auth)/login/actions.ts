'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export type LoginState = { error: string } | null

const GENERIC_ERROR = 'E-posta, kullanıcı adı veya şifre hatalı'

/**
 * Giriş: klinik sahibinin e-postası firmayı belirler; kullanıcı adı o firmadaki kişiyi seçer.
 * Aynı e-posta altında doktor/asistan gibi farklı kullanıcılar farklı kullanıcı adıyla girer.
 * Hatalı her durumda aynı mesaj döner (hangi alanın yanlış olduğu sızdırılmaz).
 */
export async function credentialsLogin(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !username || !password) {
    return { error: 'E-posta, kullanıcı adı ve şifre gerekli' }
  }

  const admin = createAdminClient()
  const { data: clinic } = await admin
    .from('clinic_settings')
    .select('id')
    .eq('owner_email', email)
    .maybeSingle()
  if (!clinic) return { error: GENERIC_ERROR }

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('clinic_id', clinic.id)
    .eq('username', username)
    .maybeSingle()
  if (!profile) return { error: GENERIC_ERROR }

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const authEmail = authUser.user?.email
  if (!authEmail) return { error: GENERIC_ERROR }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
  if (error) return { error: GENERIC_ERROR }

  redirect('/')
}
