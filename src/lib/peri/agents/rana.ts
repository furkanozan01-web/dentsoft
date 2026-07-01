import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type Anthropic from '@anthropic-ai/sdk'
import { stubWrite, type PeriAgent } from './base'
import type { ToolResult, PendingWrite } from '../types'
import { getHekimHakedis, getClinicDebts } from '@/app/finance/actions'
import { canSeeAllHakedis } from '@/lib/permissions'

// ─── Tool şemaları ────────────────────────────────────────────────────────────

const RANA_TOOLS: Anthropic.Tool[] = [
  {
    name: 'acik_bakiye_listele',
    description:
      'Klinikte bakiyesi sıfırdan büyük (borçlu) hastaları listeler. ' +
      '"Ödemesi bekleyen hastalar", "açık hesaplar", "bakiyesi olanlar" gibi sorularda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Kaç kayıt döndürüleceği. Varsayılan: 20' },
      },
      required: [],
    },
  },
  {
    name: 'hekim_hakedis_getir',
    description:
      'Belirli bir hekimin hakediş özetini döndürür (brüt ciro, net ciro, hesaplanan hakediş, ödenen tutar, kalan). ' +
      'hekim_id verilmezse oturum sahibinin kendi hakediş bilgisi döner. ' +
      'tarih_baslangic/tarih_bitis verilmezse içinde bulunulan ay baz alınır. ' +
      'Yetki: Admin ve Mesul Müdür tüm hekimleri görebilir; diğerleri sadece kendi hakedişini.',
    input_schema: {
      type: 'object',
      properties: {
        hekim_id: {
          type: 'number',
          description: 'Hekimin integer kimliği (isteğe bağlı; verilmezse oturumun hekimi kullanılır)',
        },
        tarih_baslangic: {
          type: 'string',
          description: 'Başlangıç tarihi: YYYY-MM-DD (isteğe bağlı; verilmezse bu ayın başı)',
        },
        tarih_bitis: {
          type: 'string',
          description: 'Bitiş tarihi: YYYY-MM-DD (isteğe bağlı; şimdilik ay bazlı çalışır)',
        },
      },
      required: [],
    },
  },
  {
    name: 'fatura_detay_getir',
    description:
      'Fatura detaylarını döndürür. fatura_no ile belirli bir fatura, hasta_id ile hastanın tüm faturaları sorgulanabilir. ' +
      'En az biri zorunludur.',
    input_schema: {
      type: 'object',
      properties: {
        fatura_no: { type: 'string', description: 'Fatura numarası (örn. F00042) — belirli fatura sorgusu' },
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği — o hastanın tüm faturalarını listeler' },
      },
      required: [],
    },
  },
  {
    name: 'gelir_gider_grafigi',
    description:
      'Belirtilen dönemdeki gelir/gider serisini döndürür (günlük/haftalık/aylık gruplanmış). ' +
      'Normal hekim sadece kendi hastalarının verisini görür; admin/mesul müdür tüm kliniği görür.',
    input_schema: {
      type: 'object',
      properties: {
        baslangic: { type: 'string', description: 'ISO 8601 başlangıç tarihi: YYYY-MM-DD (isteğe bağlı; verilmezse bu ayın başı)' },
        bitis: { type: 'string', description: 'ISO 8601 bitiş tarihi: YYYY-MM-DD (isteğe bağlı; verilmezse bugün)' },
        gruplama: {
          type: 'string',
          enum: ['gunluk', 'haftalik', 'aylik'],
          description: 'Verinin gruplanma sıklığı. Varsayılan: gunluk',
        },
      },
      required: [],
    },
  },
  {
    name: 'sabit_gider_listele',
    description:
      'Kliniğin kayıtlı sabit giderlerini (kira, abonelik, kredi vb.) listeler. ' +
      'clinic_debts tablosundan çeker: tutar, ödeme durumu, tekrar sıklığı, son ödeme tarihi.',
    input_schema: {
      type: 'object',
      properties: {
        durum: {
          type: 'string',
          enum: ['active', 'paid'],
          description: 'Filtre: "active" ödenecekler, "paid" ödenenler. Belirtilmezse tüm aktif+paid kayıtlar.',
        },
      },
      required: [],
    },
  },
  {
    name: 'tahsilat_kaydet',
    description:
      'Bir hastadan yapılan ödemeyi kayıt altına alır. YAZMA işlemidir — önizleme→onay→commit akışı zorunlu.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        tutar_tl: { type: 'number', description: 'Tahsil edilen tutar (TL cinsinden, örn. 1500 = 1500 TL). Sistem kuruşa çevirir.' },
        odeme_yontemi: {
          type: 'string',
          enum: ['nakit', 'kart', 'havale'],
          description: 'Ödeme yöntemi. Varsayılan: nakit',
        },
        para_birimi: {
          type: 'string',
          enum: ['TRY', 'USD', 'EUR', 'GBP'],
          description: 'Para birimi. Varsayılan: TRY',
        },
        notlar: { type: 'string', description: 'Ödeme notu (isteğe bağlı)' },
      },
      required: ['hasta_id', 'tutar_tl'],
    },
  },
  {
    name: 'odeme_kaydet',
    description:
      'Klinik adına bir firmaya/tedarikçiye yapılan gider ödemesini kayıt altına alır (hasta yok). ' +
      'YAZMA işlemidir — önizleme→onay→commit akışı zorunlu.',
    input_schema: {
      type: 'object',
      properties: {
        firma_id: { type: 'number', description: 'İş ortağı/firma kimliği (isteğe bağlı, business_partners.id)' },
        tutar_tl: { type: 'number', description: 'Ödeme tutarı (TL cinsinden, örn. 5000 = 5000 TL). Sistem kuruşa çevirir.' },
        aciklama: { type: 'string', description: 'Ödeme açıklaması (zorunlu)' },
        kategori: { type: 'string', description: 'Gider kategorisi (isteğe bağlı, örn. kira, malzeme, personel)' },
        odeme_tarihi: { type: 'string', description: 'YYYY-MM-DD (isteğe bağlı, varsayılan bugün)' },
        odeme_yontemi: {
          type: 'string',
          enum: ['nakit', 'kart', 'havale'],
          description: 'Ödeme yöntemi. Varsayılan: nakit',
        },
      },
      required: ['tutar_tl', 'aciklama'],
    },
  },
  {
    name: 'fatura_kes',
    description:
      'Belirtilen tedavi/hizmet için fatura oluşturur. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        treatment_id: { type: 'number', description: 'Tedavi kaydının integer kimliği (isteğe bağlı)' },
        tutar_kurus: { type: 'number', description: 'Fatura tutarı (kuruş cinsinden)' },
        kdv_orani: { type: 'number', description: 'KDV oranı (0, 10 veya 20). Diş hekimliği genellikle 0.' },
      },
      required: ['hasta_id', 'tutar_kurus', 'kdv_orani'],
    },
  },
  {
    name: 'sabit_gider_ekle',
    description:
      'Yeni bir sabit gider kalemi ekler (kira, abonelik, kredi taksiti vb.). ' +
      'YAZMA işlemidir — önizleme→onay→commit akışı zorunlu.',
    input_schema: {
      type: 'object',
      properties: {
        aciklama: { type: 'string', description: 'Gider adı/açıklaması (zorunlu)' },
        tutar_tl: { type: 'number', description: 'Tutar (TL cinsinden, örn. 15000 = 15000 TL). Sistem kuruşa çevirir.' },
        tekrar: {
          type: 'string',
          enum: ['tek_seferlik', 'aylik', 'yillik'],
          description: 'Tekrar sıklığı. Varsayılan: tek_seferlik',
        },
        vade_tarihi: { type: 'string', description: 'Vade tarihi: YYYY-MM-DD (isteğe bağlı)' },
        notlar: { type: 'string', description: 'Ek notlar (isteğe bağlı)' },
      },
      required: ['aciklama', 'tutar_tl'],
    },
  },
  {
    name: 'senet_olustur',
    description:
      'Hasta için taksitli ödeme senedi oluşturur. YAZMA işlemidir — onay gerekir. ' +
      '[STUB — henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        toplam_kurus: { type: 'number', description: 'Toplam borç tutarı (kuruş cinsinden)' },
        taksit_sayisi: { type: 'number', description: 'Taksit adedi' },
        ilk_taksit_tarihi: { type: 'string', description: 'ISO 8601 ilk taksit tarihi: YYYY-MM-DD' },
      },
      required: ['hasta_id', 'toplam_kurus', 'taksit_sayisi', 'ilk_taksit_tarihi'],
    },
  },
]

