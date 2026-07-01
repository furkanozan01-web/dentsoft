/**
 * PERİ — Tool executor
 *
 * Her tool çağrısı için gerçek Supabase sorgusunu çalıştırır.
 * Yazma tool'ları doğrudan yazmaz: PendingWrite önizlemesi döndürür.
 * Commit işlemi /api/peri/commit endpoint'i aracılığıyla hekim onayından sonra yapılır.
 *
 * Kural: Bu dosya asla client-side'a import edilmez (server-only).
 */

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { WRITE_TOOLS } from './tools'
import type { ToolResult, WriteAction } from './types'

// ─── Ana dispatch fonksiyonu ──────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<ToolResult> {
  // Yazma tool'ları → önizleme döndür, veritabanına dokunma
  if (WRITE_TOOLS.has(toolName)) {
    return buildPreview(toolName as WriteAction, toolInput)
  }

  // Okuma tool'ları → gerçekten çalıştır
  switch (toolName) {
    case 'gunluk_program_getir':
      return runGunlukProgram(toolInput.tarih as string)
    case 'hekimleri_listele':
      return runHekimleriListele()
    case 'bos_slot_bul':
      return runBosSlotBul(toolInput.tarih as string, toolInput.hekim_id as number | undefined)
    case 'hasta_ara':
      return runHastaAra(toolInput.sorgu as string)
    case 'hasta_randevularini_getir':
      return runHastaRandevulari(toolInput.hasta_id as number)
    case 'acik_bakiye_listele':
      return runAcikBakiye((toolInput.limit as number) ?? 20)
    default:
      return { success: false, error: `Bilinmeyen tool: ${toolName}` }
  }
}

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
  return { supabase, clinicId: profile.clinic_id as number }
}

function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+03:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

// ─── Okuma Tool'ları ──────────────────────────────────────────────────────────

async function runGunlukProgram(tarih: string): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }
  if (!tarih) return { success: false, error: 'Tarih gerekli' }

  const { start, end } = dayRange(tarih)
  const { data, error } = await ctx.supabase
    .from('appointments')
    .select('id, scheduled_at, duration_min, status, treatment_note, patient:patients(name,surname), doctor:doctors(name)')
    .eq('clinic_id', ctx.clinicId)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at')

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

async function runHekimleriListele(): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const { data, error } = await ctx.supabase
    .from('doctors')
    .select('id, name, specialty, color')
    .eq('clinic_id', ctx.clinicId)
    .eq('status', 'active')
    .order('name')

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

async function runBosSlotBul(tarih: string, hekimId?: number): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }
  if (!tarih) return { success: false, error: 'Tarih gerekli' }

  const { start, end } = dayRange(tarih)
  const [{ data: clinic, error: clinicError }, { data: appointments, error: apptError }] =
    await Promise.all([
      ctx.supabase
        .from('clinic_settings')
        .select('work_start, work_end, default_duration')
        .eq('id', ctx.clinicId)
        .single(),
      (() => {
        let q = ctx.supabase
          .from('appointments')
          .select('scheduled_at, duration_min, status')
          .eq('clinic_id', ctx.clinicId)
          .gte('scheduled_at', start)
          .lt('scheduled_at', end)
          .not('status', 'in', '(cancelled,no_show)')
        if (hekimId) q = q.eq('doctor_id', hekimId)
        return q
      })(),
    ])

  if (clinicError) return { success: false, error: clinicError.message }
  if (apptError) return { success: false, error: apptError.message }

  const workStart = clinic?.work_start ?? '09:00'
  const workEnd = clinic?.work_end ?? '18:00'
  const duration = clinic?.default_duration ?? 30
  const slots: string[] = []

  const cursor = new Date(`${tarih}T${workStart}:00+03:00`)
  const close = new Date(`${tarih}T${workEnd}:00+03:00`)

  while (cursor < close) {
    const slotEnd = new Date(cursor.getTime() + duration * 60000)
    const occupied = (appointments ?? []).some((appt) => {
      const apptStart = new Date(appt.scheduled_at)
      const apptEnd = new Date(apptStart.getTime() + (appt.duration_min ?? duration) * 60000)
      return cursor < apptEnd && slotEnd > apptStart
    })
    if (!occupied && slotEnd <= close) {
      slots.push(cursor.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    }
    cursor.setMinutes(cursor.getMinutes() + duration)
  }

  return { success: true, data: slots }
}

async function runHastaAra(sorgu: string): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }
  const q = sorgu?.trim()
  if (!q) return { success: false, error: 'Arama sorgusu gerekli' }

  const { data, error } = await ctx.supabase
    .from('patients')
    .select('id, name, surname, phone1, phone2, status')
    .eq('clinic_id', ctx.clinicId)
    .or(`name.ilike.%${q}%,surname.ilike.%${q}%,phone1.ilike.%${q}%,phone2.ilike.%${q}%`)
    .limit(10)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

