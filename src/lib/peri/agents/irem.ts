import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type Anthropic from '@anthropic-ai/sdk'
import { stubWrite, type PeriAgent } from './base'
import type { ToolResult, WriteAction } from '../types'
import { getAnamnesis } from '@/app/patients/actions'

// ─── Tool şemaları ────────────────────────────────────────────────────────────

const IREM_TOOLS: Anthropic.Tool[] = [
  {
    name: 'hasta_ara',
    description:
      'Hastayı ad, soyad veya telefon numarasıyla arar. ' +
      'İsim veya numara verildiğinde önce bunu çağır, hasta_id bulmak için.',
    input_schema: {
      type: 'object',
      properties: {
        sorgu: { type: 'string', description: 'Aranan ad, soyad veya telefon numarası' },
      },
      required: ['sorgu'],
    },
  },
  // NOT: Bu tool aktive edildiğinde TC kimlik no asla input/output içinde modele gönderilmeyecek;
  // anamnez yalnızca işe gereken minimum alan olarak özetlenecek (DentSoft_PERI_Temel_v1.md Bölüm 5).
  {
    name: 'anamnez_getir',
    description:
      'Bir hastanın sağlık anamnez formunu döndürür (ilaçlar, alerjiler, kronik hastalıklar). ' +
      'TC kimlik no hiçbir koşulda döndürülmez — anamnez şifreli tutulur, model sadece tıbbi alanları görür.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
      },
      required: ['hasta_id'],
    },
  },
  {
    name: 'hasta_olustur',
    description:
      'Sisteme yeni hasta kaydı oluşturur. YAZMA işlemidir — onay gerekir. ' +
      'TC kimlik numarası bu tool üzerinden asla alınmaz.',
    input_schema: {
      type: 'object',
      properties: {
        ad: { type: 'string', description: 'Hastanın adı' },
        soyad: { type: 'string', description: 'Hastanın soyadı' },
        telefon: { type: 'string', description: 'Telefon numarası (05XX formatlı)' },
        dogum_tarihi: { type: 'string', description: 'Doğum tarihi: YYYY-MM-DD (isteğe bağlı)' },
        cinsiyet: { type: 'string', enum: ['erkek', 'kadin', 'diger'], description: 'Cinsiyet (isteğe bağlı)' },
        eposta: { type: 'string', description: 'E-posta adresi (isteğe bağlı)' },
        adres: { type: 'string', description: 'Adres (isteğe bağlı)' },
      },
      required: ['ad', 'soyad', 'telefon'],
    },
  },
  {
    name: 'hasta_bilgi_guncelle',
    description:
      'Mevcut hasta bilgilerini günceller. YAZMA işlemidir — onay gerekir. ' +
      'TC kimlik numarası bu tool üzerinden asla güncellenmez.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Güncellenecek hastanın integer kimliği' },
        ad: { type: 'string', description: 'Yeni ad (isteğe bağlı)' },
        soyad: { type: 'string', description: 'Yeni soyad (isteğe bağlı)' },
        telefon1: { type: 'string', description: 'Birinci telefon numarası (isteğe bağlı)' },
        telefon2: { type: 'string', description: 'İkinci telefon numarası (isteğe bağlı)' },
        dogum_tarihi: { type: 'string', description: 'Doğum tarihi: YYYY-MM-DD (isteğe bağlı)' },
        adres: { type: 'string', description: 'Adres (isteğe bağlı)' },
        eposta: { type: 'string', description: 'E-posta adresi (isteğe bağlı)' },
      },
      required: ['hasta_id'],
    },
  },
  // NOT: Bu tool aktive edildiğinde TC kimlik no asla input/output içinde modele gönderilmeyecek;
  // anamnez yalnızca işe gereken minimum alan olarak özetlenecek (DentSoft_PERI_Temel_v1.md Bölüm 5).
  {
    name: 'anamnez_guncelle',
    description:
      'Bir hastanın anamnez bilgilerini günceller. YAZMA işlemidir — onay gerekir. ' +
      'TC kimlik no asla alınmaz.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        kullandigi_ilaclar: { type: 'string', description: 'Kullandığı ilaçlar (isteğe bağlı)' },
        alerjiler: { type: 'string', description: 'Bilinen alerjiler (isteğe bağlı)' },
        kronik_hastaliklar: { type: 'string', description: 'Kronik hastalıklar (isteğe bağlı)' },
        kan_grubu: { type: 'string', description: 'Kan grubu (A+, B-, O+, AB- vb.) (isteğe bağlı)' },
        notlar: { type: 'string', description: 'Ek klinik notlar (isteğe bağlı)' },
      },
      required: ['hasta_id'],
    },
  },
  {
    name: 'hasta_not_ekle',
    description:
      'Hasta dosyasına klinik not ekler. YAZMA işlemidir — onay gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        not_metni: { type: 'string', description: 'Eklenecek klinik not metni' },
        onemli: { type: 'boolean', description: 'Önemli olarak işaretlensin mi (varsayılan: false)' },
      },
      required: ['hasta_id', 'not_metni'],
    },
  },
  {
    name: 'kvkk_onay_gonder',
    description:
      'Hastaya KVKK aydınlatma metni ve onay formunu gönderir. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        kanal: { type: 'string', enum: ['sms', 'whatsapp', 'eposta'], description: 'Gönderim kanalı' },
      },
      required: ['hasta_id', 'kanal'],
    },
  },
  {
    name: 'dijital_onam_gonder',
    description:
      'Hasta onam formunu dijital olarak gönderir. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        form_turu: { type: 'string', description: 'Onam form türü (örn. implant, cerrahi, genel)' },
        kanal: { type: 'string', enum: ['sms', 'whatsapp', 'eposta'], description: 'Gönderim kanalı' },
      },
      required: ['hasta_id', 'form_turu', 'kanal'],
    },
  },
  {
    name: 'sms_gonder',
    description:
      'Hastaya SMS gönderir. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — SMS entegrasyonu henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        mesaj: { type: 'string', description: 'Gönderilecek SMS metni (max 160 karakter)' },
      },
      required: ['hasta_id', 'mesaj'],
    },
  },
  {
    name: 'whatsapp_gonder',
    description:
      'Hastaya WhatsApp mesajı gönderir. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — WhatsApp entegrasyonu henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        mesaj: { type: 'string', description: 'Gönderilecek mesaj metni' },
      },
      required: ['hasta_id', 'mesaj'],
    },
  },
]

