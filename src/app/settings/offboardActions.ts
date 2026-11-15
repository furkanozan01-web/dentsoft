'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { localDateValue } from '@/lib/format'
import { getCtx, requireAdmin } from './actionsShared'

// Hekim / kullanıcı pasife alma ve silme (gizleme).
// Devam eden hastalar başka bir hekime aktarılır: yalnızca henüz ÖDENMEMİŞ kısım yeni hekime geçer;
// ödenmiş kısım eski hekimde kalır (hakedişi o ödemelere göre eski hekimde sayılır).

export type OffboardSummary = {
  patients: number
  treatments: number
  paidKurus: number // eski hekimde kalacak (ödenmiş) kısım
  unpaidKurus: number // yeni hekime geçecek (ödenmemiş) kısım
  futureAppointments: number
  targets: { id: number; name: string; branch_id: number | null }[]
}

export type OffboardResult = {
  error?: string
  success?: boolean
  message?: string
}

type Admin = ReturnType<typeof createAdminClient>

type OpenTreatment = {
  id: number
  patient_id: number
  fee: number | null
  original_fee: number | null
  cost: number | null
  tariff_id: number | null
  treatment_date: string | null
  tooth: number | null
  treatment_name: string
  category: string | null
  plan_no: number | null
  phase_no: number | null
  status: string | null
  branch_id: number | null
}

type PlanItem = { t: OpenTreatment; fee: number; paid: number; unpaid: number }

const SELECT_OPEN =
  'id, patient_id, fee, original_fee, cost, tariff_id, treatment_date, tooth, treatment_name, category, plan_no, phase_no, status, branch_id'

/** Hekimin açık (hesabı kapatılmamış) tedavileri ve her birinin ödenmiş/ödenmemiş payı */
async function buildPlan(admin: Admin, clinicId: number, doctorId: number): Promise<PlanItem[]> {
  const { data: open } = await admin
    .from('treatments')
    .select(SELECT_OPEN)
    .eq('clinic_id', clinicId)
    .eq('doctor_id', doctorId)
    .eq('is_closed', false)
    .neq('status', 'cancelled')
  const rows = (open ?? []) as OpenTreatment[]
  if (!rows.length) return []

  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)))
  const [{ data: all }, { data: pays }] = await Promise.all([
    admin.from('treatments').select('patient_id, fee').eq('clinic_id', clinicId).in('patient_id', patientIds).neq('status', 'cancelled'),
    admin.from('transactions').select('patient_id, amount').eq('clinic_id', clinicId).eq('type', 'payment').in('patient_id', patientIds),
  ])
  const owed = new Map<number, number>()
  const paid = new Map<number, number>()
  for (const r of all ?? []) owed.set(r.patient_id, (owed.get(r.patient_id) ?? 0) + (r.fee ?? 0))
  for (const r of pays ?? []) paid.set(r.patient_id as number, (paid.get(r.patient_id as number) ?? 0) + (r.amount ?? 0))

  return rows.map((t) => {
    const o = owed.get(t.patient_id) ?? 0
    const ratio = o > 0 ? Math.min(1, (paid.get(t.patient_id) ?? 0) / o) : 1
    const fee = t.fee ?? 0
    const paidPart = Math.round(fee * ratio)
    return { t, fee, paid: paidPart, unpaid: fee - paidPart }
  })
}

