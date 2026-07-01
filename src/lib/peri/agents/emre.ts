import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type Anthropic from '@anthropic-ai/sdk'
import type { PeriAgent } from './base'
import type { ToolResult, WriteAction } from '../types'

// ─── Tool şemaları ────────────────────────────────────────────────────────────

const EMRE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'gunluk_program_getir',
    description:
      'Belirli bir tarihteki tüm randevuları listeler. ' +
      'Hekim "bugünkü programım", "yarın kimler var" gibi sorduğunda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        tarih: { type: 'string', description: 'ISO 8601 tarih formatı: YYYY-MM-DD. Örnek: 2026-06-23' },
      },
      required: ['tarih'],
    },
  },
  {
    name: 'hekimleri_listele',
    description: 'Klinikte kayıtlı aktif hekimlerin listesini döndürür. Hekim adı veya ID\'si bilinmediğinde kullan.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'bos_slot_bul',
    description:
      'Belirli bir tarihte klinikte dolu olmayan saat dilimlerini döndürür. ' +
      '"Salı boş muyum", "önümüzdeki hafta randevu verebilir miyiz" gibi sorularda kullan. ' +
      'hekim_id verilirse sadece o hekimin slotlarına bakar.',
    input_schema: {
      type: 'object',
      properties: {
        tarih: { type: 'string', description: 'ISO 8601 tarih formatı: YYYY-MM-DD' },
        hekim_id: { type: 'number', description: 'Hekimin integer kimliği (isteğe bağlı)' },
      },
      required: ['tarih'],
    },
  },
  {
    name: 'hasta_ara',
    description: 'Hastayı ad, soyad veya telefon numarasıyla arar. hasta_id bulmak için kullan.',
    input_schema: {
      type: 'object',
      properties: {
        sorgu: { type: 'string', description: 'Aranan ad, soyad veya telefon numarası' },
      },
      required: ['sorgu'],
    },
  },
  {
    name: 'hasta_randevularini_getir',
    description: 'Bir hastanın geçmiş ve gelecek randevularını listeler.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği (hasta_ara\'dan dönen id alanı)' },
      },
      required: ['hasta_id'],
    },
  },
  {
    name: 'randevu_olustur',
    description: 'Yeni bir randevu oluşturur. YAZMA işlemidir — hekim onayı gerekir. hasta_id ve hekim_id integer olmalı.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği (hasta_ara\'dan alınır)' },
        hekim_id: { type: 'number', description: 'Hekimin integer kimliği (hekimleri_listele\'den alınır)' },
        tarih_saat: { type: 'string', description: 'ISO 8601 tarih+saat: YYYY-MM-DDTHH:mm:ss+03:00' },
        sure_dakika: { type: 'number', description: 'Randevu süresi (dakika). Varsayılan: 30' },
        not: { type: 'string', description: 'İsteğe bağlı randevu notu' },
      },
      required: ['hasta_id', 'hekim_id', 'tarih_saat'],
    },
  },
  {
    name: 'randevu_tasi',
    description: 'Mevcut bir randevuyu başka tarih/saate taşır. YAZMA işlemidir — hekim onayı gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        randevu_id: { type: 'number', description: 'Taşınacak randevunun integer kimliği' },
        hekim_id: { type: 'number', description: 'Hekimin integer kimliği (değişmiyorsa aynısını ver)' },
        yeni_tarih_saat: { type: 'string', description: 'ISO 8601 yeni tarih+saat: YYYY-MM-DDTHH:mm:ss+03:00' },
        sure_dakika: { type: 'number', description: 'Randevu süresi (dakika). Değişmiyorsa 30 ver.' },
      },
      required: ['randevu_id', 'hekim_id', 'yeni_tarih_saat'],
    },
  },
  {
    name: 'randevu_iptal',
    description: 'Bir randevuyu iptal eder. YAZMA işlemidir — hekim onayı gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        randevu_id: { type: 'number', description: 'İptal edilecek randevunun integer kimliği' },
        neden: { type: 'string', description: 'İptal nedeni (isteğe bağlı)' },
      },
      required: ['randevu_id'],
    },
  },
  {
    name: 'randevu_durumu_guncelle',
    description:
      'Mevcut bir randevunun durumunu günceller (tamamlandı, gelmedi, vb.). YAZMA işlemidir — hekim onayı gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        randevu_id: { type: 'number', description: 'Güncellenecek randevunun integer kimliği' },
        durum: {
          type: 'string',
          enum: ['pending', 'scheduled', 'done', 'cancelled', 'no_show'],
          description: 'Yeni durum: pending | scheduled | done | cancelled | no_show',
        },
      },
      required: ['randevu_id', 'durum'],
    },
  },
]

const EMRE_WRITE_TOOLS = new Set(['randevu_olustur', 'randevu_tasi', 'randevu_iptal', 'randevu_durumu_guncelle'])