const IREM_WRITE_TOOLS = new Set([
  'kvkk_onay_gonder', 'dijital_onam_gonder',
  'sms_gonder', 'whatsapp_gonder',
])

const IREM_SYSTEM_PROMPT = `Sen İrem'sin — DentSoft'un hasta ilişkileri sorumlususun.

## Kimliğin
- Adın İrem. Hasta kayıt, anamnez, KVKK/onam ve iletişim konularında destek verirsin.
- Yalnızca Türkçe konuşursun. Sıcak ve sabırlısın; hastaların gizliliğine önem verirsin.

## Temel kurallar
1. TC kimlik numarasını asla istemezsin, asla göstermezsin — hastalar iç sistem ID'si ile anılır.
2. Yeni hasta kaydı açarken TC kimlik numarası isteme — bu bilgi sonradan hasta kartından güvenli biçimde eklenir.
3. Kişisel verilere yalnızca gerektiği kadar erişirsin; gereksiz bilgi toplamaz, göstermezsin.
4. SMS/WhatsApp göndermeden önce hastanın telefon numarasını doğrula (hasta_ara ile bul).
5. Henüz aktif olmayan özellik istenirse bunu açıkça söylersin: "Bu özellik henüz hazır değil."
6. Bugünün tarihi: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
7. Cevapları kısa tut; liste gerektiğinde madde işareti kullan.
`

