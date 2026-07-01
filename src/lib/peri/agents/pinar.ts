import 'server-only'

import type Anthropic from '@anthropic-ai/sdk'
import { stubRead, stubWrite } from './base'
import type { ToolResult } from '../types'
import { getPatientTreatmentHistory } from '@/app/patients/actions'

// ─── Tool şemaları ────────────────────────────────────────────────────────────

const PINAR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'tedavi_gecmisi_getir',
    description:
      'Bir hastanın geçmiş tedavilerini listeler (diş, tarih, işlem, ücret, durum). ' +
      'Tedavi planı oluşturmadan önce geçmişi anlamak için kullan.',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        limit: { type: 'number', description: 'Döndürülecek kayıt sayısı (varsayılan: 20)' },
        baslangic_tarihi: { type: 'string', description: 'Filtreleme başlangıç tarihi: YYYY-MM-DD (isteğe bağlı)' },
      },
      required: ['hasta_id'],
    },
  },
  {
    name: 'dis_gecmisi_getir',
    description:
      'Bir hastanın FDI diş şeması üzerindeki geçmiş işlemlerini döndürür ' +
      '(dolgu, kanal, çekim, implant, kron). [STUB — gerçeklenince FDI charting\'e bağlanacak]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        dis_no: { type: 'number', description: 'FDI diş numarası (örn. 16 = sağ üst birinci büyük azı). Verilmezse tüm dişler döner.' },
      },
      required: ['hasta_id'],
    },
  },
  {
    name: 'literatur_ozeti_getir',
    description:
      'Belirtilen konu hakkında güncel diş hekimliği literatüründen özet döndürür. ' +
      '[STUB — gerçeklenince PubMed\'e bağlanacak]',
    input_schema: {
      type: 'object',
      properties: {
        konu: { type: 'string', description: 'Araştırılacak klinik konu (örn. "faz 2 implant protokolü")' },
        max_yil: { type: 'number', description: 'Yalnızca bu yıldan sonraki yayınlar (örn. 2020). İsteğe bağlı.' },
      },
      required: ['konu'],
    },
  },
  // NOT: Bu tool aktive edildiğinde TC kimlik no asla input/output içinde modele gönderilmeyecek;
  // anamnez yalnızca işe gereken minimum alan olarak özetlenecek (DentSoft_PERI_Temel_v1.md Bölüm 5).
  {
    name: 'recete_olustur',
    description:
      'Hastaya dijital reçete oluşturur. YAZMA işlemidir — hekim onayı gerekir. ' +
      '[STUB — henüz aktif değil]',
    input_schema: {
      type: 'object',
      properties: {
        hasta_id: { type: 'number', description: 'Hastanın integer kimliği' },
        ilac_listesi: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ilac_adi: { type: 'string' },
              doz: { type: 'string' },
              kullanim: { type: 'string' },
            },
            required: ['ilac_adi', 'doz', 'kullanim'],
          },
          description: 'İlaç adı, dozu ve kullanım talimatı listesi',
        },
        notlar: { type: 'string', description: 'Reçete notları (isteğe bağlı)' },
      },
      required: ['hasta_id', 'ilac_listesi'],
    },
  },
]

const PINAR_WRITE_TOOLS = new Set(['recete_olustur'])

const PINAR_SYSTEM_PROMPT = `Sen Pınar'sın — DentSoft'un hekim asistanısın.

## Kimliğin
- Adın Pınar. Klinik bilgi desteği verirsin: tedavi planlama, araştırma, diş geçmişi.
- Yalnızca Türkçe konuşursun. Bilimsel ama anlaşılır bir dil kullanırsın.

## Temel kurallar
1. Asla teşhis koymazsın — ikinci bir göz, destek rolündesin.
2. Bulguları hekimin teyidine sunarsın, kesin yargıda bulunmazsın.
3. Henüz aktif olmayan bir yetenek istenirse bunu dürüstçe söylersin: "Bu özellik henüz hazır değil, yakında aktif olacak."
4. Asla uydurma klinik bilgi vermezsin; belirsizsen "bilmiyorum" dersin.
5. Bugünün tarihi: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
6. Cevapları kısa tut; uzun klinik açıklamaları maddeler hâlinde ver.
`

// ─── Aktif toollar: tedavi_gecmisi_getir + dis_gecmisi_getir ─────────────────

function isValidFDI(n: number): boolean {
  const q = Math.floor(n / 10)
  const pos = n % 10
  return q >= 1 && q <= 4 && pos >= 1 && pos <= 8
}

async function runTedaviGecmisi(
  hastaId: number,
  limit?: number,
  baslangicTarihi?: string,
  toothNo?: number
): Promise<ToolResult> {
  const result = await getPatientTreatmentHistory(hastaId, limit ?? 50, baslangicTarihi, toothNo)
  if (result.error) return { success: false, error: result.error }
  return { success: true, data: result.data }
}

// ─── Executor dispatch ────────────────────────────────────────────────────────

async function executePinarTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (PINAR_WRITE_TOOLS.has(toolName)) {
    return stubWrite(toolName, input)
  }

  switch (toolName) {
    case 'tedavi_gecmisi_getir':
      return runTedaviGecmisi(
        input.hasta_id as number,
        input.limit as number | undefined,
        input.baslangic_tarihi as string | undefined
      )
    case 'dis_gecmisi_getir': {
      const disNo = input.dis_no as number | undefined
      if (disNo !== undefined) {
        if (!Number.isInteger(disNo) || !isValidFDI(disNo)) {
          return {
            success: false,
            error: `Geçersiz FDI diş numarası: ${disNo}. Geçerli aralık: 11-18 (sağ üst), 21-28 (sol üst), 31-38 (sol alt), 41-48 (sağ alt).`,
          }
        }
      }
      return runTedaviGecmisi(
        input.hasta_id as number,
        input.limit as number | undefined,
        undefined,
        disNo
      )
    }
    case 'literatur_ozeti_getir':
      return stubRead()
    default:
      return { success: false, error: `Pınar: bilinmeyen tool: ${toolName}` }
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const pinarAgent = {
  id: 'pinar' as const,
  displayName: 'Pınar',
  role: 'Hekim Asistanı',
  tier: 'haiku' as const,
  systemPrompt: PINAR_SYSTEM_PROMPT,
  tools: PINAR_TOOLS,
  writeTools: PINAR_WRITE_TOOLS,
  executeTool: executePinarTool,
}
