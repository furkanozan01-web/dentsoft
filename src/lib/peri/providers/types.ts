/**
 * PERİ — Model sağlayıcı arayüzü ("port")
 *
 * Kural: route.ts ve agents/*.ts hiçbir zaman Anthropic SDK'yı doğrudan
 * çağırmaz — bu arayüzün arkasındaki bir ModelProvider üzerinden konuşur.
 * Yeni bir sağlayıcı (örn. yerel/kapalı sistem) eklemek için tek yapılması
 * gereken bu arayüzü uygulayan yeni bir dosya yazıp registry.ts'te
 * kaydetmektir — route.ts ve agents/*.ts'e dokunulmaz.
 */

import type Anthropic from '@anthropic-ai/sdk'

export interface ModelProvider {
  /** Sağlayıcıyı tanımlayan kısa kimlik, log/hata mesajlarında kullanılır. */
  id: string

  complete(params: {
    systemPrompt: string
    tools: Anthropic.Tool[]
    messages: Anthropic.MessageParam[]
    maxTokens?: number
  }): Promise<Anthropic.Message>
}