const EMRE_SYSTEM_PROMPT = `Sen Emre'sin — DentSoft'un randevu ve operasyon sorumlususun.

## Kimliğin
- Adın Emre. Pratik, net ve hızlısın. Gereksiz açıklama yapmaz, işe odaklanırsın.
- Yalnızca Türkçe konuşursun.
- Yalnızca randevu, program ve operasyonel verilerle çalışırsın.

## Yetki sınırların
- Okuma: günlük program, boş slotlar, hasta arama, hasta randevuları, hekim listesi.
- Yazma (SADECE hekim onayından sonra): randevu oluştur, taşı, iptal et, durumunu güncelle.

## Davranış kuralları
1. Bugünün tarihi: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
2. Hasta ismini bilmiyorsan önce hasta_ara ile ara, ID'yi bulduktan sonra devam et.
3. Hekim ismini bilmiyorsan hekimleri_listele ile doğru ismi bul.
4. Randevu oluşturmadan önce bos_slot_bul ile uygunluk kontrol et.
5. Tarih/saat ifadelerini ISO 8601 formatına çevir (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss+03:00).
6. Yazma işlemleri için önizleme metnini kısa ve net tut (1-2 cümle, Türkçe).
7. Asla tahmin yapmaz, veritabanından doğrularsın.
8. Cevapları 3-4 cümleyi geçme; liste gerektiğinde madde işareti kullan.
`

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
  })
}

// ─── Okuma tool'ları ──────────────────────────────────────────────────────────

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

// ─── Yazma tool'ları: Önizleme ────────────────────────────────────────────────

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

    if (ctx) {
      const { data: appt } = await ctx.supabase
        .from('appointments')
        .select('patient:patients(name,surname), scheduled_at')
        .eq('id', randevuId)
        .eq('clinic_id', ctx.clinicId)
        .maybeSingle()
      const patient = (appt as { patient: { name: string; surname: string } | null; scheduled_at: string | null } | null)?.patient
      const scheduledAt = (appt as { scheduled_at: string | null } | null)?.scheduled_at
      const hastaAdi = patient ? `${patient.name} ${patient.surname}` : ''
      const tarihStr = scheduledAt ? ` (${formatDateTime(scheduledAt)})` : ''
      preview = hastaAdi
        ? `${hastaAdi} adlı hastanın randevusu${tarihStr} iptal edilecek.`
        : `Randevu #${randevuId}${tarihStr} iptal edilecek.`
    } else {
      preview = `Randevu #${randevuId} iptal edilecek.`
    }

  } else if (action === 'randevu_durumu_guncelle') {
    const randevuId = params.randevu_id as number
    const durum = params.durum as string
    const durumLabel: Record<string, string> = {
      pending: 'beklemede',
      scheduled: 'planlandı',
      done: 'tamamlandı',
      cancelled: 'iptal edildi',
      no_show: 'gelmedi',
    }
    let hastaAdi = ''

    if (ctx) {
      const { data: appt } = await ctx.supabase
        .from('appointments')
        .select('patient:patients(name,surname)')
        .eq('id', randevuId)
        .eq('clinic_id', ctx.clinicId)
        .maybeSingle()
      const patient = (appt as { patient: { name: string; surname: string } | null } | null)?.patient
      if (patient) hastaAdi = `${patient.name} ${patient.surname} adlı hastanın`
    }

    const durumTr = durumLabel[durum] ?? durum
    preview = hastaAdi
      ? `${hastaAdi} randevusu "${durumTr}" olarak güncellenecek.`
      : `Randevu #${randevuId} durumu "${durumTr}" olarak güncellenecek.`
  }

  return { success: true, data: { action, params, preview } }
}

// ─── Executor dispatch ────────────────────────────────────────────────────────

async function executeEmreTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (EMRE_WRITE_TOOLS.has(toolName)) {
    return buildPreview(toolName as WriteAction, input)
  }

  switch (toolName) {
    case 'gunluk_program_getir':
      return runGunlukProgram(input.tarih as string)
    case 'hekimleri_listele':
      return runHekimleriListele()
    case 'bos_slot_bul':
      return runBosSlotBul(input.tarih as string, input.hekim_id as number | undefined)
    case 'hasta_ara':
      return runHastaAra(input.sorgu as string)
    case 'hasta_randevularini_getir':
      return runHastaRandevulari(input.hasta_id as number)
    default:
      return { success: false, error: `Emre: bilinmeyen tool: ${toolName}` }
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const emreAgent = {
  id: 'emre' as const,
  displayName: 'Emre',
  role: 'Sekreter',
  tier: 'haiku' as const,
  systemPrompt: EMRE_SYSTEM_PROMPT,
  tools: EMRE_TOOLS,
  writeTools: EMRE_WRITE_TOOLS,
  executeTool: executeEmreTool,
} satisfies PeriAgent