const RANA_WRITE_TOOLS = new Set([
  'fatura_kes', 'senet_olustur',
])

const RANA_SYSTEM_PROMPT = `Sen Rana'sın — DentSoft'un muhasebe sorumlususun.

## Kimliğin
- Adın Rana. Finans, hakediş, tahsilat ve fatura konularında destek verirsin.
- Yalnızca Türkçe konuşursun. Düzenli, kesin ve güvenilirsin.

## Temel kurallar
1. Hiçbir zaman rakam uydurmazsın — her tutar veritabanından veya tarifeden gelir.
2. Para tutarlarını TL cinsinden gösterirsin: kuruş değerini 100'e böl (50000 kuruş = 500,00 TL).
3. KDV hesabını her zaman açık göster; diş hekimliğinde KDV genellikle %0'dır.
4. Henüz aktif olmayan bir işlem istenirse bunu açıkça söylersin.
5. Bugünün tarihi: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
6. Cevapları kısa tut; tutarları tablo/liste formatında sun.
`

// ─── Aktif tool: acik_bakiye_listele ─────────────────────────────────────────

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

// finance/page.tsx'teki safeTransactions/safeTreatments maskeleme mantığıyla tutarlı:
// admin veya mesul müdür tüm kliniği görür, diğer hekimler yalnızca kendi hasta/işlem verisini görür.
async function getCtxWithRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, role, doctor_id')
    .eq('id', user.id)
    .single()
  if (!profile?.clinic_id) return null

  const isAdmin = profile.role === 'bashekim'
  let isMesulMudur = false
  if (profile.doctor_id) {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('is_mesul_mudur')
      .eq('id', profile.doctor_id)
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle()
    isMesulMudur = doctor?.is_mesul_mudur === true
  }

  return {
    supabase,
    clinicId: profile.clinic_id as number,
    doctorId: (profile.doctor_id as number | null) ?? null,
    canSeeAll: isAdmin || isMesulMudur || (await canSeeAllHakedis()),
  }
}

