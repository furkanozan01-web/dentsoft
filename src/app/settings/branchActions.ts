'use server'

import { revalidatePath } from 'next/cache'
import { getCtx, requireAdmin, type R } from './actionsShared'

// ---- Şube yönetimi ----
export async function addBranch(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const name = String(formData.get('name') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toLocaleUpperCase('tr-TR')
  if (!name || !code) return { error: 'Şube adı ve kodu zorunludur' }
  const { error } = await ctx.supabase.from('branches').insert({
    clinic_id: ctx.clinicId,
    name,
    code,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    address: String(formData.get('address') ?? '').trim() || null,
    authorized_person: String(formData.get('authorized_person') ?? '').trim() || null,
    unit_count: Math.max(1, Math.round(Number(formData.get('unit_count')) || 1)),
    work_start: String(formData.get('work_start') ?? '') || '09:00',
    work_end: String(formData.get('work_end') ?? '') || '18:00',
    bank_accounts: String(formData.get('bank_accounts') ?? '').trim() || null,
    cash_accounts: String(formData.get('cash_accounts') ?? '').trim() || null,
    is_active: formData.get('is_active') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateBranch(id: number, input: {
  name: string; code: string; phone?: string; email?: string; address?: string;
  authorizedPerson?: string; unitCount: number; workStart: string; workEnd: string;
  bankAccounts?: string; cashAccounts?: string; isActive: boolean;
}): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!input.name.trim() || !input.code.trim()) return { error: 'Şube adı ve kodu zorunludur' }
  const { error } = await ctx.supabase.from('branches').update({
    name: input.name.trim(), code: input.code.trim().toLocaleUpperCase('tr-TR'),
    phone: input.phone?.trim() || null, email: input.email?.trim() || null,
    address: input.address?.trim() || null, authorized_person: input.authorizedPerson?.trim() || null,
    unit_count: Math.max(1, Math.round(input.unitCount || 1)), work_start: input.workStart || '09:00',
    work_end: input.workEnd || '18:00', bank_accounts: input.bankAccounts?.trim() || null,
    cash_accounts: input.cashAccounts?.trim() || null, is_active: input.isActive, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function setActiveBranch(branchId: number | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  if (branchId) {
    const { data: branch } = await ctx.supabase.from('branches').select('id').eq('id', branchId).eq('clinic_id', ctx.clinicId).maybeSingle()
    if (!branch) return { error: 'Bu şubeye erişiminiz yok' }
  } else if (ctx.role !== 'bashekim') {
    return { error: 'Tüm şubeler görünümü için yetkiniz yok' }
  }
  const { error } = await ctx.supabase.from('profiles').update({ active_branch_id: branchId, updated_at: new Date().toISOString() }).eq('id', ctx.userId).eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