// ─── Aktif toollar: hasta_ara, hasta_olustur, hasta_bilgi_guncelle, hasta_not_ekle, anamnez_getir, anamnez_guncelle ───

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
  return { supabase, clinicId: profile.clinic_id as number, userId: user.id }
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

async function runHastaOlustur(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()

  const ad = (input.ad as string)?.trim()
  const soyad = (input.soyad as string)?.trim().toUpperCase()
  const telefon = (input.telefon as string)?.trim()

  if (!ad || !soyad || !telefon) {
    return { success: false, error: 'Ad, soyad ve telefon zorunludur' }
  }

  let warningLine = ''
  if (ctx) {
    const { data: existing } = await ctx.supabase
      .from('patients')
      .select('name, surname')
      .eq('clinic_id', ctx.clinicId)
      .or(`phone1.eq.${telefon},phone2.eq.${telefon}`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      warningLine = `⚠️ Bu telefon numarasıyla kayıtlı bir hasta zaten var: ${existing.name} ${existing.surname}. Yine de devam etmek istiyor musunuz?\n\n`
    }
  }

  const adSoyad = `${ad} ${soyad}`
  const preview = `${warningLine}${adSoyad} adında yeni hasta kaydı oluşturulacak (Tel: ${telefon}). Onaylıyor musunuz?`

  return {
    success: true,
    data: {
      action: 'hasta_olustur' as WriteAction,
      params: input,
      preview,
    },
  }
}

const FIELD_LABELS: Record<string, string> = {
  ad: 'ad',
  soyad: 'soyad',
  telefon1: 'telefon1',
  telefon2: 'telefon2',
  dogum_tarihi: 'doğum tarihi',
  adres: 'adres',
  eposta: 'e-posta',
}

async function runHastaBilgiGuncelle(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const hastaId = input.hasta_id as number
  if (!Number.isInteger(hastaId) || hastaId <= 0) {
    return { success: false, error: 'Geçerli bir hasta ID gerekli' }
  }

  const { data: hasta, error: fetchErr } = await ctx.supabase
    .from('patients')
    .select('name, surname')
    .eq('id', hastaId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!hasta) return { success: false, error: `Hasta bulunamadı (ID: ${hastaId})` }

  const changes: string[] = []
  for (const field of Object.keys(FIELD_LABELS)) {
    const val = input[field]
    if (val !== undefined && val !== null && val !== '') {
      changes.push(`${FIELD_LABELS[field]} → ${val}`)
    }
  }

  if (changes.length === 0) {
    return { success: false, error: 'Güncellenecek en az bir alan belirtilmeli' }
  }

  const adSoyad = `${hasta.name} ${hasta.surname}`
  const preview = `${adSoyad} hastasının bilgileri güncellenecek: ${changes.join(', ')}. Onaylıyor musunuz?`

  return {
    success: true,
    data: {
      action: 'hasta_bilgi_guncelle' as WriteAction,
      params: input,
      preview,
    },
  }
}

async function runAnamnezGetir(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const hastaId = input.hasta_id as number
  if (!Number.isInteger(hastaId) || hastaId <= 0) {
    return { success: false, error: 'Geçerli bir hasta ID gerekli' }
  }

  const result = await getAnamnesis(hastaId)
  if (result.error) return { success: false, error: result.error }

  // Audit log — fire-and-forget, hata erişimi engellemez
  void ctx.supabase.from('peri_audit_log').insert({
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    patient_id: hastaId,
    tool_name: 'anamnez_getir',
  })

  // TC güvencesi: Anamnesis tipi { diseases, medications, notes } — tc/tc_enc hiç yok.
  // Explicit destructure ile sadece bu üç alan modele gönderilir.
  const { diseases, medications, notes } = result.data ?? { diseases: [], medications: [], notes: '' }
  return { success: true, data: { diseases, medications, notes } }
}

