import { createClient } from '@/lib/supabase/server'

export type CreatedPatient = {
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

export type ActionResult = { error?: string; success?: boolean; patient?: CreatedPatient } | null

export type InvoiceSendResult = { error?: string; success?: boolean; invoiceNo?: string; institution?: string }

export async function nextPrefixedNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'patients' | 'transactions',
  clinicId: number,
  column: 'protocol_no' | 'invoice_no',
  prefix: 'P' | 'F'
): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select(column)
    .eq('clinic_id', clinicId)
    .like(column, `${prefix}%`)

  const max = (data ?? []).reduce((current, row) => {
    const raw = String((row as Record<string, unknown>)[column] ?? '')
    const n = Number(raw.replace(new RegExp(`^${prefix}`, 'i'), ''))
    return Number.isFinite(n) ? Math.max(current, n) : current
  }, 0)

  return `${prefix}${String(max + 1).padStart(5, '0')}`
}

export async function nextProtocolNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number
): Promise<string> {
  return nextPrefixedNo(supabase, 'patients', clinicId, 'protocol_no', 'P')
}

export async function nextInvoiceNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number
): Promise<string> {
  return nextPrefixedNo(supabase, 'transactions', clinicId, 'invoice_no', 'F')
}

export async function getCtx() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .single()
    const clinicId = profile?.clinic_id
    if (!clinicId) return null
    return { supabase, clinicId }
  } catch {
    return null
  }
}

export async function validatePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number
): Promise<string | null> {
  if (!Number.isInteger(patientId) || patientId <= 0) return 'Geçerli bir hasta seçin'
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) return error.message
  return data ? null : 'Hasta bu klinikte bulunamadı'
}

export async function validateDoctor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  doctorId: number | null
): Promise<string | null> {
  if (doctorId === null) return null
  if (!Number.isInteger(doctorId) || doctorId <= 0) return 'Geçerli bir hekim seçin'
  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) return error.message
  return data ? null : 'Hekim bu klinikte bulunamadı'
}

// --- Taksit / ödeme planı ---

// Hastanın kalan bakiyesini sunucuda hesaplar (tedavi toplamı − ödenen).
export async function calcBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number
): Promise<{ balance?: number; error?: string }> {
  const [{ data: tr, error: treatmentError }, { data: tx, error: transactionError }] = await Promise.all([
    supabase.from('treatments').select('fee, status').eq('clinic_id', clinicId).eq('patient_id', patientId),
    supabase.from('transactions').select('amount, type').eq('clinic_id', clinicId).eq('patient_id', patientId),
  ])
  if (treatmentError) return { error: treatmentError.message }
  if (transactionError) return { error: transactionError.message }
  const owed = (tr ?? [])
    .filter((t) => t.status !== 'cancelled')
    .reduce((s, t) => s + (t.fee ?? 0), 0)
  const paid = (tx ?? [])
    .filter((t) => t.type === 'payment')
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  return { balance: owed - paid }
}
