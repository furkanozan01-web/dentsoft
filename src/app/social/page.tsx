import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import { createClient } from '@/lib/supabase/server'
import SocialMediaClient from '@/features/social-media/components/SocialMediaClient'
import { loadSocialPageData } from '@/features/social-media/queries/load-social-page'
import { getPermissions, canSeeAyarlarNav } from '@/lib/permissions'

export const metadata = { title: 'Sosyal Medya - DentSoft' }

export default async function SocialPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, clinic_id')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) redirect('/login')
  // Sidebar izinleri ana sorgularla paralel başlar
  const navPermsPromise = Promise.all([getPermissions('finans_bilgi'), canSeeAyarlarNav()])

  const data = await loadSocialPageData(supabase, Number(profile.clinic_id))
  const [{ canView: canSeeFinans }, canSeeAyarlar] = await navPermsPromise

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile.full_name ?? ''} role={profile.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <SocialMediaClient {...data} />
      </main>
    </div>
  )
}
