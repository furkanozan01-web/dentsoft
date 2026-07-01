'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type LoginState = { error: string } | null

export async function staffLogin(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = (formData.get('username') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Kullanıcı adı ve şifre gerekli' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    // Personel hesapları @dentsoft.local formatında saklanır
    email: `${username}@dentsoft.local`,
    password,
  })

  if (error) {
    return { error: 'Kullanıcı adı veya şifre hatalı' }
  }

  redirect('/')
}
