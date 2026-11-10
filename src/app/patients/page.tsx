import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import PatientsClient from './PatientsClient'
import type {
  Patient,
  DoctorOption,
  TariffOption,
  TariffProfile,
  ClinicInfo,
  PatientTreatmentSummary,
} from './PatientsClient'
import { getPermissions, canSeeAyarlarNav } from '@/lib/permissions'

export const metadata = { title: 'Hastalar — DentSoft' }

export default async function PatientsPage() {
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
  const clinicId = profile.clinic_id

  const [
    { data: patients },
    { data: doctors },
    { data: tariffs },
    { data: tariffProfiles },
    { data: clinic },
    { data: ongoingTreatments },
    { data: treatmentSummaries },
  ] = await Promise.all([
    supabase
      .from('patients')
      .select(
        'id, name, surname, gender, birth_date, phone1, phone2, email, address, status, untrusted, reg_date, protocol_no, created_at'
      )
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),
    supabase
      .from('doctors')
      .select('id, name, color')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('tariffs')
      .select('id, treatment_name, category, price, profile_id, is_active, visual_schema')
      .eq('clinic_id', clinicId)
      .order('category')
      .order('treatment_name'),
    supabase
      .from('tariff_profiles')
      .select('id, name, is_default')
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('clinic_settings')
      .select('clinic_name, address, phone, email, tax_no, tax_office, vat_rate, logo_url, invoice_institution')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .in('status', ['planned', 'in_progress'])
      .not('patient_id', 'is', null),
    supabase
      .from('treatments')
      .select('patient_id, status, treatment_name, category')
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled'),
  ])
  const [{ canView: canSeeFinans }, canSeeAyarlar] = await navPermsPromise

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar
        fullName={profile.full_name ?? ''}
        role={profile.role ?? ''}
        canSeeFinans={canSeeFinans}
        canSeeAyarlar={canSeeAyarlar}
      />
      <main className="flex-1 overflow-y-auto">
        <PatientsClient
          patients={(patients ?? []) as Patient[]}
          doctors={(doctors ?? []) as DoctorOption[]}
          tariffs={(tariffs ?? []) as TariffOption[]}
          tariffProfiles={(tariffProfiles ?? []) as TariffProfile[]}
          clinic={(clinic ?? null) as ClinicInfo | null}
          clinicId={clinicId}
          ongoingPatientIds={Array.from(new Set(((ongoingTreatments ?? []) as { patient_id: number | null }[]).map((t) => t.patient_id).filter((id): id is number => id !== null)))}
          treatmentSummaries={(treatmentSummaries ?? []) as PatientTreatmentSummary[]}
        />
      </main>
    </div>
  )
}
