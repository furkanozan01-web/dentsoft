'use server'

import { localDateValue } from '@/lib/format'
import { revalidatePath } from 'next/cache'
import { type InvoiceSendResult, nextInvoiceNo, getCtx, validatePatient, calcBalance } from './actionsShared'

export async function sendInvoiceToInstitution(input: {
  patientId: number
  transactionIds: number[]
  invoiceNo: string
  lineDescription: string
  amountKurus: number
}): Promise<InvoiceSendResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientId = Number(input.patientId)
  const transactionIds = Array.from(new Set(input.transactionIds.map(Number))).filter(Boolean)
  const amountKurus = Math.round(Number(input.amountKurus))
  const lineDescription = input.lineDescription.trim()
  const invoiceNo = input.invoiceNo.trim() || await nextInvoiceNo(supabase, clinicId)

  if (!patientId || transactionIds.length === 0) return { error: 'Faturalanacak ödeme kaydı bulunamadı' }
  if (!lineDescription) return { error: 'Fatura işlem açıklaması zorunludur' }
  if (!Number.isFinite(amountKurus) || amountKurus <= 0) return { error: 'Geçerli bir fatura tutarı girin' }

  const [{ data: clinic }, { data: patient }, { data: txs }] = await Promise.all([
    supabase
      .from('clinic_settings')
      .select('invoice_institution, vat_rate')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .single(),
    supabase
      .from('transactions')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('type', 'payment')
      .in('id', transactionIds),
  ])

  const institution = clinic?.invoice_institution?.trim()
  if (!institution) return { error: 'Ayarlar > Klinik bölümünde e-fatura gönderim kurumu tanımlayın' }
  if (!patient) return { error: 'Hasta bulunamadı' }
  if ((txs ?? []).length !== transactionIds.length) return { error: 'Ödeme kayıtları doğrulanamadı' }

  const { error } = await supabase
    .from('transactions')
    .update({
      invoice_no: invoiceNo,
      invoice_sent_at: new Date().toISOString(),
      invoice_institution: institution,
      invoice_line_description: lineDescription,
      invoice_amount: amountKurus,
      invoice_vat_rate: clinic?.vat_rate ?? 1000,
    })
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('type', 'payment')
    .in('id', transactionIds)

  if (error) {
    if (
      error.code === '42703' ||
      error.message.includes('invoice_sent_at') ||
      error.message.includes('invoice_institution')
    ) {
      return { error: 'DB migration gerekli: supabase/migrations/20260625_invoice_settings_and_payment_invoice_fields.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true, invoiceNo, institution }
}

export async function getNextInvoiceNo(): Promise<{ invoiceNo?: string; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  return { invoiceNo: await nextInvoiceNo(supabase, clinicId) }
}

export async function addInstallment(
  patientId: number,
  dueDate: string,
  amountTL: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const raw = amountTL?.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const amount = Math.round(parseFloat(raw) * 100)
  if (!dueDate || isNaN(amount) || amount <= 0) return { error: 'Geçerli vade ve tutar girin' }

  const { error } = await supabase.from('payment_plans').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    due_date: dueDate,
    amount,
  })
  if (error) return { error: error.message }
  return { success: true }
}

// Kalan bakiyeyi N aya böler; SON taksite kalanı verir (yuvarlama kayması olmaz).
export async function autoInstallment(
  patientId: number,
  months: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (!months || months < 1 || months > 60) return { error: 'Geçerli taksit sayısı girin (1-60)' }

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  const balanceResult = await calcBalance(supabase, clinicId, patientId)
  if (balanceResult.error) return { error: balanceResult.error }
  const balance = balanceResult.balance ?? 0
  if (balance <= 0) return { error: 'Bölünecek kalan borç yok' }

  const monthly = Math.round(balance / months)
  const today = new Date()
  const rows = []
  for (let i = 1; i <= months; i++) {
    const due = new Date(today)
    due.setMonth(due.getMonth() + i)
    const amount = i === months ? balance - monthly * (months - 1) : monthly
    rows.push({
      clinic_id: clinicId,
      patient_id: patientId,
      due_date: localDateValue(due),
      amount,
    })
  }

  const { error } = await supabase.from('payment_plans').insert(rows)
  if (error) return { error: error.message }
  return { success: true }
}

// Taksiti ödendi işaretler + otomatik bir ödeme (transaction) kaydı oluşturur.
export async function markInstallmentPaid(
  installmentId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data: inst, error: iErr } = await supabase
    .from('payment_plans')
    .select('patient_id, amount, paid')
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
    .single()
  if (iErr || !inst) return { error: 'Taksit bulunamadı' }
  if (inst.paid) return { error: 'Bu taksit zaten ödenmiş' }

  const paidAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('payment_plans')
    .update({ paid: true, paid_at: paidAt, updated_at: paidAt })
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
    .eq('paid', false)
    .select('id')
    .maybeSingle()
  if (updateError) return { error: updateError.message }
  if (!updated) return { error: 'Bu taksit zaten ödenmiş' }

  const { error: txErr } = await supabase.from('transactions').insert({
    clinic_id: clinicId,
    patient_id: inst.patient_id,
    amount: inst.amount,
    method: 'other',
    type: 'payment',
    transaction_date: localDateValue(),
    description: 'Taksit ödemesi',
  })
  if (txErr) {
    await supabase
      .from('payment_plans')
      .update({ paid: false, paid_at: null, updated_at: new Date().toISOString() })
      .eq('id', installmentId)
      .eq('clinic_id', clinicId)
    return { error: txErr.message }
  }
  return { success: true }
}