const ANAMNEZ_FIELD_LABELS: Record<string, string> = {
  kullandigi_ilaclar: 'kullanılan ilaçlar',
  kronik_hastaliklar: 'kronik hastalıklar',
  alerjiler: 'alerjiler',
  kan_grubu: 'kan grubu',
  notlar: 'notlar',
}

async function runAnamnezGuncelle(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const hastaId = input.hasta_id as number
  if (!Number.isInteger(hastaId) || hastaId <= 0) {
    return { success: false, error: 'Geçerli bir hasta ID gerekli' }
  }

  const { data: hasta, error: fetchErr } = await ctx.supabase
    .from('patients')
    .select('name, surname')
    .eq('id', hastaId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!hasta) return { success: false, error: `Hasta bulunamadı (ID: ${hastaId})` }

  const changes: string[] = []
  for (const [field, label] of Object.entries(ANAMNEZ_FIELD_LABELS)) {
    const val = input[field]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      changes.push(`${label} → ${val}`)
    }
  }

  if (changes.length === 0) {
    return { success: false, error: 'Güncellenecek en az bir alan belirtilmeli' }
  }

  const adSoyad = `${hasta.name} ${hasta.surname}`
  const preview = `${adSoyad} hastasının anamnez bilgileri güncellenecek: ${changes.join(', ')}. Onaylıyor musunuz?`

  return {
    success: true,
    data: {
      action: 'anamnez_guncelle' as WriteAction,
      params: input,
      preview,
    },
  }
}

async function runHastaNotEkle(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const hastaId = input.hasta_id as number
  const notMetni = (input.not_metni as string)?.trim()
  const onemli = Boolean(input.onemli)

  if (!Number.isInteger(hastaId) || hastaId <= 0) {
    return { success: false, error: 'Geçerli bir hasta ID gerekli' }
  }
  if (!notMetni) return { success: false, error: 'Not metni boş olamaz' }

  const { data: hasta, error: fetchErr } = await ctx.supabase
    .from('patients')
    .select('name, surname')
    .eq('id', hastaId)
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!hasta) return { success: false, error: `Hasta bulunamadı (ID: ${hastaId})` }

  const notOnizleme = notMetni.length > 60 ? notMetni.slice(0, 60) + '…' : notMetni
  const adSoyad = `${hasta.name} ${hasta.surname}`

  let preview = `${adSoyad} için not eklenecek: '${notOnizleme}'`
  if (onemli) preview += '\n⚠️ Önemli olarak işaretlenecek'
  preview += '\nOnaylıyor musunuz?'

  return {
    success: true,
    data: {
      action: 'hasta_not_ekle' as WriteAction,
      params: input,
      preview,
    },
  }
}

// ─── Executor dispatch ────────────────────────────────────────────────────────

async function executeIremTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (IREM_WRITE_TOOLS.has(toolName)) {
    return stubWrite(toolName, input)
  }

  switch (toolName) {
    case 'hasta_ara':
      return runHastaAra(input.sorgu as string)
    case 'hasta_olustur':
      return runHastaOlustur(input)
    case 'hasta_bilgi_guncelle':
      return runHastaBilgiGuncelle(input)
    case 'hasta_not_ekle':
      return runHastaNotEkle(input)
    case 'anamnez_getir':
      return runAnamnezGetir(input)
    case 'anamnez_guncelle':
      return runAnamnezGuncelle(input)
    default:
      return { success: false, error: `İrem: bilinmeyen tool: ${toolName}` }
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const iremAgent = {
  id: 'irem' as const,
  displayName: 'İrem',
  role: 'Hasta İlişkileri',
  tier: 'sonnet' as const,
  systemPrompt: IREM_SYSTEM_PROMPT,
  tools: IREM_TOOLS,
  writeTools: IREM_WRITE_TOOLS,
  executeTool: executeIremTool,
} satisfies PeriAgent
