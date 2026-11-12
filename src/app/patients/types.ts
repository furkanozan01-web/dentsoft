export interface Patient {
  id: number
  name: string
  surname: string
  gender: string | null
  birth_date: string | null
  phone1: string | null
  phone2: string | null
  email: string | null
  address: string | null
  status: string
  untrusted: boolean | null
  reg_date: string | null
  protocol_no: string | null
  created_at: string
}

export interface Transaction {
  id: number
  transaction_date: string
  amount: number
  method: string | null
  type: string
  description: string | null
  invoice_no: string | null
  invoice_sent_at: string | null
  invoice_institution: string | null
  invoice_line_description: string | null
  invoice_amount: number | null
  invoice_vat_rate: number | null
  original_currency: string | null
  original_amount: number | null
  exchange_rate: number | null
  partner_id: number | null
  partner_name: string | null
}

export interface BusinessPartner {
  id: number
  name: string
  partner_type: string
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Treatment {
  id: number
  treatment_date: string | null
  treatment_name: string
  fee: number
  original_fee: number | null
  is_closed: boolean
  status: string
  tooth: number | null
  doctor: { name: string } | null
  tariff: { visual_schema: string | null } | null
}

export interface Installment {
  id: number
  due_date: string
  amount: number
  paid: boolean
  group_id: number | null
}

export interface PatientReminder {
  id: number
  reminder_date: string
  note: string | null
  is_done: boolean
  created_at: string
}

export interface Prescription {
  id: number
  content: string
  created_at: string
  doctor: { name: string } | null
}

export interface ClinicalNote {
  id: number
  content: string
  created_at: string
  is_important: boolean
  important_dismissed: boolean
}

export interface PatientImage {
  id: number
  storage_path: string
  file_name: string
  created_at: string
}

export interface DoctorOption {
  id: number
  name: string
  color: string | null
}

export interface TariffOption {
  id: number
  treatment_name: string
  category: string | null
  price: number
  profile_id: number | null
  is_active: boolean | null
  visual_schema: string | null
}

export interface TariffProfile {
  id: number
  name: string
  is_default: boolean | null
}

export interface ClinicInfo {
  clinic_name: string
  address: string | null
  phone: string | null
  email: string | null
  tax_no: string | null
  tax_office: string | null
  vat_rate: number | null
  logo_url: string | null
  invoice_institution: string | null
}

export interface DrugEntry {
  name: string
  ingredient: string
  category: string
  usage: string
  template: string
}

export interface FollowupStep {
  id: number
  followup_id: number
  title: string
  scheduled_date: string | null
  completed_at: string | null
  notes: string | null
  step_order: number
  created_at: string
}

export interface Followup {
  id: number
  patient_id: number
  title: string
  start_date: string
  notes: string | null
  status: string
  created_at: string
  steps: FollowupStep[]
}

export type TabId =
  | 'liste'
  | 'hasta-karti'
  | 'oral'
  | 'takip'
  | 'not-goruntu'
  | 'hesap'
  | 'evrak'
  | 'fatura'
  | 'recete'

export type ActionResult = { error?: string; success?: boolean; patient?: Patient } | null

export interface TreatmentPlanItem {
  id: number
  plan_id: number
  tooth_no: number | null
  treatment_name: string
  tariff_item_id: number | null
  fee: number
  discount_rate: number
  order_index: number
  notes: string | null
  copied_from_id: number | null
  created_at: string
}

export interface TreatmentPlan {
  id: number
  clinic_id: number
  patient_id: number
  plan_type: 'diyagnoz' | 'planlama' | 'faz'
  plan_number: number
  status: string
  notes: string | null
  created_at: string
  items: TreatmentPlanItem[]
}