async function runAcikBakiye(limit: number): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const [
    { data: patients, error: patientError },
    { data: treatments, error: treatmentError },
    { data: transactions, error: txError },
  ] = await Promise.all([
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

async function runHekimHakedis(
  hekimId?: number,
  tarihBaslangic?: string,
  tarihBitis?: string
): Promise<ToolResult> {
  const result = await getHekimHakedis({
    hekim_id: hekimId,
    tarih_baslangic: tarihBaslangic,
    tarih_bitis: tarihBitis,
  })
  if (result.error) return { success: false, error: result.error }
  return { success: true, data: result.data }
}

// ─── Aktif tool: tahsilat_kaydet ─────────────────────────────────────────────

const METHOD_MAP: Record<string, string> = {
  nakit: 'cash',
  kart: 'card',
  havale: 'transfer',
}

async function runTahsilatKaydet(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const hastaId = input.hasta_id as number | undefined
  const tutarTl = input.tutar_tl as number | undefined
  const yontemTr = (input.odeme_yontemi as string | undefined) ?? 'nakit'
  const paraBirimi = (input.para_birimi as string | undefined) ?? 'TRY'
  const notlar = (input.notlar as string | undefined) ?? null

  if (!Number.isInteger(hastaId) || (hastaId ?? 0) <= 0)
    return { success: false, error: 'Geçerli bir hasta_id gerekli' }
  if (!Number.isFinite(tutarTl) || (tutarTl ?? 0) <= 0)
    return { success: false, error: 'Tutar sıfırdan büyük olmalıdır' }

  // Hasta adı + bakiye
  const [{ data: hasta }, { data: treatments }, { data: txList }] = await Promise.all([
    ctx.supabase
      .from('patients')
      .select('name, surname')
      .eq('id', hastaId!)
      .eq('clinic_id', ctx.clinicId)
      .maybeSingle(),
    ctx.supabase
      .from('treatments')
      .select('fee, status')
      .eq('clinic_id', ctx.clinicId)
      .eq('patient_id', hastaId!),
    ctx.supabase
      .from('transactions')
      .select('amount, type')
      .eq('clinic_id', ctx.clinicId)
      .eq('patient_id', hastaId!),
  ])

  if (!hasta) return { success: false, error: `Hasta bulunamadı (ID: ${hastaId})` }

  const owed = (treatments ?? [])
    .filter((t) => t.status !== 'cancelled')
    .reduce((s, t) => s + (t.fee ?? 0), 0)
  const paid = (txList ?? [])
    .filter((t) => t.type === 'payment')
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  const bakiyeKurus = owed - paid
  const bakiyeTl = (bakiyeKurus / 100).toFixed(2)

  const tutarKurus = Math.round(tutarTl! * 100)
  const method = METHOD_MAP[yontemTr] ?? 'cash'
  const adSoyad = `${hasta.name} ${hasta.surname}`
  const yontemLabel = { cash: 'nakit', card: 'kart', transfer: 'havale' }[method] ?? method
  const preview =
    `${adSoyad} için ${tutarTl!.toFixed(2)} TL tahsilat kaydedilecek (${yontemLabel}, ${paraBirimi}). ` +
    `Mevcut bakiye: ${bakiyeTl} TL. Onaylıyor musunuz?`

  const pendingWrite: PendingWrite = {
    action: 'tahsilat_kaydet',
    params: {
      hasta_id: hastaId,
      tutar_kurus: tutarKurus,
      method,
      para_birimi: paraBirimi,
      notlar,
    },
    preview,
  }
  return { success: true, data: pendingWrite }
}

// ─── Aktif tool: gelir_gider_grafigi ─────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  // ISO hafta numarası (Pazartesi başlangıçlı)
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.valueOf() - firstThursday.valueOf()
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
  return `${target.getFullYear()}-H${String(week).padStart(2, '0')}`
}

function bucketKey(dateStr: string, gruplama: string): string {
  if (gruplama === 'aylik') return dateStr.slice(0, 7)
  if (gruplama === 'haftalik') return isoWeekKey(dateStr)
  return dateStr
}

async function runGelirGiderGrafigi(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtxWithRole()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const now = new Date()
  const baslangic = (input.baslangic as string | undefined) ??
    localDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const bitis = (input.bitis as string | undefined) ?? localDateStr(now)
  const gruplama = (input.gruplama as string | undefined) ?? 'gunluk'

  if (!['gunluk', 'haftalik', 'aylik'].includes(gruplama))
    return { success: false, error: 'Geçersiz gruplama: gunluk, haftalik veya aylik olmalıdır' }

  const [{ data: txs, error: txError }, { data: treatments, error: trError }] = await Promise.all([
    ctx.supabase
      .from('transactions')
      .select('transaction_date, amount, type, doctor_id, patient_id')
      .eq('clinic_id', ctx.clinicId)
      .gte('transaction_date', baslangic)
      .lte('transaction_date', bitis),
    ctx.supabase
      .from('treatments')
      .select('doctor_id, patient_id')
      .eq('clinic_id', ctx.clinicId),
  ])

  if (txError) return { success: false, error: txError.message }
  if (trError) return { success: false, error: trError.message }

  // Tx2 maskeleme: finance/page.tsx safeTransactions ile birebir aynı mantık
  let safeTxs = txs ?? []
  if (!ctx.canSeeAll) {
    const myPatientIds = new Set(
      (treatments ?? [])
        .filter((t) => t.doctor_id === ctx.doctorId && t.patient_id != null)
        .map((t) => t.patient_id as number)
    )
    safeTxs = safeTxs.filter((tx) => {
      if (tx.doctor_id != null) return tx.doctor_id === ctx.doctorId
      if (tx.patient_id != null) return myPatientIds.has(tx.patient_id)
      return false
    })
  }

  const buckets = new Map<string, { gelir: number; gider: number }>()
  for (const tx of safeTxs) {
    const key = bucketKey(tx.transaction_date as string, gruplama)
    const row = buckets.get(key) ?? { gelir: 0, gider: 0 }
    if (tx.type === 'payment') row.gelir += tx.amount ?? 0
    else if (tx.type === 'expense') row.gider += tx.amount ?? 0
    buckets.set(key, row)
  }

  const seri = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tarih, { gelir, gider }]) => ({
      tarih,
      gelir_tl: (gelir / 100).toFixed(2),
      gider_tl: (gider / 100).toFixed(2),
      net_tl: ((gelir - gider) / 100).toFixed(2),
    }))

  return {
    success: true,
    data: {
      baslangic,
      bitis,
      gruplama,
      kapsam: ctx.canSeeAll ? 'tum_klinik' : 'sadece_kendi_hastalarim',
      seri,
    },
  }
}

