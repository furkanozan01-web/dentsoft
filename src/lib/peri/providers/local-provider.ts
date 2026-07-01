import 'server-only'

import type Anthropic from '@anthropic-ai/sdk'
import type { ModelProvider } from './types'

/**
 * PERİ — Yerel/kapalı sistem model sağlayıcısı (STUB)
 *
 * Bu dosya şu anda hiçbir ajana atanmamıştır — yalnızca gelecekteki bir
 * yerel/kapalı AI sistemi için altyapı (port) olarak durur.
 *
 * NE ZAMAN DOLDURULACAK:
 * Klinik kendi/kapalı bir model (örn. on-prem LLM, air-gapped sistem)
 * kurduğunda, bu dosya gerçek bağlantı koduyla doldurulur.
 *
 * NASIL DOLDURULACAK:
 * 1. LocalProvider sınıfı ModelProvider arayüzünü uygulamaya devam eder —
 *    imza değişmez: complete({ systemPrompt, tools, messages, maxTokens })
 *    → Promise<Anthropic.Message>.
 * 2. Dönen değer Anthropic.Message şekline uymalıdır (content, stop_reason,
 *    usage vb. alanlar) — route.ts bu şekli bekler, aksi halde tool-use
 *    döngüsü ve preview akışı bozulur. Yerel sistemin çıktısı bu şekle
 *    dönüştürülerek (adapter) map'lenmelidir.
 * 3. Aşağıdaki throw Error(...) satırı silinir, yerine gerçek bağlantı
 *    (HTTP çağrısı, gRPC, yerel süreç vb.) kodu yazılır.
 * 4. registry.ts'te getProvider('local') zaten bu sınıfı döndürüyor —
 *    kayıt için ek bir değişiklik gerekmez.
 * 5. Bir ajanı yerel sağlayıcıya geçirmek için o ajanın tier alanı
 *    'local' değerini destekleyecek şekilde genişletilir (bkz. agents/base.ts
 *    PeriAgent.tier) ve registry.ts'teki getProvider çağrısı güncellenir.
 *    route.ts'e DOKUNULMAZ.
 *
 * KESİN KURAL: Bu dosya doldurulana kadar complete() her zaman açık bir
 * hata fırlatır — sessizce Claude'a düşmez, sessizce boş yanıt dönmez.
 */
export class LocalProvider implements ModelProvider {
  readonly id = 'local:stub'

  async complete(_params: {
    systemPrompt: string
    tools: Anthropic.Tool[]
    messages: Anthropic.MessageParam[]
    maxTokens?: number
  }): Promise<Anthropic.Message> {
    throw new Error(
      'Yerel model sağlayıcısı henüz yapılandırılmadı. Kurulum tamamlandığında bu dosyayı doldurun.'
    )
  }
}
