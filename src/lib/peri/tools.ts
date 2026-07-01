/**
 * PERİ — Tool tanımları (Anthropic'e gönderilen şema)
 *
 * Kural: Her tool dar ve tek sorumlu olmalı.
 * Model bu şemaya bakarak hangi tool'u çağıracağına karar verir.
 * Gerçek Supabase sorguları tools-executor.ts içindedir.
 *
 * FAZ 1 — Okuma tool'ları (aktif, risksiz)
 * FAZ 2 — Yazma tool'ları (önizleme→onay→commit akışı)
 */

import type Anthropic from '@anthropic-ai/sdk'

export const PERI_TOOLS: Anthropic.Tool[] = [
  // ── FAZ 1: OKUMA ────────────────────────────────────────────────────────────

  {
    name: 'gunluk_program_getir',
    description:
      'Belirli bir tarihteki tüm randevuları listeler. ' +
      'Hekim "bugünkü programım", "yarın kimler var" gibi sorduğunda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        tarih: {
          type: 'string',
          description: 'ISO 8601 tarih formatı: YYYY-MM-DD. Örnek: 2026-06-23',
        },
      },
      required: ['tarih'],
    },
  },

  {
    name: 'hekimleri_listele',
    description:
      'Klinikte kayıtlı aktif hekimlerin listesini döndürür. ' +
      'Hekim adı veya ID\'si bilinmediğinde bu tool\'u kullan.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
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
        tarih: {
          type: 'string',
          description: 'ISO 8601 tarih formatı: YYYY-MM-DD',
        },
        hekim_id: {
          type: 'number',
          description: 'Hekimin integer kimliği (isteğe bağlı)',
        },
      },
      required: ['tarih'],
    },
  },

  {
    name: 'hasta_ara',
    description:
      'Hastayı ad, soyad veya telefon numarasıyla arar. ' +
      'İsim veya numara verildiğinde önce bunu çağır, hasta_id bulmak için.',
    input_schema: {
      type: 'object',
      properties: {
        sorgu: {
          type: 'string',
          description: 'Aranan ad, soyad veya telefon numarası',
        },
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
        hasta_id: {
          type: 'number',
          description: 'Hastanın integer kimliği (hasta_ara\'dan dönen id alanı)',
        },
      },
      required: ['hasta_id'],
    },
  },

  {
    name: 'acik_bakiye_listele',
    description:
      'Klinikte bakiyesi sıfırdan büyük (borçlu) hastaları listeler. ' +
      '"Ödemesi bekleyen hastalar", "açık hesaplar" gibi sorularda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Kaç kayıt döndürüleceği. Varsayılan: 20',
        },
      },
      required: [],
    },
  },

  // ── FAZ 2: YAZMA (önizleme→onay→commit) ─────────────────────────────────────
  // Bu tool'lar çağrıldığında tools-executor doğrudan yazmaz;
  // önce bir PendingWrite önizlemesi döndürür, hekim onaylar.

  {
    name: 'randevu_olustur',
    description:
      'Yeni bir randevu oluşturur. ' +
      'YAZMA işlemidir — hekim onayı gerekir, otomatik kaydetme. ' +
      'hasta_id ve hekim_id integer olmalı.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: {
          type: 'number',
          description: 'Hastanın integer kimliği (hasta_ara\'dan alınır)',
        },
        hekim_id: {
          type: 'number',
          description: 'Hekimin integer kimliği (hekimleri_listele\'den alınır)',
        },
        tarih_saat: {
          type: 'string',
          description: 'ISO 8601 tarih+saat: YYYY-MM-DDTHH:mm:ss+03:00',
        },
        sure_dakika: {
          type: 'number',
          description: 'Randevu süresi (dakika). Varsayılan: 30',
        },
        not: {
          type: 'string',
          description: 'İsteğe bağlı randevu notu',
        },
      },
      required: ['hasta_id', 'hekim_id', 'tarih_saat'],
    },
  },

  {
    name: 'randevu_tasi',
    description:
      'Mevcut bir randevuyu başka tarih/saate taşır. ' +
      'YAZMA işlemidir — hekim onayı gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        randevu_id: {
          type: 'number',
          description: 'Taşınacak randevunun integer kimliği',
        },
        hekim_id: {
          type: 'number',
          description: 'Hekimin integer kimliği (değişmiyorsa aynısını ver)',
        },
        yeni_tarih_saat: {
          type: 'string',
          description: 'ISO 8601 yeni tarih+saat: YYYY-MM-DDTHH:mm:ss+03:00',
        },
        sure_dakika: {
          type: 'number',
          description: 'Randevu süresi (dakika). Değişmiyorsa 30 ver.',
        },
      },
      required: ['randevu_id', 'hekim_id', 'yeni_tarih_saat'],
    },
  },

  {
    name: 'randevu_iptal',
    description:
      'Bir randevuyu iptal eder. ' +
      'YAZMA işlemidir — hekim onayı gerekir.',
    input_schema: {
      type: 'object',
      properties: {
        randevu_id: {
          type: 'number',
          description: 'İptal edilecek randevunun integer kimliği',
        },
        neden: { type: 'string', description: 'İptal nedeni (isteğe bağlı)' },
      },
      required: ['randevu_id'],
    },
  },
]

/** Tool adından tool şemasını hızlıca bulmak için yardımcı */
export function getToolByName(name: string): Anthropic.Tool | undefined {
  return PERI_TOOLS.find((t) => t.name === name)
}

/** Faz 2 yazma tool'larının listesi — executor'da önizleme akışını tetikler */
export const WRITE_TOOLS = new Set([
  'randevu_olustur',
  'randevu_tasi',
  'randevu_iptal',
])