// ─── Aktif tool: sabit_gider_listele ─────────────────────────────────────────

const TEKRAR_LABEL: Record<string, string> = {
  tek_seferlik: 'Tek seferlik',
  aylik: 'Aylık',
  yillik: 'Yıllık',
}

async function runSabitGiderListele(durum?: string): Promise<ToolResult> {
  const result = await getClinicDebts()
  if (result.error) return { success: false, error: result.error }

  let liste = result.data ?? []
  if (durum === 'active') liste = liste.filter((d) => d.status === 'active')
  else if (durum === 'paid') liste = liste.filter((d) => d.status === 'paid')

  const rows = liste.map((d) => ({
    id: d.id,
    aciklama: d.title,
    toplam_tl: (d.total_amount / 100).toFixed(2),
    odenen_tl: (d.paid_amount / 100).toFixed(2),
    kalan_tl: ((d.total_amount - d.paid_amount) / 100).toFixed(2),
    tekrar: TEKRAR_LABEL[d.recurrence] ?? d.recurrence,
    vade_tarihi: d.due_date ?? null,
    durum: d.status,
    son_odeme: d.last_paid_at ?? null,
    notlar: d.notes ?? null,
  }))

  return {
    success: true,
    data: {
      sabit_giderler: rows,
      toplam_kayit: rows.length,
      mesaj: rows.length === 0 ? 'Kayıtlı sabit gider bulunamadı' : null,
    },
  }
}

