'use server'

import { drugGroups, patientFlags, type RxWarning } from '@/lib/rxSafety'
import { getCtx } from './actionsShared'
import { getAnamnesis } from './patientActions'

/**
 * Reçete metni + hastanın anamnezi için güvenlik uyarıları (prescription_rules kurallarından).
 * Yalnızca uyarır; kaydı engellemez.
 */
export async function checkRxSafety(patientId: number, content: string): Promise<{ warnings: RxWarning[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { warnings: [], error: 'Yetkisiz erişim' }
  const groups = drugGroups(content)
  if (!groups.length) return { warnings: [] }

  const an = await getAnamnesis(patientId)
  if (an.error || !an.data) return { warnings: [], error: an.error }
  const flags = patientFlags(an.data)
  if (!flags.length) return { warnings: [] }

  const warnings: RxWarning[] = []
  for (const g of groups) {
    const { data } = await ctx.supabase.rpc('check_prescription_safety', { p_rule_group: g.group, p_patient_flags: flags })
    for (const r of (data ?? []) as { severity: string; message: string; kub_reference: string | null }[]) {
      warnings.push({ label: g.label, severity: r.severity, message: r.message, ref: r.kub_reference })
    }
  }
  return { warnings }
}
