'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCtx, requireAdmin, type R } from './actionsShared'

// ---- Klinik ----
// ---- Klinik ----
export async function updateClinic(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const vatPct = parseFloat((formData.get('vat_rate_pct') as string) ?? '')
  const vatBps = !isNaN(vatPct) && vatPct >= 0 && vatPct <= 100
    ? Math.round(vatPct * 100)
    : undefined
  const bankFeePct = parseFloat((formData.get('bank_fee_pct') as string) ?? '')
  const bankFeeBps = !isNaN(bankFeePct) && bankFeePct >= 0 && bankFeePct <= 100
    ? Math.round(bankFeePct * 100)
    : undefined
  const unitCount = Math.max(1, Math.round(Number(formData.get('unit_count')) || 1))

  const { error } = await supabase
    .from('clinic_settings')
    .update({
      clinic_name: (formData.get('clinic_name') as string)?.trim(),
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      tax_no: (formData.get('tax_no') as string) || null,
      tax_office: (formData.get('tax_office') as string) || null,
      address: (formData.get('address') as string) || null,
      invoice_institution: (formData.get('invoice_institution') as string)?.trim() || null,
      authorized_person: (formData.get('authorized_person') as string)?.trim() || null,
      unit_count: unitCount,
      ...(bankFeeBps !== undefined ? { bank_fee_bps: bankFeeBps } : {}),
      default_currency: ['TRY', 'USD', 'EUR', 'GBP'].includes(String(formData.get('default_currency')))
        ? String(formData.get('default_currency'))
        : 'TRY',
      is_active: formData.get('is_active') === 'on',
      ...(vatBps !== undefined ? { vat_rate: vatBps } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Randevu ayarları ----
export async function updateRandevuSettings(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const duration = Number(formData.get('default_duration'))
  const { error } = await supabase
    .from('clinic_settings')
    .update({
      work_start: (formData.get('work_start') as string) || '09:00',
      work_end: (formData.get('work_end') as string) || '18:00',
      default_duration: isNaN(duration) ? 30 : duration,
      online_booking: formData.get('online_booking') === 'on',
      require_approval: formData.get('require_approval') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function saveNightShiftSettings(input: {
  active: boolean; start: string; end: string; days: number[]; doctorIds: number[]; branchId: number | null; interval: number; note: string
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end)) return { error: 'Geçerli mesai saatleri girin' }
  if (input.active && input.days.length === 0) return { error: 'En az bir gece mesaisi günü seçin' }
  if (![15, 20, 30, 45, 60].includes(input.interval)) return { error: 'Geçersiz randevu aralığı' }
  const { error } = await ctx.supabase.from('clinic_settings').update({
    night_shift_active: input.active, night_shift_start: input.start, night_shift_end: input.end,
    night_shift_days: input.days, night_shift_doctor_ids: input.doctorIds,
    night_shift_branch_id: input.branchId, night_shift_interval: input.interval,
    night_shift_note: input.note.trim() || null, updated_at: new Date().toISOString(),
  }).eq('id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings'); revalidatePath('/appointments')
  return { success: true }
}

export async function saveAppointmentType(input: {
  id?: number; name: string; duration: number; color: string; description: string; active: boolean; branchId: number | null; doctorIds: number[]
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const name = input.name.trim()
  if (!name) return { error: 'Randevu türü adı zorunludur' }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) return { error: 'Geçerli bir renk seçin' }
  if (!Number.isInteger(input.duration) || input.duration < 5 || input.duration > 1440) return { error: 'Süre 5-1440 dakika arasında olmalı' }
  const values = { clinic_id: ctx.clinicId, name, default_duration: input.duration, color: input.color.toUpperCase(), description: input.description.trim() || null, is_active: input.active, branch_id: input.branchId, doctor_ids: input.doctorIds, updated_at: new Date().toISOString() }
  const query = input.id
    ? ctx.supabase.from('appointment_types').update(values).eq('id', input.id).eq('clinic_id', ctx.clinicId)
    : ctx.supabase.from('appointment_types').insert({ ...values, is_system: false })
  const { error } = await query
  if (error) return { error: error.code === '23505' ? 'Bu isimde bir randevu türü zaten var' : error.message }
  revalidatePath('/settings'); revalidatePath('/appointments')
  return { success: true }
}


// ---- Logo yükleme ----
// ---- Logo yükleme ----
export async function uploadClinicLogo(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'Dosya seçilmedi' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Logo 2 MB\'dan büyük olamaz' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) return { error: 'Sadece PNG, JPG, SVG veya WebP desteklenir' }

  const admin = createAdminClient()
  const bucket = 'clinic-logos'

  // Bucket yoksa oluştur (idempotent)
  const { data: buckets, error: bucketListError } = await admin.storage.listBuckets()
  if (bucketListError) return { error: bucketListError.message }
  if (!buckets?.find((b) => b.name === bucket)) {
    const { error: bucketError } = await admin.storage.createBucket(bucket, { public: true, fileSizeLimit: 2097152 })
    if (bucketError) return { error: bucketError.message }
  }

  const path = `${clinicId}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadErr) return { error: uploadErr.message }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)
  // Önbellek kırmak için timestamp ekle
  const url = `${publicUrl}?t=${Date.now()}`

  const { error: updateErr } = await supabase
    .from('clinic_settings')
    .update({ logo_url: url, updated_at: new Date().toISOString() })
    .eq('id', clinicId)
  if (updateErr) {
    if (updateErr.message.includes('logo_url') || updateErr.code === '42703') {
      return { error: 'DB migration gerekli: Supabase Dashboard → SQL Editor\'da supabase/migrations/20260623_duration_logo.sql dosyasını çalıştırın.' }
    }
    return { error: updateErr.message }
  }

  revalidatePath('/settings')
  revalidatePath('/patients')
  return { success: true }
}