// ─── Aktif tool: sabit_gider_ekle ────────────────────────────────────────────

async function runSabitGiderEkle(input: Record<string, unknown>): Promise<ToolResult> {
  const tutarTl = input.tutar_tl as number | undefined
  const aciklama = (input.aciklama as string | undefined)?.trim()
  const tekrar = (input.tekrar as string | undefined) ?? 'tek_seferlik'
  const vadeTarihi = (input.vade_tarihi as string | undefined) ?? null
  const notlar = (input.notlar as string | undefined) ?? null

  if (!Number.isFinite(tutarTl) || (tutarTl ?? 0) <= 0)
    return { success: false, error: 'Tutar sıfırdan büyük olmalıdır' }
  if (!aciklama)
    return { success: false, error: 'Açıklama zorunludur' }

  const tutarKurus = Math.round(tutarTl! * 100)
  const tekrarLabel = TEKRAR_LABEL[tekrar] ?? tekrar
  const preview = `${tutarTl!.toFixed(2)} TL sabit gider eklenecek: ${aciklama} (${tekrarLabel}). Onaylıyor musunuz?`

  const pendingWrite: PendingWrite = {
    action: 'sabit_gider_ekle',
    params: {
      aciklama,
      tutar_kurus: tutarKurus,
      tekrar,
      vade_tarihi: vadeTarihi,
      notlar,
    },
    preview,
  }
  return { success: true, data: pendingWrite }
}

// ─── Aktif tool: fatura_detay_getir ──────────────────────────────────────────

async function runFaturaDetayGetir(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const faturaNo = (input.fatura_no as string | undefined)?.trim() || null
  const hastaId = input.hasta_id as number | undefined

  if (!faturaNo && !hastaId)
    return { success: false, error: 'fatura_no veya hasta_id belirtilmelidir' }

  let query = ctx.supabase
    .from('transactions')
    .select('id, invoice_no, invoice_sent_at, invoice_institution, invoice_line_description, invoice_amount, invoice_vat_rate, invoice_status, patient_id, transaction_date, amount, type, description')
    .eq('clinic_id', ctx.clinicId)
    .not('invoice_no', 'is', null)

  if (faturaNo) {
    query = query.eq('invoice_no', faturaNo)
  } else {
    query = query.eq('patient_id', hastaId!)
  }

  const { data, error } = await query.order('transaction_date', { ascending: false })

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) {
    const msg = faturaNo
      ? `"${faturaNo}" numaralı fatura bulunamadı`
      : `Hasta ${hastaId} için fatura kaydı bulunamadı`
    return { success: true, data: { faturalar: [], mesaj: msg } }
  }

  // Kuruş → TL dönüşümü
  const faturalar = data.map((f) => ({
    ...f,
    invoice_amount_tl: f.invoice_amount != null ? (f.invoice_amount / 100).toFixed(2) : null,
    invoice_vat_pct: f.invoice_vat_rate != null ? f.invoice_vat_rate / 100 : null,
    amount_tl: f.amount != null ? (f.amount / 100).toFixed(2) : null,
  }))

  return { success: true, data: { faturalar } }
}

