'use server'

import { revalidatePath } from 'next/cache'
import { cleanMoney, localDateValue } from '@/lib/format'
import { getLabCtx } from './labCtx'

type R = { error?: string; success?: boolean }

const MAX_AMOUNT = 2_000_000_000 // integer (kuruş) sınırı

async function requireLab() {
  const ctx = await getLabCtx()
  return ctx.status === 'ok' ? ctx : null
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function parsePrice(value: string): number {
  const n = Number(cleanMoney(value))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/**
 * Yapılan işi bildirir: birim fiyat × adet = tutar. Tutar, kliniğin Borçlar sekmesine borç olarak düşer
 * (ödeme orada yapılır ve Deftere gider olarak işlenir).
 */
export async function addLabEntry(input: {
  name: string
  unitPrice: string
  quantity: number
  date: string
  note?: string
}): Promise<R> {
  const ctx = await requireLab()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const name = input.name?.trim()
  if (!name) return { error: 'İşlem adı zorunludur' }
  if (name.length > 120) return { error: 'İşlem adı en fazla 120 karakter olabilir' }
  const quantity = Math.round(Number(input.quantity))
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return { error: 'Adet 1 ile 10.000 arasında olmalı' }
  const unit = parsePrice(input.unitPrice)
  if (unit <= 0) return { error: 'Geçerli bir birim fiyat girin' }
  const total = unit * quantity
  if (total > MAX_AMOUNT) return { error: 'Tutar çok büyük' }
  if (!ctx.branchId) return { error: 'Kliniğin şubesi bulunamadı; klinik yöneticisiyle görüşün' }
  const today = localDateValue()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '') ? input.date : today
  if (date > addDays(today, 7)) return { error: 'İleri tarihli kayıt girilemez' }
  const note = input.note?.trim().slice(0, 500) || null
  const dueDate = addDays(date, 30)

  const { data: svc, error: svcErr } = await ctx.admin
    .from('partner_services')
    .insert({
      clinic_id: ctx.clinicId,
      partner_id: ctx.partner.id,
      service_name: name,
      service_date: date,
      due_date: dueDate,
      amount: total,
      quantity,
      unit_price: unit,
      vat_status: 'kdv_dahil',
      invoice_status: 'bekliyor',
      payment_status: 'bekliyor',
      description: note,
      created_by: ctx.userId,
      reported_by_partner: true,
      branch_id: ctx.branchId,
    })
    .select('id')
    .single()
  if (svcErr || !svc) return { error: svcErr?.message ?? 'Kayıt oluşturulamadı' }

  const { error: debtErr } = await ctx.admin.from('clinic_debts').insert({
    clinic_id: ctx.clinicId,
    title: `${ctx.partner.name} — ${name}${quantity > 1 ? ` ×${quantity}` : ''}`,
    total_amount: total,
    paid_amount: 0,
    due_date: dueDate,
    recurrence: 'tek_seferlik',
    notes: note,
    status: 'active',
    partner_id: ctx.partner.id,
    partner_service_id: svc.id,
    branch_id: ctx.branchId,
  })
  if (debtErr) {
    await ctx.admin.from('partner_services').delete().eq('id', svc.id).eq('partner_id', ctx.partner.id)
    return { error: debtErr.message }
  }
  revalidatePath('/laboratuvar')
  revalidatePath('/finance')
  return { success: true }
}

/** Henüz ödeme yapılmamış, kendi bildirdiği bir kaydı geri çeker */
export async function deleteLabEntry(serviceId: number): Promise<R> {
  const ctx = await requireLab()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { data: svc } = await ctx.admin
    .from('partner_services')
    .select('id, payment_status, reported_by_partner')
    .eq('id', serviceId)
    .eq('partner_id', ctx.partner.id)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()
  if (!svc) return { error: 'Kayıt bulunamadı' }
  if (!svc.reported_by_partner) return { error: 'Bu kaydı yalnızca klinik silebilir' }
  const { data: debts } = await ctx.admin
    .from('clinic_debts')
    .select('id, paid_amount')
    .eq('partner_service_id', serviceId)
    .eq('partner_id', ctx.partner.id)
    .neq('status', 'cancelled')
  if (svc.payment_status !== 'bekliyor' || (debts ?? []).some((d) => d.paid_amount > 0)) {
    return { error: 'Ödemesi başlamış bir kayıt silinemez' }
  }
  await ctx.admin.from('clinic_debts').update({ status: 'cancelled' }).eq('partner_service_id', serviceId).eq('partner_id', ctx.partner.id)
  const { error } = await ctx.admin.from('partner_services').delete().eq('id', serviceId).eq('partner_id', ctx.partner.id)
  if (error) return { error: error.message }
  revalidatePath('/laboratuvar')
  revalidatePath('/finance')
  return { success: true }
}

export async function addQuickItem(input: { name: string; unitPrice: string }): Promise<R> {
  const ctx = await requireLab()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const name = input.name?.trim()
  if (!name) return { error: 'Kalem adı zorunludur' }
  if (name.length > 80) return { error: 'Kalem adı en fazla 80 karakter olabilir' }
  const unit = parsePrice(input.unitPrice)
  if (unit <= 0 || unit > MAX_AMOUNT) return { error: 'Geçerli bir birim fiyat girin' }
  const { error } = await ctx.admin.from('partner_quick_items').insert({
    clinic_id: ctx.clinicId, partner_id: ctx.partner.id, name, unit_price: unit,
  })
  if (error) return { error: error.message }
  revalidatePath('/laboratuvar')
  return { success: true }
}

export async function updateQuickItemPrice(id: number, unitPrice: string): Promise<R> {
  const ctx = await requireLab()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const unit = parsePrice(unitPrice)
  if (unit <= 0 || unit > MAX_AMOUNT) return { error: 'Geçerli bir birim fiyat girin' }
  const { error } = await ctx.admin.from('partner_quick_items').update({ unit_price: unit }).eq('id', id).eq('partner_id', ctx.partner.id)
  if (error) return { error: error.message }
  revalidatePath('/laboratuvar')
  return { success: true }
}

export async function deleteQuickItem(id: number): Promise<R> {
  const ctx = await requireLab()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { error } = await ctx.admin.from('partner_quick_items').update({ is_active: false }).eq('id', id).eq('partner_id', ctx.partner.id)
  if (error) return { error: error.message }
  revalidatePath('/laboratuvar')
  return { success: true }
}
