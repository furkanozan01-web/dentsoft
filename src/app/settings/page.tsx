import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '../Sidebar'
import SettingsClient from './SettingsClient'
import type { Branch, ClinicSettings, Doctor, Profile, Tariff, TariffProfile } from './SettingsClient'
import type { RolePermissionRow } from './actions'
import { getPermissions, canSeeAyarlarNav, canSeeAllHakedis } from '@/lib/permissions'
import type { AppointmentType, TariffPriceHistory } from './types'
import { tryDecrypt } from '@/lib/crypto'

export const metadata = { title: 'Ayarlar — DentSoft' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, clinic_id, doctor_id, active_branch_id')
    .eq('id', user.id)
    .single()

  if (!profile?.clinic_id) redirect('/login')
  const clinicId = profile.clinic_id

  const [
    { data: clinic },
    { data: doctors },
    { data: profiles },
    { data: tariffs },
    { data: tariffProfiles },
    { data: branches },
    { data: tariffHistory },
    { data: appointmentTypes },
    { data: rolePermissions },
  ] = await Promise.all([
    supabase
      .from('clinic_settings')
      .select('id, clinic_name, address, phone, email, tax_no, tax_office, default_duration, work_start, work_end, online_booking, require_approval, vat_rate, logo_url, invoice_institution, authorized_person, unit_count, bank_fee_bps, default_currency, is_active, night_shift_active, night_shift_start, night_shift_end, night_shift_days, night_shift_doctor_ids, night_shift_branch_id, night_shift_interval, night_shift_note')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('doctors')
      .select(
        'id, name, specialty, phone, email, color, status, diploma_no, tc_enc, diploma_date, birth_date, payment_model, monthly_salary, commission_rate_bps, guarantee_amount, bonus_amount, per_transaction_amount, salary_day, payment_account, work_hours_json, is_mesul_mudur, branch_id, title, guarantee_active, guarantee_period, guarantee_method, guarantee_note, share_active, share_rate_bps, share_start_date, share_end_date, share_branch_id, share_period, share_note, profit_distribution_type'
      )
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at, doctor_id, branch_id, active_branch_id, access_level')
      .eq('clinic_id', clinicId)
      .order('created_at'),
    supabase
      .from('tariffs')
      .select('id, treatment_name, category, price, profile_id, is_active, currency, treatment_code, duration_minutes, color, visual_schema, application_region, vat_rate, vat_included, branch_id, price_updated_at')
      .eq('clinic_id', clinicId)
      .order('category')
      .order('treatment_name'),
    supabase
      .from('tariff_profiles')
      .select('id, name, source, tdb_year, is_default, last_synced_at, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at'),
    supabase
      .from('branches')
      .select('id, name, code, phone, email, address, authorized_person, unit_count, work_start, work_end, bank_accounts, cash_accounts, is_active, is_default')
      .eq('clinic_id', clinicId)
      .order('is_default', { ascending: false })
      .order('name'),
    supabase
      .from('tariff_price_history')
      .select('id, tariff_id, old_price, new_price, change_rate, effective_date, description, changed_at, changed_by')
      .order('changed_at', { ascending: false })
      .limit(1000),
    supabase
      .from('appointment_types')
      .select('id, name, default_duration, color, description, is_active, is_system, branch_id, doctor_ids')
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('role_permissions')
      .select('role_name, resource, can_view, can_create, can_update, can_delete')
      .eq('clinic_id', clinicId),
  ])

  // Auth bilgileri (email, son giriş, ban durumu) — service role ile.
  // auth.users PostgREST'e açık olmadığından admin API kullanılır.
  const authMap = new Map<string, { email: string | null; lastLogin: string | null; active: boolean }>()
  const pendingProfiles: Profile[] = []
  if (profile.role === 'bashekim') try {
    const admin = createAdminClient()
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of authData?.users ?? []) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until ?? null
      const active = !bannedUntil || new Date(bannedUntil) <= new Date()
      authMap.set(u.id, {
        email: u.email ?? null,
        lastLogin: u.last_sign_in_at ?? null,
        active,
      })
    }
    const knownEmails = new Set([...authMap.values()].map((item) => item.email?.toLowerCase()).filter(Boolean))
    const { data: allowlist } = await admin.from('admin_email_allowlist')
      .select('email, full_name, role, doctor_id, branch_id, access_level, is_active, created_at')
      .eq('clinic_id', clinicId)
    for (const invite of allowlist ?? []) {
      if (knownEmails.has(invite.email.toLowerCase())) continue
      pendingProfiles.push({
        id: `pending:${invite.email}`,
        full_name: invite.full_name,
        role: invite.role,
        created_at: invite.created_at,
        doctor_id: invite.doctor_id,
        email: invite.email,
        last_login: null,
        is_active: invite.is_active,
        branch_id: invite.branch_id,
        active_branch_id: invite.branch_id,
        access_level: invite.access_level,
        is_pending: true,
      })
    }
  } catch {
    // Admin API erişilemezse temel profil verisiyle devam et
  }

  const enrichedProfiles: Profile[] = (profiles ?? []).map((p) => {
    const a = authMap.get(p.id)
    return {
      ...p,
      email: a?.email ?? null,
      last_login: a?.lastLogin ?? null,
      is_active: a?.active ?? true,
    } as Profile
  }).concat(pendingProfiles)
  const doctorViews = (doctors ?? []).map(({ tc_enc, ...doctor }) => ({
    ...doctor,
    tc_identity_no: tc_enc ? tryDecrypt(tc_enc) : null,
  }))
  const currentDoctor = doctorViews.find((doctor) => doctor.id === profile.doctor_id)
  const canSeeAllCompensation = profile.role === 'bashekim' || currentDoctor?.is_mesul_mudur === true || (await canSeeAllHakedis())
  const safeDoctors = canSeeAllCompensation ? doctorViews : doctorViews.map((doctor) =>
    doctor.id === profile.doctor_id ? doctor : ({
      ...doctor,
      payment_model: null,
      monthly_salary: null,
      commission_rate_bps: null,
      guarantee_amount: null,
      bonus_amount: null,
      per_transaction_amount: null,
      salary_day: null,
      payment_account: null,
      tc_identity_no: null,
      guarantee_active: false,
      guarantee_note: null,
      share_active: false,
      share_rate_bps: 0,
      share_start_date: null,
      share_end_date: null,
      share_branch_id: null,
      share_note: null,
    })
  )

  const [{ canView: canSeeFinans }, canSeeAyarlar] = await Promise.all([
    getPermissions('finans_bilgi'),
    canSeeAyarlarNav(),
  ])

  return (
    <div className="flex min-h-screen bg-[#F0F4F9]">
      <Sidebar fullName={profile.full_name ?? ''} role={profile.role ?? ''} canSeeFinans={canSeeFinans} canSeeAyarlar={canSeeAyarlar} />
      <main className="flex-1 overflow-y-auto">
        <SettingsClient
          clinic={(clinic ?? {}) as ClinicSettings}
          doctors={safeDoctors as Doctor[]}
          profiles={enrichedProfiles}
          branches={(branches ?? []) as Branch[]}
          tariffs={(tariffs ?? []) as Tariff[]}
          tariffProfiles={(tariffProfiles ?? []) as TariffProfile[]}
          tariffHistory={(tariffHistory ?? []).map((row) => ({ ...row, changed_by_name: enrichedProfiles.find((item) => item.id === row.changed_by)?.full_name ?? null })) as TariffPriceHistory[]}
          appointmentTypes={(appointmentTypes ?? []) as AppointmentType[]}
          isAdmin={profile.role === 'bashekim'}
          currentUserId={user.id}
          activeBranchId={profile.active_branch_id ?? null}
          rolePermissions={(rolePermissions ?? []) as RolePermissionRow[]}
        />
      </main>
    </div>
  )
}
