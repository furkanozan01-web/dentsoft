'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { localDateValue } from '@/lib/format'
import { computeSummary } from '@/lib/finance/hakedis'
import { canSeeAllHakedis } from '@/lib/permissions'

type R = { success?: boolean; error?: string } | null

async function getCtx() {
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
  if (!profile?.clinic_id) return null
  return { supabase, clinicId: profile.clinic_id }
}

export async function addExpense(input: {
  amount: string
  date: string
  description: string
  category?: string
  invoiceNo?: string
  recurring?: string
  method?: string
  accountName?: string
  doctorId?: number | null
  partnerId?: number | null
  patientId?: number | null
  treatmentId?: number | null
  invoiceStatus?: string
  paymentStatus?: string
  partnerServiceId?: number | null
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const raw = input.amount?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (isNaN(amount) || amount <= 0) return { error: 'Geçerli bir tutar girin' }
  const desc = input.description?.trim()
  if (!desc) return { error: 'Açıklama zorunludur' }

  const recurring = input.recurring === 'monthly' || input.recurring === 'yearly' ? input.recurring : null

  if (input.doctorId) {
    const { error } = await supabase.rpc('record_doctor_payment', {
      p_doctor_id: input.doctorId,
      p_amount: amount,
      p_payment_type: input.category === 'Maaş' ? 'maas' : 'ara_odeme',
      p_method: input.method || 'cash',
      p_payment_date: input.date || localDateValue(),
      p_note: desc,
    })
    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { success: true }
  }

  const { error } = await supabase.from('transactions').insert({
    clinic_id: clinicId,
    amount,
    type: 'expense',
    transaction_date: input.date || localDateValue(),
    description: desc,
    category: input.category?.trim() || null,
    invoice_no: input.invoiceNo?.trim() || null,
    recurring,
    method: input.method || null,
    account_name: input.accountName?.trim() || null,
    partner_id: input.partnerId || null,
    patient_id: input.patientId || null,
    treatment_id: input.treatmentId || null,
    invoice_status: input.invoiceStatus || (input.invoiceNo ? 'faturali' : 'belirsiz'),
    payment_status: input.paymentStatus || 'odendi',
    source_type: input.partnerId ? 'company_payment' : 'manual',
    partner_service_id: input.partnerServiceId || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

export async function deleteTransaction(id: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const { data: linkedPayment } = await supabase
    .from('doctor_payments')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('transaction_id', id)
    .maybeSingle()
  if (linkedPayment) {
    const { error } = await supabase.rpc('delete_doctor_payment_link', {
      p_transaction_id: id,
      p_payment_id: null,
    })
    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { success: true }
  }
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .eq('type', 'expense')
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

// --- Hekim hakediş ödemesi (mahsuplaşma/avans/prim) ---
export async function addDoctorPayment(input: {
  doctorId: number
  amount: string
  paymentType: string
  method: string
  date: string
  note: string
  accountName?: string
  earningPeriod?: string
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!input.doctorId) return { error: 'Hekim seçin' }
  const raw = input.amount?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (isNaN(amount) || amount <= 0) return { error: 'Geçerli bir tutar girin' }

  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', input.doctorId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (doctorError) return { error: doctorError.message }
  if (!doctor) return { error: 'Hekim bu klinikte bulunamadı' }

  const paymentTypes = ['maas', 'ara_odeme', 'mahsuplasma', 'avans', 'prim', 'duzeltme', 'garantor', 'kar_payi']
  const methods = ['cash', 'transfer', 'check', 'other']
  const paymentType = paymentTypes.includes(input.paymentType) ? input.paymentType : 'ara_odeme'
  const method = methods.includes(input.method) ? input.method : 'cash'

  const { data: paymentId, error } = await supabase.rpc('record_doctor_payment', {
    p_doctor_id: input.doctorId,
    p_amount: amount,
    p_payment_type: paymentType,
    p_method: method,
    p_payment_date: input.date || localDateValue(),
    p_note: input.note?.trim() || null,
  })
  if (error) return { error: error.message }

  const accountName = input.accountName?.trim() || null
  const earningPeriod = /^\d{4}-\d{2}$/.test(input.earningPeriod ?? '')
    ? input.earningPeriod
    : (input.date || localDateValue()).slice(0, 7)
  const { data: updatedPayment, error: updateError } = await supabase
    .from('doctor_payments')
    .update({ earning_period: earningPeriod, ...(accountName ? { account_name: accountName } : {}) })
    .eq('id', paymentId as number)
    .eq('clinic_id', clinicId)
    .select('transaction_id')
    .single()
  if (updateError) {
    await supabase.rpc('delete_doctor_payment_link', {
      p_transaction_id: null,
      p_payment_id: paymentId as number,
    })
    return { error: updateError.message }
  }
  if (updatedPayment.transaction_id && accountName) {
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({ account_name: accountName })
      .eq('id', updatedPayment.transaction_id)
      .eq('clinic_id', clinicId)
    if (transactionError) {
      await supabase.rpc('delete_doctor_payment_link', {
        p_transaction_id: null,
        p_payment_id: paymentId as number,
      })
      return { error: transactionError.message }
    }
  }
  revalidatePath('/finance')
  return { success: true }
}

export async function deleteDoctorPayment(id: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase } = ctx
  const { error } = await supabase.rpc('delete_doctor_payment_link', {
    p_transaction_id: null,
    p_payment_id: id,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

// ── Kasa (şube kasası) ────────────────────────────────────────────────────────

export async function distributeBranchProfit(input: {
  branchId: number
  amount: string
  date?: string
  note?: string
}): Promise<{ success?: boolean; error?: string; distributed?: { doctorId: number; amount: number }[] }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase } = ctx

  if (!input.branchId) return { error: 'Şube seçin' }
  const raw = input.amount?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (isNaN(amount) || amount <= 0) return { error: 'Geçerli bir tutar girin' }

  const { data, error } = await supabase.rpc('distribute_branch_profit', {
    p_branch_id: input.branchId,
    p_total_amount: amount,
    p_payment_date: input.date || localDateValue(),
    p_note: input.note?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true, distributed: (data ?? []).map((row: { doctor_id: number; amount: number }) => ({ doctorId: row.doctor_id, amount: row.amount })) }
}

// ── İş Ortakları ─────────────────────────────────────────────────────────────

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
  address: string | null
  tax_info: string | null
  bank_info: string | null
}

export async function getBusinessPartners(): Promise<{ data?: BusinessPartner[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase } = ctx
  const { data, error } = await supabase
    .from('business_partners')
    .select('id, name, partner_type, contact_person, phone, email, notes, is_active, created_at, address, tax_info, bank_info')
    .eq('is_active', true)
    .order('name')
  if (error) return { error: error.message }
  return { data: data as BusinessPartner[] }
}

export async function addBusinessPartner(input: {
  name: string
  partnerType: string
  contactPerson?: string
  phone?: string
  email?: string
  notes?: string
  address?: string
  taxInfo?: string
  bankInfo?: string
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const name = input.name?.trim()
  if (!name) return { error: 'İş ortağı adı zorunludur' }

  const validTypes = ['laboratuvar', 'tedarikci', 'firma_odeme', 'diger']
  const partnerType = validTypes.includes(input.partnerType) ? input.partnerType : 'diger'

  const { error } = await supabase.from('business_partners').insert({
    clinic_id: clinicId,
    name,
    partner_type: partnerType,
    contact_person: input.contactPerson?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    address: input.address?.trim() || null,
    tax_info: input.taxInfo?.trim() || null,
    bank_info: input.bankInfo?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/patients')
  return { success: true }
}

export async function updateBusinessPartner(
  id: number,
  input: {
    name?: string
    partnerType?: string
    contactPerson?: string
    phone?: string
    email?: string
    notes?: string
    address?: string
    taxInfo?: string
    bankInfo?: string
  }
): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!id) return { error: 'İş ortağı ID gerekli' }
  const name = input.name?.trim()
  if (name !== undefined && !name) return { error: 'Ad boş bırakılamaz' }

  const validTypes = ['laboratuvar', 'tedarikci', 'firma_odeme', 'diger']
  const updates: Record<string, unknown> = {}
  if (name) updates.name = name
  if (input.partnerType) updates.partner_type = validTypes.includes(input.partnerType) ? input.partnerType : 'diger'
  if (input.contactPerson !== undefined) updates.contact_person = input.contactPerson?.trim() || null
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null
  if (input.email !== undefined) updates.email = input.email?.trim() || null
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null
  if (input.address !== undefined) updates.address = input.address?.trim() || null
  if (input.taxInfo !== undefined) updates.tax_info = input.taxInfo?.trim() || null
  if (input.bankInfo !== undefined) updates.bank_info = input.bankInfo?.trim() || null

  const { error } = await supabase
    .from('business_partners')
    .update(updates)
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/patients')
  return { success: true }
}

export async function deleteBusinessPartner(id: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const { error } = await supabase
    .from('business_partners')
    .update({ is_active: false })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/patients')
  return { success: true }
}

export async function addPartnerService(input: {
  partnerId: number
  serviceName: string
  patientId?: number | null
  doctorId?: number | null
  serviceDate: string
  dueDate?: string | null
  amount: string
  vatStatus: string
  invoiceStatus: string
  paymentStatus: string
  description?: string
  attachmentUrl?: string
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const raw = input.amount?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (!input.partnerId || !input.serviceName?.trim()) return { error: 'Firma ve hizmet adı zorunludur' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Geçerli bir tutar girin' }
  const { data: partner } = await supabase.from('business_partners').select('id').eq('id', input.partnerId).eq('clinic_id', clinicId).maybeSingle()
  if (!partner) return { error: 'Firma bulunamadı' }
  const { error } = await supabase.from('partner_services').insert({
    clinic_id: clinicId,
    partner_id: input.partnerId,
    service_name: input.serviceName.trim(),
    patient_id: input.patientId || null,
    doctor_id: input.doctorId || null,
    service_date: input.serviceDate || localDateValue(),
    due_date: input.dueDate || null,
    amount,
    vat_status: input.vatStatus || 'kdv_dahil',
    invoice_status: input.invoiceStatus || 'bekliyor',
    payment_status: input.paymentStatus || 'bekliyor',
    description: input.description?.trim() || null,
    attachment_url: input.attachmentUrl?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

// ---- Klinik Borçları ----

export interface ClinicDebt {
  id: number
  title: string
  total_amount: number
  paid_amount: number
  due_date: string | null
  recurrence: string
  notes: string | null
  status: string
  created_at: string
  payment_day?: number | null
  payment_method?: string | null
  account_name?: string | null
  last_paid_at?: string | null
}

export async function getClinicDebts(): Promise<{ data?: ClinicDebt[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const { data, error } = await supabase
    .from('clinic_debts')
    .select('id, title, total_amount, paid_amount, due_date, recurrence, notes, status, created_at, payment_day, payment_method, account_name, last_paid_at')
    .eq('clinic_id', clinicId)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) return { error: error.message }
  return { data: (data ?? []) as ClinicDebt[] }
}

export async function addClinicDebt(input: {
  title: string
  totalAmount: number
  dueDate: string | null
  recurrence: string
  notes: string | null
  paymentDay?: number | null
  paymentMethod?: string | null
  accountName?: string | null
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!input.title?.trim()) return { error: 'Başlık zorunludur' }
  if (!input.totalAmount || input.totalAmount <= 0) return { error: 'Tutar sıfırdan büyük olmalı' }

  const { error } = await supabase.from('clinic_debts').insert({
    clinic_id: clinicId,
    title: input.title.trim(),
    total_amount: Math.round(input.totalAmount),
    paid_amount: 0,
    due_date: input.dueDate || null,
    recurrence: input.recurrence || 'tek_seferlik',
    notes: input.notes?.trim() || null,
    status: 'active',
    payment_day: input.paymentDay || null,
    payment_method: input.paymentMethod || null,
    account_name: input.accountName?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

export async function updateClinicDebt(id: number, input: {
  title: string
  totalAmount: number
  dueDate: string | null
  recurrence: string
  notes: string | null
  paymentDay?: number | null
  paymentMethod?: string | null
  accountName?: string | null
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!input.title?.trim()) return { error: 'Başlık zorunludur' }
  if (!input.totalAmount || input.totalAmount <= 0) return { error: 'Tutar sıfırdan büyük olmalı' }

  const { error } = await supabase
    .from('clinic_debts')
    .update({
      title: input.title.trim(),
      total_amount: Math.round(input.totalAmount),
      due_date: input.dueDate || null,
      recurrence: input.recurrence || 'tek_seferlik',
      notes: input.notes?.trim() || null,
      payment_day: input.paymentDay || null,
      payment_method: input.paymentMethod || null,
      account_name: input.accountName?.trim() || null,
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

export async function payClinicDebt(id: number, paymentKurus: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase } = ctx

  if (paymentKurus <= 0) return { error: 'Ödeme tutarı sıfırdan büyük olmalı' }

  const { error } = await supabase.rpc('pay_clinic_debt', {
    p_debt_id: id,
    p_amount: paymentKurus,
    p_method: null,
    p_account_name: null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

export async function deleteClinicDebt(id: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  const { error } = await supabase
    .from('clinic_debts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return { success: true }
}

// ---- Hekim Hakediş (PERİ tool'u için) ----

export interface HekimHakedisResult {
  hekim_id: number
  hekim_adi: string
  model: string | null
  ay: string
  brut_tl: number
  net_tl: number
  hakedis_tl: number
  odendi_tl: number
  kalan_tl: number
  tamamlanan_tedavi: number
  tedavi_sayisi: number
}

export async function getHekimHakedis(input: {
  hekim_id?: number
  tarih_baslangic?: string
  tarih_bitis?: string
}): Promise<{ data?: HekimHakedisResult | HekimHakedisResult[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Yetkisiz erişim' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, role, doctor_id')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) return { error: 'Klinik bulunamadı' }

  const clinicId = profile.clinic_id as number
  const isAdmin = profile.role === 'bashekim'

  // Mesul müdür kontrolü
  let isMesulMudur = false
  if (profile.doctor_id) {
    const { data: myDoc } = await supabase
      .from('doctors')
      .select('is_mesul_mudur')
      .eq('id', profile.doctor_id)
      .eq('clinic_id', clinicId)
      .single()
    isMesulMudur = myDoc?.is_mesul_mudur === true
  }
  // hakedis_tum izni (rol şablonu + kişisel override) VEYA doctors.is_mesul_mudur bayrağı
  const canSeeAll = isAdmin || isMesulMudur || (await canSeeAllHakedis())

  // Hedef hekim belirleme + yetki kontrolü
  const targetId = input.hekim_id ?? profile.doctor_id ?? null
  if (!targetId) return { error: 'Hekim kimliği belirtilmedi ve hesabınızla eşleşen bir hekim bulunamadı.' }
  if (!canSeeAll && targetId !== profile.doctor_id) {
    return { error: 'Bu bilgiyi görüntüleme yetkiniz yok.' }
  }

  // Ay anahtarı (YYYY-MM)
  const monthKey = input.tarih_baslangic
    ? input.tarih_baslangic.substring(0, 7)
    : new Date().toISOString().substring(0, 7)
  const [yr, mo] = monthKey.split('-').map(Number)
  const rangeStart = `${monthKey}-01`
  const nextMo = mo === 12 ? `${yr + 1}-01` : `${yr}-${String(mo + 1).padStart(2, '0')}`
  const rangeEnd = `${nextMo}-01`

  // Hangi doktorlar hesaplanacak
  const doctorFilter = canSeeAll && !input.hekim_id
    ? supabase.from('doctors').select('id, name, specialty, color, commission_rate_bps, payment_model, monthly_salary, guarantee_amount, bonus_amount, per_transaction_amount, salary_day, payment_account, guarantee_active, guarantee_period, guarantee_method, guarantee_note').eq('clinic_id', clinicId).eq('status', 'active')
    : supabase.from('doctors').select('id, name, specialty, color, commission_rate_bps, payment_model, monthly_salary, guarantee_amount, bonus_amount, per_transaction_amount, salary_day, payment_account, guarantee_active, guarantee_period, guarantee_method, guarantee_note').eq('clinic_id', clinicId).eq('id', targetId)

  const [
    { data: doctors, error: docErr },
    { data: treatments, error: txErr1 },
    { data: txs, error: txErr2 },
    { data: patients, error: patErr },
    { data: payments, error: payErr },
    { data: shares, error: shareErr },
  ] = await Promise.all([
    doctorFilter,
    supabase
      .from('treatments')
      .select('id, treatment_date, fee, cost, doctor_id, status, treatment_name, patient_id')
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled')
      .gte('treatment_date', rangeStart)
      .lt('treatment_date', rangeEnd),
    supabase
      .from('transactions')
      .select('transaction_date, amount, type, patient_id, treatment_id, method, branch_id')
      .eq('clinic_id', clinicId)
      .gte('transaction_date', rangeStart)
      .lt('transaction_date', rangeEnd),
    supabase
      .from('patients')
      .select('id, name, surname')
      .eq('clinic_id', clinicId),
    supabase
      .from('doctor_payments')
      .select('doctor_id, amount, payment_date, earning_period')
      .eq('clinic_id', clinicId)
      .or(`earning_period.eq.${monthKey},and(earning_period.is.null,payment_date.gte.${rangeStart},payment_date.lt.${rangeEnd})`),
    supabase
      .from('doctor_shares')
      .select('id, doctor_id, branch_id, rate_bps, start_date, end_date, is_active')
      .eq('clinic_id', clinicId),
  ])

  if (docErr) return { error: docErr.message }
  if (txErr1) return { error: txErr1.message }
  if (txErr2) return { error: txErr2.message }
  if (patErr) return { error: patErr.message }
  if (payErr) return { error: payErr.message }
  if (shareErr) return { error: shareErr.message }
  if (!doctors || doctors.length === 0) return { error: 'Hekim bulunamadı.' }

  const fmt = (kurus: number) => Math.round(kurus) / 100

  const profitByMonth: Record<string, number> = {}
  for (const tx of txs ?? []) {
    if (!tx.branch_id) continue
    const signed = tx.type === 'payment' ? tx.amount : -tx.amount
    const key = `${tx.branch_id}:${monthKey}`
    profitByMonth[key] = (profitByMonth[key] ?? 0) + signed
  }

  const results: HekimHakedisResult[] = (doctors as Array<{
    id: number; name: string; specialty: string | null; color: string | null;
    commission_rate_bps: number | null; payment_model: string | null;
    monthly_salary: number | null; guarantee_amount: number | null;
    bonus_amount: number | null; per_transaction_amount: number | null;
    salary_day: number | null; payment_account: string | null;
    guarantee_active: boolean; guarantee_period: string; guarantee_method: string; guarantee_note: string | null;
  }>).map((doc) => {
    const summary = computeSummary(
      doc,
      (shares ?? []) as Parameters<typeof computeSummary>[1],
      (treatments ?? []) as Parameters<typeof computeSummary>[2],
      (patients ?? []) as Parameters<typeof computeSummary>[3],
      (txs ?? []) as Parameters<typeof computeSummary>[4],
      (payments ?? []) as Parameters<typeof computeSummary>[5],
      monthKey,
      profitByMonth
    )
    return {
      hekim_id: doc.id,
      hekim_adi: doc.name,
      model: doc.payment_model,
      ay: monthKey,
      brut_tl: fmt(summary.gross),
      net_tl: fmt(summary.net),
      hakedis_tl: fmt(summary.entitlement),
      odendi_tl: fmt(summary.paid),
      kalan_tl: fmt(summary.remaining),
      tamamlanan_tedavi: summary.completedCount,
      tedavi_sayisi: summary.details.length,
    }
  })

  return { data: results.length === 1 ? results[0] : results }
}
