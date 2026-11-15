'use server'

import { revalidatePath } from 'next/cache'
import { getCtx, requireAdmin, type R } from './actionsShared'

/**
 * Bir şubenin hissedarlarını tek seferde kaydeder. Toplam TAM %100 olmalıdır (eksik veya fazla reddedilir);
 * kontrolü veritabanı fonksiyonu (set_branch_shares) yapar, tabloya doğrudan yazma kapalıdır.
 */
export async function saveBranchShares(
  branchId: number,
  rows: { doctor_id: number; rate_bps: number }[]
): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!Number.isInteger(branchId) || branchId <= 0) return { error: 'Şube seçimi zorunludur' }
  const clean = rows.map((r) => ({ doctor_id: Number(r.doctor_id), rate_bps: Math.round(Number(r.rate_bps)) }))
  if (clean.length === 0) return { error: 'En az bir hissedar ekleyin' }
  const total = clean.reduce((s, r) => s + r.rate_bps, 0)
  if (total !== 10000) return { error: `Hisse toplamı tam %100 olmalı (şu an %${(total / 100).toLocaleString('tr-TR')})` }

  const { error } = await ctx.supabase.rpc('set_branch_shares', { p_branch_id: branchId, p_shares: clean })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/finance')
  return { success: true }
}
