import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import AppointmentsClient from './AppointmentsClient'
import type { AppointmentTypeOption, ApptDoctor, ApptPatient, ApptTariff, NightShiftConfig } from './AppointmentsClient'
import { getPermissions, canSeeAyarlarNav } from '@/lib/permissions'

export const metadata = { title: 'Randevular — DentSoft' }

export default async function AppointmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, clinic_id, branch_id, active_branch_id')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) redirect('/login')
  const clinicId = profile.clinic_id

  const [{ data: doctors }, { data: patients }, { data: clinic }, { data: tariffs }, { data: appointmentTypes }] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, name, color')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('patients')
      .select('id, name, surname, phone1')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('clinic_settings')
      .select('clinic_name, work_start, work_end, default_duration, night_shift_active, night_shift_start, night_shift_end, night_shift_days, night_shift_doctor_ids, night_shift_branch_id, night_shift_interval, night_shift_note')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('tariffs')
      .select('id, treatment_name, category, price, duration_minutes, color')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('category')
      .order('treatment_name'),
    supabase.from('appointment_types').select('id, name, default_duration, color, description, branch_id, doctor_ids').eq('clinic_id', clinicId).eq('is_active', true).order('name'),
  ])
  const [{ canView: canSeeFinans }, canSeeAyarlar] = await Promise.all([
    getPermissions('finans_bilgi'),
    canSeeAyarlarNav(),
  ])

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile.full_name ?? ''} role={profile.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />
      <main className="flex-1 overflow-y-auto">
        <AppointmentsClient
          doctors={(doctors ?? []) as ApptDoctor[]}
          patients={(patients ?? []) as ApptPatient[]}
          tariffs={(tariffs ?? []) as ApptTariff[]}
          branchName={clinic?.clinic_name ?? 'Merkez'}
          workStart={clinic?.work_start ?? '09:00'}
          workEnd={clinic?.work_end ?? '18:00'}
          defaultDuration={clinic?.default_duration ?? 30}
          appointmentTypes={(appointmentTypes ?? []) as AppointmentTypeOption[]}
          nightShift={{ active: clinic?.night_shift_active ?? false, start: clinic?.night_shift_start?.slice(0,5) ?? '18:00', end: clinic?.night_shift_end?.slice(0,5) ?? '23:00', days: clinic?.night_shift_days ?? [], doctorIds: clinic?.night_shift_doctor_ids ?? [], branchId: clinic?.night_shift_branch_id ?? null, interval: clinic?.night_shift_interval ?? 30, note: clinic?.night_shift_note ?? null, currentBranchId: profile.active_branch_id ?? profile.branch_id ?? null } as NightShiftConfig}
          canOverrideNight={profile.role === 'bashekim'}
        />
      </main>
    </div>
  )
}
