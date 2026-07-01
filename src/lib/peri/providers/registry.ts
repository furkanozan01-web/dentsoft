import 'server-only'

import { ClaudeProvider } from './claude-provider'
import { LocalProvider } from './local-provider'
import type { ModelProvider } from './types'

export type ModelTier = 'haiku' | 'sonnet' | 'local'

// Güncel model ID'leri: platform.claude.com/docs/en/about-claude/models/overview
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-5'

const haikuProvider = new ClaudeProvider(HAIKU_MODEL)
const sonnetProvider = new ClaudeProvider(SONNET_MODEL)
const localProvider = new LocalProvider()

/**
 * Tier'e göre ModelProvider döndürür. Yeni bir sağlayıcı (örn. kapalı
 * sistem) eklerken bu fonksiyona dokunmak yerine local-provider.ts'i
 * doldurmak yeterlidir — 'local' tier'i zaten buraya bağlıdır.
 */
export function getProvider(tier: ModelTier): ModelProvider {
  switch (tier) {
    case 'haiku':
      return haikuProvider
    case 'sonnet':
      return sonnetProvider
    case 'local':
      return localProvider
  }
}
