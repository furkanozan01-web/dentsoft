import type { TariffProfile } from './actions'

export interface ClinicSettings {
  id: number
  clinic_name: string
  address: string | null
  phone: string | null
  email: string | null
  tax_no: string | null
  tax_office: string | null
  default_duration: number | null
  work_start: string | null
  work_end: string | null
  online_booking: boolean | null
  require_approval: boolean | null
  vat_rate: number | null
  logo_url: string | null
  invoice_institution: string | null
  authorized_person: string | null
  unit_count: number
  bank_fee_bps: number
  default_currency: string
  is_active: boolean
  night_shift_active: boolean
  night_shift_start: string
  night_shift_end: string
  night_shift_days: number[]
  night_shift_doctor_ids: number[]
  night_shift_branch_id: number | null
  night_shift_interval: number
  night_shift_note: string | null
}

export interface AppointmentType {
  id: number
  name: string
  default_duration: number
  color: string
  description: string | null
  is_active: boolean
  is_system: boolean
  branch_id: number | null
  doctor_ids: number[]
}

export interface Branch {
  id: number
  name: string
  code: string
  phone: string | null
  email: string | null
  address: string | null
  authorized_person: string | null
  unit_count: number
  work_start: string
  work_end: string
  bank_accounts: string | null
  cash_accounts: string | null
  is_active: boolean
  is_default: boolean
}

export type DayHours = { start: string; end: string; clinic: string; off: boolean }

export interface DoctorShare {
  id: number
  doctor_id: number
  branch_id: number
  rate_bps: number
  start_date: string | null
  end_date: string | null
  period: string
  profit_distribution_type: string
  note: string | null
  is_active: boolean
}

export interface Doctor {
  id: number
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  color: string | null
  status: string
  diploma_no: string | null
  tc_identity_no: string | null
  diploma_date: string | null
  birth_date: string | null
  payment_model: string | null
  monthly_salary: number | null
  commission_rate_bps: number | null
  guarantee_amount: number | null
  bonus_amount: number | null
  per_transaction_amount: number | null
  salary_day: number | null
  payment_account: string | null
  work_hours_json: Record<string, DayHours> | null
  is_mesul_mudur: boolean
  branch_id: number | null
  title: string
  guarantee_active: boolean
  guarantee_period: string
  guarantee_method: string
  guarantee_note: string | null
  doctor_shares: DoctorShare[]
}

export interface Profile {
  id: string
  full_name: string | null
  role: string
  created_at: string
  doctor_id: number | null
  email: string | null
  last_login: string | null
  is_active: boolean
  branch_id: number | null
  active_branch_id: number | null
  access_level: string
  is_pending?: boolean
}

export interface Tariff {
  id: number
  treatment_name: string
  category: string | null
  price: number
  profile_id: number | null
  is_active: boolean
  currency: string
  treatment_code: string | null
  duration_minutes: number | null
  color: string | null
  visual_schema: string | null
  application_region: string | null
  vat_rate: number
  vat_included: boolean
  branch_id: number | null
  price_updated_at: string
}

export interface TariffPriceHistory {
  id: number
  tariff_id: number
  old_price: number
  new_price: number
  change_rate: number
  effective_date: string
  description: string | null
  changed_at: string
  changed_by: string | null
  changed_by_name: string | null
}

export type SettingsTab = 'klinik' | 'dis-hekimi' | 'kullanici' | 'tarife' | 'randevu'
export type R = { error?: string; success?: boolean } | null
export type { TariffProfile }