async function futureAppointmentRows(admin: Admin, clinicId: number, doctorId: number) {
  const { data } = await admin
    .from('appointments')
    .select('id, scheduled_at, duration_min, status')
    .eq('clinic_id', clinicId)
    .eq('doctor_id', doctorId)
    .in('status', ['scheduled', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
  return (data ?? []) as { id: number; scheduled_at: string; duration_min: number; status: string }[]
}

export async function getOffboardSummary(doctorId: number): Promise<{ data?: OffboardSummary; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return { error: adminErr.error }
  const admin = createAdminClient()

  const plan = await buildPlan(admin, ctx.clinicId, doctorId)
  const appts = await futureAppointmentRows(admin, ctx.clinicId, doctorId)
  const { data: targets } = await admin
    .from('doctors')
    .select('id, name, branch_id')
    .eq('clinic_id', ctx.clinicId)
    .eq('status', 'active')
    .neq('id', doctorId)
    .order('name')

  return {
    data: {
      patients: new Set(plan.map((p) => p.t.patient_id)).size,
      treatments: plan.length,
      paidKurus: plan.reduce((s, p) => s + p.paid, 0),
      unpaidKurus: plan.reduce((s, p) => s + p.unpaid, 0),
      futureAppointments: appts.length,
      targets: (targets ?? []) as OffboardSummary['targets'],
    },
  }
}

type CoreInput = {
  clinicId: number
  doctorId: number
  action: 'passive' | 'delete'
  transferToDoctorId: number | null
  moveAppointments: boolean
}

async function offboardDoctorCore(admin: Admin, input: CoreInput): Promise<OffboardResult> {
  const { clinicId, doctorId, action } = input
  const { data: doctor } = await admin.from('doctors').select('id, name, status').eq('id', doctorId).eq('clinic_id', clinicId).maybeSingle()
  if (!doctor) return { error: 'Hekim bulunamadı' }
  if (doctor.status === 'deleted') return { error: 'Bu hekim zaten silinmiş' }

  const plan = await buildPlan(admin, clinicId, doctorId)
  const needsTransfer = plan.length > 0
  const notes: string[] = []

  if (needsTransfer) {
    const toId = input.transferToDoctorId
    if (!toId) return { error: 'Devam eden hastalar için aktarılacak hekimi seçin' }
    if (toId === doctorId) return { error: 'Hastalar aynı hekime aktarılamaz' }
    const { data: target } = await admin.from('doctors').select('id, status').eq('id', toId).eq('clinic_id', clinicId).maybeSingle()
    if (!target || target.status !== 'active') return { error: 'Aktarılacak hekim aktif değil' }

    const today = localDateValue()
    let whole = 0
    let split = 0
    let stay = 0
    for (const item of plan) {
      const { t, fee, paid, unpaid } = item
      if (unpaid <= 0) { stay += 1; continue } // tamamen ödenmiş: eski hekimde kalır
      if (paid <= 0) {
        const { error } = await admin.from('treatments').update({ doctor_id: toId, updated_at: new Date().toISOString() }).eq('id', t.id).eq('clinic_id', clinicId)
        if (error) return { error: `Tedavi aktarılamadı: ${error.message}` }
        whole += 1
        continue
      }
      // Kısmen ödenmiş: ödenen kısım eski hekimde kalır, kalan bedel yeni hekime ayrı kayıt olarak açılır
      const ratio = paid / fee
      const orig = t.original_fee ?? fee
      const cost = t.cost ?? 0
      const oldOrig = Math.round(orig * ratio)
      const oldCost = Math.round(cost * ratio)
      const { data: created, error: insErr } = await admin
        .from('treatments')
        .insert({
          clinic_id: clinicId,
          patient_id: t.patient_id,
          doctor_id: toId,
          tariff_id: t.tariff_id,
          treatment_date: today,
          tooth: t.tooth,
          treatment_name: t.treatment_name,
          category: t.category,
          plan_no: t.plan_no,
          phase_no: t.phase_no,
          status: t.status ?? 'done',
          fee: unpaid,
          original_fee: orig - oldOrig,
          cost: cost - oldCost,
          is_closed: false,
          branch_id: t.branch_id,
        })
        .select('id')
        .single()
      if (insErr || !created) return { error: `Kalan bedel yeni hekime açılamadı: ${insErr?.message ?? ''}` }
      const { error: updErr } = await admin
        .from('treatments')
        .update({ fee: paid, original_fee: oldOrig, cost: oldCost, updated_at: new Date().toISOString() })
        .eq('id', t.id)
        .eq('clinic_id', clinicId)
      if (updErr) {
        await admin.from('treatments').delete().eq('id', created.id).eq('clinic_id', clinicId)
        return { error: `Tedavi bölünemedi: ${updErr.message}` }
      }
      split += 1
    }
    notes.push(`${whole} tedavi tamamen, ${split} tedavi kalan bedelle yeni hekime aktarıldı${stay ? `, ${stay} tedavi ödenmiş olduğu için eski hekimde kaldı` : ''}`)

    // Hasta atamaları
    await admin.from('patient_assignments').update({ doctor_id: toId }).eq('doctor_id', doctorId)

    // Gelecekteki randevular: yeni hekimde çakışma yoksa taşınır
    if (input.moveAppointments) {
      const appts = await futureAppointmentRows(admin, clinicId, doctorId)
      let moved = 0
      let skipped = 0
      for (const a of appts) {
        const start = new Date(a.scheduled_at).getTime()
        const end = start + (a.duration_min ?? 30) * 60000
        const { data: others } = await admin
          .from('appointments')
          .select('scheduled_at, duration_min')
          .eq('clinic_id', clinicId)
          .eq('doctor_id', toId)
          .not('status', 'in', '(cancelled,no_show)')
          .gte('scheduled_at', new Date(start - 24 * 3600000).toISOString())
          .lte('scheduled_at', new Date(end).toISOString())
        const clash = (others ?? []).some((o) => {
          const s = new Date(o.scheduled_at).getTime()
          const e = s + (o.duration_min ?? 30) * 60000
          return s < end && e > start
        })
        if (clash) { skipped += 1; continue }
        const { error } = await admin.from('appointments').update({ doctor_id: toId, updated_at: new Date().toISOString() }).eq('id', a.id).eq('clinic_id', clinicId)
        if (error) skipped += 1
        else moved += 1
      }
      if (moved || skipped) notes.push(`${moved} randevu yeni hekime geçti${skipped ? `, ${skipped} randevu çakıştığı için eski hekimde kaldı` : ''}`)
    }
  }

  const { error: stErr } = await admin
    .from('doctors')
    .update({ status: action === 'delete' ? 'deleted' : 'passive', updated_at: new Date().toISOString() })
    .eq('id', doctorId)
    .eq('clinic_id', clinicId)
  if (stErr) return { error: stErr.message }

  // Bu hekime bağlı kullanıcıların girişi kapanır
  const { data: linked } = await admin.from('profiles').select('id').eq('clinic_id', clinicId).eq('doctor_id', doctorId)
  for (const l of linked ?? []) await admin.auth.admin.updateUserById(l.id, { ban_duration: '876000h' })
  await admin.from('admin_email_allowlist').update({ is_active: false }).eq('clinic_id', clinicId).eq('doctor_id', doctorId)

  return { success: true, message: notes.join('. ') }
}

/** Hekimi pasife al veya sil (gizle) */
export async function offboardDoctor(input: {
  doctorId: number
  action: 'passive' | 'delete'
  transferToDoctorId?: number | null
  moveAppointments?: boolean
}): Promise<OffboardResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return { error: adminErr.error }
  const admin = createAdminClient()
  const res = await offboardDoctorCore(admin, {
    clinicId: ctx.clinicId,
    doctorId: input.doctorId,
    action: input.action,
    transferToDoctorId: input.transferToDoctorId ?? null,
    moveAppointments: input.moveAppointments ?? true,
  })
  revalidatePath('/settings')
  revalidatePath('/patients')
  revalidatePath('/finance')
  revalidatePath('/appointments')
  return res
}

/** Kullanıcıyı pasife al veya sil. Hekim hesabıysa bağlı hekim de aynı işleme girer (devam eden hastalar aktarılır). */
export async function offboardUser(input: {
  userId: string
  action: 'passive' | 'delete'
  transferToDoctorId?: number | null
  moveAppointments?: boolean
}): Promise<OffboardResult> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return { error: adminErr.error }
  if (ctx.userId === input.userId) return { error: 'Kendi hesabınızı pasife alamaz veya silemezsiniz' }

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('id, role, doctor_id').eq('id', input.userId).eq('clinic_id', ctx.clinicId).maybeSingle()
  if (!prof) return { error: 'Kullanıcı bu klinikte bulunamadı' }
  if (prof.role === 'bashekim') return { error: 'Başhekim hesabı pasife alınamaz veya silinemez' }

  let message = ''
  if (prof.doctor_id) {
    const res = await offboardDoctorCore(admin, {
      clinicId: ctx.clinicId,
      doctorId: prof.doctor_id as number,
      action: input.action,
      transferToDoctorId: input.transferToDoctorId ?? null,
      moveAppointments: input.moveAppointments ?? true,
    })
    if (res.error) return res
    message = res.message ?? ''
  } else {
    const { error } = await admin.auth.admin.updateUserById(input.userId, { ban_duration: '876000h' })
    if (error) return { error: error.message }
  }

  if (input.action === 'delete') {
    const { error: delErr } = await admin.auth.admin.deleteUser(input.userId)
    if (delErr) {
      message = `${message ? message + '. ' : ''}Hesabın geçmiş kayıtları olduğu için kalıcı silinemedi; giriş kapatıldı (pasif).`
    }
  }
  revalidatePath('/settings')
  revalidatePath('/patients')
  revalidatePath('/finance')
  revalidatePath('/appointments')
  return { success: true, message }
}