// ─── Aktif tool: odeme_kaydet ─────────────────────────────────────────────────

async function runOdemeKaydet(input: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await getCtx()
  if (!ctx) return { success: false, error: 'Yetkisiz erişim' }

  const firmaId = input.firma_id as number | undefined
  const tutarTl = input.tutar_tl as number | undefined
  const aciklama = (input.aciklama as string | undefined)?.trim()
  const kategori = (input.kategori as string | undefined) ?? null
  const odemeTarihi = (input.odeme_tarihi as string | undefined) ?? null
  const yontemTr = (input.odeme_yontemi as string | undefined) ?? 'nakit'

  if (!Number.isFinite(tutarTl) || (tutarTl ?? 0) <= 0)
    return { success: false, error: 'Tutar sıfırdan büyük olmalıdır' }
  if (!aciklama)
    return { success: false, error: 'Açıklama zorunludur' }

  let firmaAdi: string | null = null
  if (firmaId !== undefined) {
    if (!Number.isInteger(firmaId) || firmaId <= 0)
      return { success: false, error: 'Geçerli bir firma_id gerekli' }
    const { data: partner } = await ctx.supabase
      .from('business_partners')
      .select('name')
      .eq('id', firmaId)
      .eq('clinic_id', ctx.clinicId)
      .maybeSingle()
    if (!partner) return { success: false, error: `Firma bulunamadı (ID: ${firmaId})` }
    firmaAdi = partner.name as string
  }

  const tutarKurus = Math.round(tutarTl! * 100)
  const method = METHOD_MAP[yontemTr] ?? 'cash'
  const preview = firmaAdi
    ? `${firmaAdi} için ${tutarTl!.toFixed(2)} TL ödeme kaydedilecek (${aciklama}). Onaylıyor musunuz?`
    : `${tutarTl!.toFixed(2)} TL gider ödemesi kaydedilecek (${aciklama}). Onaylıyor musunuz?`

  const pendingWrite: PendingWrite = {
    action: 'odeme_kaydet',
    params: {
      firma_id: firmaId ?? null,
      tutar_kurus: tutarKurus,
      aciklama,
      kategori,
      odeme_tarihi: odemeTarihi,
      method,
    },
    preview,
  }
  return { success: true, data: pendingWrite }
}

// ─── Executor dispatch ────────────────────────────────────────────────────────

async function executeRanaTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (RANA_WRITE_TOOLS.has(toolName)) {
    return stubWrite(toolName, input)
  }

  switch (toolName) {
    case 'tahsilat_kaydet':
      return runTahsilatKaydet(input)
    case 'odeme_kaydet':
      return runOdemeKaydet(input)
    case 'sabit_gider_listele':
      return runSabitGiderListele(input.durum as string | undefined)
    case 'sabit_gider_ekle':
      return runSabitGiderEkle(input)
    case 'fatura_detay_getir':
      return runFaturaDetayGetir(input)
    case 'acik_bakiye_listele':
      return runAcikBakiye((input.limit as number) ?? 20)
    case 'hekim_hakedis_getir':
      return runHekimHakedis(
        input.hekim_id as number | undefined,
        input.tarih_baslangic as string | undefined,
        input.tarih_bitis as string | undefined
      )
    case 'gelir_gider_grafigi':
      return runGelirGiderGrafigi(input)
    default:
      return { success: false, error: `Rana: bilinmeyen tool: ${toolName}` }
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const ranaAgent = {
  id: 'rana' as const,
  displayName: 'Rana',
  role: 'Muhasebeci',
  tier: 'sonnet' as const,
  systemPrompt: RANA_SYSTEM_PROMPT,
  tools: RANA_TOOLS,
  writeTools: RANA_WRITE_TOOLS,
  executeTool: executeRanaTool,
} satisfies PeriAgent
