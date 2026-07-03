/**
 * PERİ — Tip tanımları
 *
 * Kural: Bu dosya saf tip tanımlarıdır, iş mantığı içermez.
 * route.ts ve her ajan dosyası (agents/*.ts) bu tipleri import eder.
 */

// ─── Sohbet mesajı ────────────────────────────────────────────────────────────

export type PeriRole = 'user' | 'assistant'

export interface PeriMessage {
  role: PeriRole
  content: string
}

// ─── Tool çağrısı sonucu ──────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// ─── Önizleme → Onay → Commit akışı ──────────────────────────────────────────
// Yazma işlemleri (Faz 2) bu akışı takip eder.
// PERİ asla otomatik commit etmez; önce preview döndürür, hekim onaylar.

export type WriteAction =
  // Emre — aktif
  | 'randevu_olustur'
  | 'randevu_tasi'
  | 'randevu_iptal'
  | 'randevu_durumu_guncelle'
  // İrem — aktif
  | 'hasta_olustur'
  | 'hasta_bilgi_guncelle'
  | 'hasta_not_ekle'
  | 'anamnez_guncelle'
  // Rana — aktif
  | 'tahsilat_kaydet'
  | 'odeme_kaydet'
  | 'sabit_gider_ekle'
  // Pınar — aktif
  | 'recete_olustur'
  // Rana — aktif
  | 'fatura_kes'
  | 'senet_olustur'
  // İrem — stub (SMS/WhatsApp dış servis anlaşması bekliyor)
  | 'kvkk_onay_gonder'
  | 'dijital_onam_gonder'
  | 'sms_gonder'
  | 'whatsapp_gonder'

export interface PendingWrite {
  action: WriteAction
  params: Record<string, unknown>
  /** Hekime gösterilecek özet: "Ayşe Hanım'ı Salı 14:00'e alacağım." */
  preview: string
  /** true ise commit endpoint gerçek yazma yapmadan erken döner */
  stub?: boolean
}

// ─── API istek / yanıt ────────────────────────────────────────────────────────

export interface PeriRequest {
  messages: PeriMessage[]
  /** Oturum bağlamı — server action üzerinden doldurulur, client göndermez */
  clinicId?: string
}

export type PeriResponseType =
  | 'text'        // Normal yanıt
  | 'preview'     // Yazma işlemi için onay bekliyor
  | 'error'       // Hata

export interface PeriResponse {
  type: PeriResponseType
  text: string
  /** Yalnızca type === 'preview' olduğunda dolu */
  pendingWrite?: PendingWrite
  /** Yanıtı üreten ajan */
  agent?: { id: string; displayName: string }
}