export async function deleteInstallment(
  installmentId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { error } = await supabase
    .from('payment_plans')
    .delete()
    .eq('id', installmentId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  return { success: true }
}

// Hasta ödemesini siler. Sadece bu kliniğe ait ve type='payment' kayıtları.
export async function deletePayment(
  transactionId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx
  if (!transactionId) return { error: 'İşlem ID gerekli' }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('clinic_id', clinicId)
    .eq('type', 'payment')

  if (error) return { error: error.message }
  return { success: true }
}

export async function addPaymentWithCurrency(
  patientId: number,
  params: {
    amountKurus: number
    originalCurrency: string
    originalAmount: number | null
    exchangeRate: number | null
    paymentMethod: string
    partnerId: number | null
    note: string | null
    date: string
  }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }

  if (!Number.isFinite(params.amountKurus) || params.amountKurus <= 0)
    return { error: 'Geçerli bir tutar girin' }

  const validMethods = ['cash', 'card', 'transfer', 'senet', 'firma_odemesi']
  const method = validMethods.includes(params.paymentMethod) ? params.paymentMethod : 'cash'

  if (method === 'firma_odemesi' && !params.partnerId)
    return { error: 'Firma ödemesi için iş ortağı seçin' }

  const txDate = params.date || localDateValue()
  const currency = ['TRY', 'USD', 'EUR', 'GBP'].includes(params.originalCurrency)
    ? params.originalCurrency
    : 'TRY'

  // Gelir kaydı
  const { data: incomeTx, error: incomeErr } = await supabase
    .from('transactions')
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      amount: Math.round(params.amountKurus),
      method,
      type: 'payment',
      transaction_date: txDate,
      description: params.note || null,
      original_currency: currency,
      original_amount: currency !== 'TRY' ? params.originalAmount : null,
      exchange_rate: currency !== 'TRY' ? params.exchangeRate : null,
      partner_id: method === 'firma_odemesi' ? params.partnerId : null,
    })
    .select('id')
    .single()

  if (incomeErr || !incomeTx) return { error: incomeErr?.message ?? 'Ödeme kaydedilemedi' }

  // Firma ödemesinde ek gider kaydı
  if (method === 'firma_odemesi' && params.partnerId) {
    const { data: partner } = await supabase
      .from('business_partners')
      .select('name')
      .eq('id', params.partnerId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    const { data: patient } = await supabase
      .from('patients')
      .select('name, surname')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    const partnerName = partner?.name ?? `Ortak #${params.partnerId}`
    const patientName = patient ? `${patient.name} ${patient.surname}` : `Hasta #${patientId}`

    const { data: expenseTx, error: expenseErr } = await supabase
      .from('transactions')
      .insert({
        clinic_id: clinicId,
        amount: Math.round(params.amountKurus),
        type: 'expense',
        transaction_date: txDate,
        description: `${partnerName} üzerinden ödeme — Hasta: ${patientName}`,
        partner_id: params.partnerId,
        linked_transaction_id: incomeTx.id,
      })
      .select('id')
      .single()

    if (expenseErr) return { error: expenseErr.message }

    // Gelir kaydını gider kaydına bağla
    await supabase
      .from('transactions')
      .update({ linked_transaction_id: expenseTx?.id })
      .eq('id', incomeTx.id)
      .eq('clinic_id', clinicId)
  }

  revalidatePath('/patients')
  revalidatePath('/finance')
  return { success: true }
}

// ── Senet Robotu ──────────────────────────────────────────────────────────────

export async function createPromissoryPlan(
  patientId: number,
  title: string,
  interestRateBps: number,
  installments: { due_date: string; amount: number }[]
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const patientError = await validatePatient(supabase, clinicId, patientId)
  if (patientError) return { error: patientError }
  if (!installments.length) return { error: 'En az bir taksit gerekli' }

  const { data: group, error: groupErr } = await supabase
    .from('payment_plan_groups')
    .insert({ clinic_id: clinicId, patient_id: patientId, title, interest_rate_bps: interestRateBps })
    .select('id')
    .single()

  if (groupErr || !group) return { error: groupErr?.message ?? 'Plan grubu oluşturulamadı' }

  const rows = installments.map((it) => ({
    clinic_id: clinicId,
    patient_id: patientId,
    group_id: group.id,
    due_date: it.due_date,
    amount: it.amount,
    paid: false,
  }))

  const { error: insertErr } = await supabase.from('payment_plans').insert(rows)
  if (insertErr) return { error: insertErr.message }

  revalidatePath('/patients')
  return { success: true }
}
