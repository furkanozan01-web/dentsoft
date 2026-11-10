import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import { createClient } from '@/lib/supabase/server'
import ResearchClient from '@/features/research/components/ResearchClient'
import { DEFAULT_RESEARCH_FILTERS } from '@/features/research/filters/defaults'
import { searchPatients } from '@/features/research/queries/search-patients'
import type { ResearchDoctor, ResearchTag, SavedResearch } from '@/features/research/types'
import { getPermissions, canSeeAyarlarNav } from '@/lib/permissions'

export const metadata = { title: 'Araştırma - DentSoft' }

export default async function ResearchPage() {
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

  const clinicId = Number(profile.clinic_id)
  const [{ data: saved }, { data: tags }, { data: doctors }, initialResults] = await Promise.all([
    supabase
      .from('research_saved_searches')
      .select('id, name, filters, visible_columns, created_at, updated_at')
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('patient_tags')
      .select('id, name, color')
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('doctors')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    searchPatients(supabase, clinicId, DEFAULT_RESEARCH_FILTERS),
  ])
  const [{ canView: canSeeFinans }, canSeeAyarlar] = await navPermsPromise

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile.full_name ?? ''} role={profile.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <ResearchClient
          initialResults={initialResults}
          initialSaved={(saved ?? []) as SavedResearch[]}
          initialTags={(tags ?? []) as ResearchTag[]}
          doctors={(doctors ?? []) as ResearchDoctor[]}
        />
      </main>
    </div>
  )
}