async function runHastaRandevulari(hastaId: number): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }
  const id = Number(hastaId)
  if (!id) return { success: false, error: 'Hasta ID gerekli' }

  const { data, error } = await ctx.supabase
    .from('appointments')
    .select('id, scheduled_at, duration_min, status, treatment_note, doctor:doctors(name)')
    .eq('clinic_id', ctx.clinicId)
    .eq('patient_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

async function runAcikBakiye(limit: number): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const [{ data: patients, error: patientError }, { data: treatments, error: treatmentError }, { data: transactions, error: txError }] =
    await Promise.all([
      ctx.supabase
        .from('patients')
        .select('id, name, surname, phone1')
        .eq('clinic_id', ctx.clinicId)
        .eq('status', 'active'),
      ctx.supabase
        .from('treatments')
        .select('patient_id, fee, status')
        .eq('clinic_id', ctx.clinicId),
      ctx.supabase
        .from('transactions')
        .select('patient_id, amount, type')
        .eq('clinic_id', ctx.clinicId),
    ])

  if (patientError) return { success: false, error: patientError.message }
  if (treatmentError) return { success: false, error: treatmentError.message }
  if (txError) return { success: false, error: txError.message }

  const totals = new Map<number, { owed: number; paid: number }>()
  for (const treatment of treatments ?? []) {
    if (treatment.status === 'cancelled') continue
    const patientId = treatment.patient_id as number
    const row = totals.get(patientId) ?? { owed: 0, paid: 0 }
    row.owed += treatment.fee ?? 0
    totals.set(patientId, row)
  }
  for (const tx of transactions ?? []) {
    if (tx.type !== 'payment') continue
    const patientId = tx.patient_id as number
    const row = totals.get(patientId) ?? { owed: 0, paid: 0 }
    row.paid += tx.amount ?? 0
    totals.set(patientId, row)
  }

  const rows = (patients ?? [])
    .map((patient) => {
      const total = totals.get(patient.id) ?? { owed: 0, paid: 0 }
      return { ...patient, balance: total.owed - total.paid }
    })
    .filter((patient) => patient.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, Math.max(1, Math.min(limit, 100)))

  return { success: true, data: rows }
}

// ─── Yazma Tool'ları: Önizleme ────────────────────────────────────────────────
// Veritabanına dokunmaz; hekim UI'da onayladıktan sonra /api/peri/commit çağrılır.

async function buildPreview(action: WriteAction, params: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()

  let preview = ''

  if (action === 'randevu_olustur') {
    const hastaId = params.hasta_id as number
    const hekimId = params.hekim_id as number
    const tarihSaat = params.tarih_saat as string
    let hastaAdi = `Hasta #${hastaId}`
    let hekimAdi = `Hekim #${hekimId}`

    if (ctx) {
      const [{ data: hasta }, { data: hekim }] = await Promise.all([
        ctx.supabase.from('patients').select('name, surname').eq('id', hastaId).eq('clinic_id', ctx.clinicId).maybeSingle(),
        ctx.supabase.from('doctors').select('name').eq('id', hekimId).eq('clinic_id', ctx.clinicId).maybeSingle(),
      ])
      if (hasta) hastaAdi = `${hasta.name} ${hasta.surname}`
      if (hekim) hekimAdi = `Dt. ${hekim.name}`
    }

    const sureDk = (params.sure_dakika as number) ?? 30
    preview = `${hastaAdi} için ${formatDateTime(tarihSaat)} tarihinde ${hekimAdi} ile ${sureDk} dakikalık randevu oluşturulacak.`

  } else if (action === 'randevu_tasi') {
    const randevuId = params.randevu_id as number
    const yeniTarihSaat = params.yeni_tarih_saat as string
    let hastaAdi = ''

    if (ctx) {
      const { data: appt } = await ctx.supabase
        .from('appointments')
        .select('patient:patients(name,surname)')
        .eq('id', randevuId)
        .eq('clinic_id', ctx.clinicId)
        .maybeSingle()
      const patient = (appt as { patient: { name: string; surname: string } | null } | null)?.patient
      if (patient) hastaAdi = `${patient.name} ${patient.surname}`
    }

    preview = hastaAdi
      ? `${hastaAdi} adlı hastanın randevusu ${formatDateTime(yeniTarihSaat)} tarihine taşınacak.`
      : `Randevu #${randevuId} ${formatDateTime(yeniTarihSaat)} tarihine taşınacak.`

  } else if (action === 'randevu_iptal') {
    const randevuId = params.randevu_id as number
    let hastaAdi = ''

    if (ctx) {
      const { data: appt } = await ctx.supabase
        .from('appointments')
        .select('patient:patients(name,surname), scheduled_at')
        .eq('id', randevuId)
        .eq('clinic_id', ctx.clinicId)
        .maybeSingle()
      const patient = (appt as { patient: { name: string; surname: string } | null; scheduled_at: string | null } | null)?.patient
      const scheduledAt = (appt as { scheduled_at: string | null } | null)?.scheduled_at
      if (patient) hastaAdi = `${patient.name} ${patient.surname}`
      const tarihStr = scheduledAt ? ` (${formatDateTime(scheduledAt)})` : ''
      preview = hastaAdi
        ? `${hastaAdi} adlı hastanın randevusu${tarihStr} iptal edilecek.`
        : `Randevu #${randevuId}${tarihStr} iptal edilecek.`
    } else {
      preview = `Randevu #${randevuId} iptal edilecek.`
    }
  }

  return {
    success: true,
    data: {
      action,
      params,
      preview,
    },
  }
}
