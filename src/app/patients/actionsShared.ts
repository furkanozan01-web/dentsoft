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

/**
 * Fatura numarası hastanın protokol numarasını izler: P0002 numaralı hastanın faturası F0002.
 * Aynı hastaya ikinci, üçüncü fatura kesilirse F0002-2, F0002-3 olur.
 */
export async function nextInvoiceNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number
): Promise<string> {
  const { data: patient } = await supabase
    .from('patients')
    .select('protocol_no')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  const digits = String(patient?.protocol_no ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const base = `F${digits}`

  const { data: used } = await supabase
    .from('transactions')
    .select('invoice_no')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .like('invoice_no', `${base}%`)
  const count = new Set((used ?? []).map((r) => r.invoice_no as string)).size
  return count === 0 ? base : `${base}-${count + 1}`
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

/**
 * Kayıt şubesi kuralı: işlem hangi şubede yapıldıysa o şubeye yazılır. Kullanıcının aktif şubesi varsa
 * veritabanı tetikleyicisi onu kullanır. "Tüm Şubeler" görünümündeyken (aktif şube yok) tetikleyici
 * kullanıcının kendi şubesine düşerdi; bunun yerine hastanın şubesi kullanılır.
 * Dönüş değeri insert nesnesine açılır: `{ ...(await branchFallback(supabase, patientId)) }`
 */
export async function branchFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: number | null | undefined
): Promise<{ branch_id?: number }> {
  if (!patientId) return {}
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}
  const { data: profile } = await supabase.from('profiles').select('active_branch_id').eq('id', user.id).maybeSingle()
  if (profile?.active_branch_id) return {}
  const { data: patient } = await supabase.from('patients').select('branch_id').eq('id', patientId).maybeSingle()
  return patient?.branch_id ? { branch_id: patient.branch_id as number } : {}
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

/** T.C. kimlik numarası: 11 haneli rakam olması yeterlidir (resmî sağlama basamağı denetlenmez). Geçerliyse null döner. */
export function validateTc(tc: string): string | null {
  if (!/^[0-9]{11}$/.test(tc)) return 'T.C. kimlik numarası 11 haneli olmalıdır'
  return null
}

/** Aynı T.C. özetine sahip başka bir hasta varsa "Ad SOYAD (Protokol)" döner; yoksa null. */
export async function findTcOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  tcHash: string,
  exceptPatientId?: number
): Promise<string | null> {
  let query = supabase.from('patients').select('id, name, surname, protocol_no').eq('clinic_id', clinicId).eq('tc_hash', tcHash).limit(1)
  if (exceptPatientId) query = query.neq('id', exceptPatientId)
  const { data } = await query
  const hit = data?.[0]
  return hit ? `${hit.name} ${hit.surname}${hit.protocol_no ? ` (${hit.protocol_no})` : ''}` : null
}
